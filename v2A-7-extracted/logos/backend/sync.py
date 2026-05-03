"""
sync.py - Google Drive bidirectional sync (Phase 4)
Syncs the local vault with Google Drive using OAuth.
Placeholder - full implementation in Phase 4.
"""

from fastapi import APIRouter

router = APIRouter()


@router.post("/trigger")
async def trigger_sync():
    """Trigger a manual sync with Google Drive. (Phase 4)"""
    return {
        "status": "pending",
        "message": "Google Drive sync is scheduled for Phase 4.",
        "phase": 4,
    }


@router.get("/status")
async def sync_status():
    """Get sync status."""
    return {
        "enabled": False,
        "last_sync": None,
        "message": "Phase 4 feature - not yet implemented.",
    }
