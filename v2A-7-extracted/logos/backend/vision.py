"""
vision.py - Screenshot / image handling for Opsis (qwen2-vl:7b)
Accepts base64 image data and routes to the vision model.
"""

import base64
from pathlib import Path
from fastapi import APIRouter, UploadFile, File
from pydantic import BaseModel
from typing import Optional

from models import vision_completion

router = APIRouter()


class VisionRequest(BaseModel):
    image_b64: str
    prompt: Optional[str] = "Describe this image in thorough detail."
    mime_type: Optional[str] = "image/png"


@router.post("/analyze")
async def analyze_image(request: VisionRequest):
    """Analyze a base64-encoded image with Opsis."""
    result = await vision_completion(
        image_b64=request.image_b64,
        prompt=request.prompt,
        mime_type=request.mime_type,
    )
    return {"analysis": result, "member": "opsis"}


@router.post("/upload")
async def upload_and_analyze(
    file: UploadFile = File(...),
    prompt: str = "Describe this image in thorough detail.",
):
    """Accept a file upload, encode to base64, and send to Opsis."""
    contents = await file.read()
    b64 = base64.b64encode(contents).decode("utf-8")
    mime = file.content_type or "image/png"

    result = await vision_completion(
        image_b64=b64,
        prompt=prompt,
        mime_type=mime,
    )
    return {"analysis": result, "member": "opsis", "filename": file.filename}
