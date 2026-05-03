"""
web_search.py — Web search and page fetch for Logos.
Supports SearXNG (self-hosted) and direct URL fetch.
"""

import httpx
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, List

router     = APIRouter()
SEARXNG_URL = "http://localhost:8888/search"


class SearchRequest(BaseModel):
    query: str
    num_results: Optional[int] = 5


class FetchRequest(BaseModel):
    url: str
    max_chars: Optional[int] = 8000


@router.post("/search")
async def web_search(request: SearchRequest):
    """Full-text search via local SearXNG instance."""
    try:
        async with httpx.AsyncClient(timeout=15.0) as c:
            r = await c.get(SEARXNG_URL, params={"q": request.query, "format": "json"})
            data = r.json()
            results = [
                {"title": x.get("title",""), "url": x.get("url",""), "snippet": x.get("content","")}
                for x in data.get("results", [])[:request.num_results]
            ]
            return {"results": results, "query": request.query, "engine": "searxng"}
    except httpx.ConnectError:
        return {"results": [], "error": "SearXNG not running. Start with: docker run -d -p 8888:8080 searxng/searxng", "enabled": False}
    except Exception as e:
        return {"results": [], "error": str(e)}


@router.post("/fetch")
async def fetch_page(request: FetchRequest):
    """Fetch and return plain text content of a URL for Logos context injection."""
    try:
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as c:
            r = await c.get(request.url, headers={"User-Agent": "Mozilla/5.0"})
            r.raise_for_status()
            content_type = r.headers.get("content-type", "")
            if "html" in content_type:
                # Basic HTML stripping
                import re
                text = re.sub(r'<script[\s\S]*?</script>', '', r.text, flags=re.IGNORECASE)
                text = re.sub(r'<style[\s\S]*?</style>',  '', text, flags=re.IGNORECASE)
                text = re.sub(r'<[^>]+>', ' ', text)
                text = re.sub(r'\s+', ' ', text).strip()
            else:
                text = r.text
            return {
                "url":     request.url,
                "content": text[:request.max_chars],
                "chars":   len(text),
                "truncated": len(text) > request.max_chars,
            }
    except httpx.HTTPStatusError as e:
        return {"error": f"HTTP {e.response.status_code}", "url": request.url}
    except Exception as e:
        return {"error": str(e), "url": request.url}


@router.get("/status")
async def search_status():
    try:
        async with httpx.AsyncClient(timeout=5.0) as c:
            r = await c.get("http://localhost:8888/")
            return {"available": r.status_code == 200, "url": SEARXNG_URL}
    except Exception:
        return {"available": False, "url": SEARXNG_URL}
