"""
router.py — Council routing: intent detection + member selection.
"""

from typing import Optional
from inference.prompts import build_system_prompt
from inference.engine import stream, complete


def detect_intent(prompt: str) -> str:
    """
    Fast keyword classifier. Returns: fast | build | explain | refine | research | council | remember
    """
    p = prompt.lower().strip()

    if len(p) < 25 and any(p.startswith(w) for w in [
        "hi","hello","hey","thanks","ok","yes","no","sure","great",
        "cool","got it","sounds good","perfect","awesome","nice",
    ]):
        return "fast"

    if any(k in p for k in ["remember this", "seal this", "save this to memory", "keep this"]):
        return "remember"

    strong_build = [
        "write a ", "write me ", "build a ", "build me ", "create a ", "create me ",
        "make a ", "make me ", "generate a ", "generate me ",
        "code a ", "implement ", "program a ",
        "```", "html file", "python script", "bash script", "sql query",
        "refactor ", "debug this", "fix the code", "fix this code",
        "react component", "javascript function", "css for",
        "dashboard", "chart", "graph", "table", "form", "app", "tool",
    ]
    if any(k in p for k in strong_build):
        return "build"

    tech_langs = ["html","css","javascript","python","sql","bash","typescript","jsx","tsx"]
    action_words = ["write","build","create","make","generate","fix","debug","refactor","add","implement"]
    has_tech   = any(lang in p for lang in tech_langs)
    has_action = any(act in p for act in action_words)
    if has_tech and has_action:
        return "build"

    if any(k in p for k in ["improve this", "make it better", "clean up", "refine this", "edit this"]):
        return "refine"

    if any(k in p for k in ["research", "deep dive", "analyze", "compare", "explain thoroughly",
                             "what are all", "comprehensive", "in depth"]):
        return "research"

    if any(k in p for k in ["council", "all three", "full council", "deliberate"]):
        return "council"

    return "explain"


def select_member(intent: str) -> str:
    if intent == "build":
        return "techne"
    return "pneuma"


async def route_stream(
    messages: list,
    intent: str,
    memories: Optional[list] = None,
    active_skills: Optional[list] = None,
):
    """Yields (chunk: str) tokens for the given intent."""
    member = select_member(intent)
    system = build_system_prompt(intent, memories, active_skills)

    if intent == "council":
        # Brief internal reasoning pass with Pneuma, then full response
        reasoning = ""
        try:
            plan_system = system + "\n\nFirst produce a brief 2-3 sentence internal reasoning plan."
            reasoning = await complete("pneuma", messages, plan_system)
        except Exception:
            pass

        if reasoning:
            augmented_system = system + f"\n\n[INTERNAL PLAN]\n{reasoning}\n\nNow produce the full response."
        else:
            augmented_system = system

        async for chunk in stream("pneuma", messages, augmented_system):
            yield chunk
        return

    async for chunk in stream(member, messages, system):
        yield chunk
