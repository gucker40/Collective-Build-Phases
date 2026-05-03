"""
router.py - Logos routing and streaming.
"""

import json
from typing import Optional, List
from fastapi import APIRouter, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from models import stream_completion, complete_once, get_loaded_models, vision_completion, LOGOS_SYSTEM_PROMPT, load_config
from memory import get_relevant_memories, seal_memory, SealRequest

router = APIRouter()


class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[Message]
    intent: Optional[str] = "explain"
    memory_enabled: bool = True

class IntentRequest(BaseModel):
    prompt: str


# ── Intent detection ──────────────────────────────────────────────────────────

def detect_intent_fast(prompt: str) -> str:
    """
    Classify intent as fast/build/explain.
    Conservative: only route to build when there is a clear code/artifact request.
    Most conversational messages should be explain (Pneuma).
    """
    p = prompt.lower().strip()

    # Short greetings and acknowledgements — instant fast path
    if len(p) < 25 and any(p.startswith(w) for w in [
        "hi","hello","hey","thanks","ok","yes","no","sure","great",
        "cool","got it","sounds good","perfect","awesome"
    ]):
        return "fast"

    # Strong build signals — explicit code/artifact creation requests
    strong_build = [
        "write a ", "write me ", "build a ", "build me ", "create a ", "create me ",
        "make a ", "make me ", "generate a ", "generate me ",
        "code a ", "code me ", "implement ", "program a ",
        "```", "html file", "python script", "bash script", "sql query",
        "refactor ", "debug ", "fix the code", "fix this code",
        "react component", "javascript function", "typescript", "css for",
    ]
    if any(k in p for k in strong_build):
        return "build"

    # Language/tech keywords only count if paired with action words
    tech_langs = ["html","css","javascript","python","sql","bash","typescript","jsx","tsx"]
    action_words = ["write","build","create","make","generate","fix","debug","refactor","add","implement"]
    has_tech = any(lang in p for lang in tech_langs)
    has_action = any(act in p for act in action_words)
    if has_tech and has_action:
        return "build"

    return "explain"


# ── Memory helper ─────────────────────────────────────────────────────────────

async def build_system_with_memory(query: str) -> str:
    try:
        memories = await get_relevant_memories(query, n_results=4)
        if not memories:
            return LOGOS_SYSTEM_PROMPT
        memory_block = "\n\n[SEALED MEMORIES]\n"
        for i, mem in enumerate(memories, 1):
            memory_block += f"{i}. [{mem.get('type','Memory')}] {mem['text'][:200]}\n"
        return LOGOS_SYSTEM_PROMPT.replace("[MEMORY_INJECTION_POINT]", memory_block)
    except Exception:
        return LOGOS_SYSTEM_PROMPT


# ── Member selection ──────────────────────────────────────────────────────────

def select_member(intent: str) -> str:
    if intent in ("build",):
        return "techne"
    return "pneuma"  # explain, refine, research, council, fast all use pneuma


# ── System prompt overrides per intent ───────────────────────────────────────

def intent_system_prompt(intent: str, base: str) -> str:
    if intent == "refine":
        return base + "\n\nYour task is to improve, fix, or refine the user's work. Be precise and surgical. Explain what you changed and why."
    if intent == "research":
        return base + "\n\nConduct deep analysis. Be thorough, cite reasoning, explore multiple angles, and synthesize a comprehensive answer."
    if intent == "council":
        return base + "\n\nYou are the full Trilateral Council speaking as one unified voice. Reason deeply (Pneuma), consider structure and craft (Techne), and synthesize a complete, multi-faceted response."
    return base


# ── Main stream generator ─────────────────────────────────────────────────────

