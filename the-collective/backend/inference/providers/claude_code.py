"""
claude_code.py — Last-resort fallback to Anthropic Claude API.
Only invoked when Logos raises an explicit fallback flag or the user requests it.
Requires an Anthropic API key in secrets.json.
"""

from typing import AsyncGenerator, Optional

FALLBACK_MODEL = "claude-sonnet-4-6"


async def stream(
    messages: list,
    api_key: str,
    model: str = FALLBACK_MODEL,
    system: Optional[str] = None,
) -> AsyncGenerator[str, None]:
    try:
        import anthropic
    except ImportError:
        yield "*Anthropic SDK not installed. Run: pip install anthropic*"
        return

    if not api_key:
        yield "*No Anthropic API key configured — add it in Config → Provider Settings.*"
        return

    # Separate system message from conversation
    sys_msg = system or ""
    conv = [m for m in messages if m["role"] != "system"]
    if not sys_msg:
        for m in messages:
            if m["role"] == "system":
                sys_msg = m["content"]
                break

    try:
        client = anthropic.AsyncAnthropic(api_key=api_key)
        kwargs: dict = {
            "model": model,
            "max_tokens": 8192,
            "messages": conv,
        }
        if sys_msg:
            kwargs["system"] = sys_msg

        async with client.messages.stream(**kwargs) as stream_ctx:
            async for text in stream_ctx.text_stream:
                yield text

    except anthropic.AuthenticationError:
        yield "*Invalid Anthropic API key — check Config → Provider Settings.*"
    except anthropic.RateLimitError:
        yield "*Anthropic rate limit reached — try again in a moment.*"
    except Exception as e:
        yield f"*Claude API error: {str(e)[:200]}*"


async def complete(
    messages: list,
    api_key: str,
    model: str = FALLBACK_MODEL,
    system: Optional[str] = None,
) -> str:
    result = ""
    async for chunk in stream(messages, api_key, model, system):
        result += chunk
    return result
