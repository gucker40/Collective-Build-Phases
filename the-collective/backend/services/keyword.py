"""
keyword.py — Keyword extraction for auto-titling and Mind Map node generation.
Pure NLP, no model calls needed.
"""

import re
from typing import List

STOP_WORDS = {
    "a","an","the","is","are","was","were","be","been","being","have","has","had",
    "do","does","did","will","would","could","should","may","might","can","shall",
    "i","my","me","we","our","you","your","it","its","this","that","these","those",
    "what","how","why","when","where","who","which","please","help","make","let",
    "create","write","tell","show","give","get","find","need","want","use","used",
    "like","just","also","then","than","into","from","with","about","through",
    "some","any","all","more","most","very","much","many","few","new","old",
    "and","or","but","not","if","so","as","at","by","for","in","of","on","to","up",
    "build","generate","explain","describe","can","hi","hello","hey","ok","sure",
}


def extract_keywords(text: str, max_words: int = 6) -> List[str]:
    """Return the top meaningful keywords from text."""
    text = re.sub(r'```[\s\S]*?```', '', text)
    text = re.sub(r'[#*`_\[\]()\n]', ' ', text)
    text = re.sub(r'https?://\S+', '', text)
    text = re.sub(r'\s+', ' ', text).strip()

    words = re.findall(r'\b[a-zA-Z]{3,}\b', text)
    seen  = set()
    keywords = []
    for w in words:
        clean = w.lower()
        if clean not in STOP_WORDS and clean not in seen:
            seen.add(clean)
            keywords.append(w)
        if len(keywords) >= max_words:
            break
    return keywords


def auto_title(text: str, max_words: int = 4) -> str:
    """Generate a 2-4 word title from arbitrary text."""
    keywords = extract_keywords(text, max_words)
    if not keywords:
        words = text.split()[:max_words]
        return " ".join(words)[:45] if words else "Untitled"
    title = " ".join(keywords[:max_words])
    title = " ".join(w.capitalize() if w.lower() == w else w for w in title.split())
    return title[:45]


def build_mindmap_nodes(items: List[dict]) -> dict:
    """
    Build node list for D3 force-directed graph.
    Each item: { id, type, title, content?, created_at? }
    Returns { nodes, edges }
    """
    type_colors = {
        "chat":       "#a07aff",
        "artifact":   "#f0c040",
        "note":       "#60b8ff",
        "task":       "#50d890",
        "memory":     "#ff9060",
        "transaction": "#50c8e8",
    }

    nodes = []
    for item in items:
        itype = item.get("type", "chat")
        nodes.append({
            "id":    f"{itype}_{item['id']}",
            "label": item.get("title") or auto_title(item.get("content", "")),
            "type":  itype,
            "color": type_colors.get(itype, "#a07aff"),
            "source_id": item["id"],
            "keywords": extract_keywords(item.get("content", item.get("title", "")), 3),
        })

    # Build edges based on shared keywords
    edges = []
    for i, a in enumerate(nodes):
        for b in nodes[i + 1:]:
            shared = set(a["keywords"]) & set(b["keywords"])
            if shared:
                edges.append({
                    "source": a["id"],
                    "target": b["id"],
                    "weight": len(shared),
                })

    return {"nodes": nodes, "edges": edges}
