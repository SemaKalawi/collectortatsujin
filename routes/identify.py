from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Form
from typing import Optional
from models import IdentifyResponse
from services.gemini_service import identify_image, lookup_total_count
from database import get_db
from routes.auth import get_current_user

router = APIRouter()

SUPPORTED_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
}


@router.post("/", response_model=IdentifyResponse)
async def identify(
    file: UploadFile = File(...),
    collection_hint: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user),
):
    """
    Upload an image to identify what it is.

    Optionally pass collection_hint (a plain-text form field) to prime
    Gemini toward a specific collection — e.g. "Pokemon Games" instead of
    letting it guess "Nintendo Switch Games".
    """
    if file.content_type not in SUPPORTED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.content_type}."
        )

    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        identification = await identify_image(
            image_bytes,
            mime_type=file.content_type,
            collection_hint=collection_hint,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini identification failed: {str(e)}")

    category = identification.get("category", "other")
    display_name = identification.get("display_name", "Unknown Category")

    db = get_db()
    existing_meta = await db.collection_meta.find_one({"category": category})

    if existing_meta:
        total_count = existing_meta["total_count"]
    else:
        try:
            lookup = await lookup_total_count(category, display_name)
            total_count = lookup.get("total_count", 0)
            source_note = lookup.get("source_note", "")
        except Exception as e:
            total_count = 0
            source_note = f"Lookup failed: {str(e)}"

        await db.collection_meta.update_one(
            {"category": category},
            {"$set": {
                "category": category,
                "display_name": display_name,
                "total_count": total_count,
                "source_note": source_note,
            }},
            upsert=True,
        )

    return IdentifyResponse(
        category=category,
        display_name=display_name,
        name=identification.get("name", "Unknown"),
        description=identification.get("description", ""),
        confidence=identification.get("confidence", 0.0),
        total_in_existence=total_count,
        rarity=identification.get("rarity"),
        rarity_tier=identification.get("rarity_tier", "unknown"),
        price_estimate=identification.get("price_estimate"),
        price_note=identification.get("price_note"),
        metadata=identification.get("metadata"),
    )
