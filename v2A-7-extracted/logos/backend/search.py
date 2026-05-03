"""
search.py - Optional SearXNG web search integration (Phase 3)
When enabled, gives Logos access to live web search results.
SearXNG must be running locally via Docker.
"""

import httpx
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, List

router = APIRouter()

SEARXNG_URL = "http://localhost:8888/search"


class SearchRequest(BaseModel):
    query: str
    num_results: Optional[int] = 5


class SearchResult(BaseModel):
    title: str
    url: str
    snippet: str


@router.post("/web")
async def web_search(request: SearchRequest):
    """
    Search the web via self-hosted SearXNG.
    Requires SearXNG running on localhost:8888.
    To enable: run 'docker run -d -p 8888:8080 searxng/searxng' in your terminal.
    """
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                SEARXNG_URL,
                params={
                    "q": request.query,
                    "format": "json",
                    "num_results": request.num_results,
                },
            )
            data = response.json()
            results = []
            for r in data.get("results", [])[:request.num_results]:
                results.append({
                    "title":   r.get("title", ""),
                    "url":     r.get("url", ""),
                    "snippet": r.get("content", ""),
                })
            return {"results": results, "query": request.query, "engine": "searxng"}
    except httpx.ConnectError:
        return {
            "results": [],
            "error": "SearXNG not running. Start it with: docker run -d -p 8888:8080 searxng/searxng",
            "enabled": False,
        }
    except Exception as e:
        return {"results": [], "error": str(e)}


@router.get("/status")
async def search_status():
    """Check if SearXNG is available."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get("http://localhost:8888/")
            return {"available": r.status_code == 200, "url": SEARXNG_URL}
    except Exception:
        return {"available": False, "url": SEARXNG_URL}