async def logos_stream_generator(messages: list, intent: str, system_prompt: str):
    # Check provider config
    cfg = load_config()
    provider = cfg.get("provider", "ollama")
    if provider == "groq" and not cfg.get("groq_key", "").strip():
        err = "No Groq API key set. Open Settings and add your free key from console.groq.com."
        yield f"data: {json.dumps({'type': 'content', 'content': err})}\n\n"
        yield f"data: {json.dumps({'type': 'done', 'member': 'logos', 'intent': intent})}\n\n"
        return

    # Council mode: Pneuma reasons first, then full response incorporates that
    if intent == "council":
        reasoning = ""
        try:
            reasoning_system = system_prompt + "\n\nFirst, produce a brief internal reasoning plan (2-3 sentences) of how you will approach this comprehensively."
            reasoning = await complete_once("pneuma", messages, system_override=reasoning_system, temperature=0.4)
        except Exception as e:
            reasoning = ""

        # Build augmented messages with reasoning context
        augmented = list(messages)
        if reasoning:
            # Inject reasoning as a system note, not as assistant turn, to avoid confusing the model
            council_system = intent_system_prompt("council", system_prompt)
            council_system += f"\n\n[INTERNAL REASONING PLAN]\n{reasoning}\n\nNow produce the full response based on this plan."
            async for chunk in stream_completion("pneuma", augmented, system_override=council_system):
                yield f"data: {json.dumps({'type': 'content', 'content': chunk})}\n\n"
        else:
            # Reasoning failed — just do a direct council response
            council_system = intent_system_prompt("council", system_prompt)
            async for chunk in stream_completion("pneuma", augmented, system_override=council_system):
                yield f"data: {json.dumps({'type': 'content', 'content': chunk})}\n\n"

        yield f"data: {json.dumps({'type': 'done', 'member': 'council', 'intent': intent})}\n\n"
        return

    # All other intents
    member = select_member(intent)
    final_system = intent_system_prompt(intent, system_prompt)

    async for chunk in stream_completion(member, messages, system_override=final_system):
        yield f"data: {json.dumps({'type': 'content', 'content': chunk})}\n\n"

    yield f"data: {json.dumps({'type': 'done', 'member': member, 'intent': intent})}\n\n"


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/chat")
async def logos_chat(request: ChatRequest):
    messages = [{"role": m.role, "content": m.content} for m in request.messages]
    last_user = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")
    intent = request.intent or detect_intent_fast(last_user)

    # "remember" intent: seal last user message to memory and confirm
    if intent == "remember":
        async def remember_stream():
            try:
                await seal_memory(SealRequest(text=last_user, type="Conversation"))
                msg = "✦ Sealed to memory. I will carry this forward."
            except Exception as e:
                msg = f"Memory seal failed: {str(e)}"
            yield f"data: {json.dumps({'type': 'content', 'content': msg})}\n\n"
            yield f"data: {json.dumps({'type': 'done', 'member': 'memory', 'intent': 'remember'})}\n\n"
        return StreamingResponse(remember_stream(), media_type="text/event-stream",
                                 headers={"Cache-Control":"no-cache","X-Accel-Buffering":"no"})

    if request.memory_enabled:
        system_prompt = await build_system_with_memory(last_user)
    else:
        system_prompt = LOGOS_SYSTEM_PROMPT

    return StreamingResponse(
        logos_stream_generator(messages, intent, system_prompt),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/intent")
async def analyze_intent(request: IntentRequest):
    intent = detect_intent_fast(request.prompt)
    return {"intent": intent, "confidence": 0.8}


@router.post("/vision")
async def logos_vision(file: UploadFile = File(...), prompt: str = "Describe this image in detail."):
    import base64
    contents = await file.read()
    b64 = base64.b64encode(contents).decode("utf-8")
    result = await vision_completion(b64, prompt, file.content_type or "image/png")
    return {"analysis": result, "member": "opsis"}


@router.get("/status")
async def logos_status():
    models_data = await get_loaded_models()
    models = models_data.get("ollama", []) if isinstance(models_data, dict) else []

    ollama_ok = False
    try:
        import httpx
        async with httpx.AsyncClient(timeout=3.0) as c:
            r = await c.get("http://localhost:11434/api/tags")
            ollama_ok = r.status_code == 200
            if ollama_ok:
                models = [m["name"] for m in r.json().get("models", [])]
    except Exception:
        pass

    council = {
        "pneuma": any("qwen3" in m or "llama" in m for m in models),
        "techne": any("coder" in m for m in models),
        "opsis":  any("vl" in m or "llava" in m for m in models),
    }
    if len(models) == 1:
        council["pneuma"] = True

    cfg = load_config()
    provider = cfg.get("provider", "ollama")

    from models import resolve_lmstudio_model
    assignments = {}
    if provider == "lmstudio":
        for m in ["pneuma", "techne", "opsis"]:
            try:
                assignments[m] = await resolve_lmstudio_model(m)
            except Exception:
                assignments[m] = None

    return {
        "logos": "active",
        "provider": provider,
        "ollama_running": ollama_ok,
        "council": council,
        "all_ready": ollama_ok,
        "available_models": models,
        "model_assignments": assignments,
    }
