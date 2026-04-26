from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from models import AddItemRequest, CollectionProgress, AllCollectionsResponse
from database import get_db
from routes.auth import get_current_user

router = APIRouter()


@router.post("/add", response_model=dict)
async def add_item(request: AddItemRequest, current_user: dict = Depends(get_current_user)):
    """
    Add an identified item to the user's collection.
    Prevents duplicates by name + category (case-insensitive) per user.
    """
    db = get_db()
    user_id = current_user["sub"]

    existing = await db.items.find_one({
        "user_id": user_id,
        "category": request.category,
        "name": {"$regex": f"^{request.name}$", "$options": "i"},
    })

    if existing:
        return {
            "success": False,
            "message": f"'{request.name}' is already in your {request.category} collection.",
            "duplicate": True,
        }

    item_doc = {
        "user_id": user_id,
        "category": request.category,
        "name": request.name,
        "description": request.description,
        "confidence": request.confidence,
        "rarity": request.rarity,
        "rarity_tier": request.rarity_tier,
        "price_estimate": request.price_estimate,
        "price_note": request.price_note,
        "image_data": request.image_data,
        "metadata": request.metadata or {},
        "added_at": datetime.now(timezone.utc),
    }

    result = await db.items.insert_one(item_doc)

    return {
        "success": True,
        "message": f"'{request.name}' added to your collection!",
        "id": str(result.inserted_id),
    }


@router.get("/", response_model=AllCollectionsResponse)
async def get_all_collections(current_user: dict = Depends(get_current_user)):
    db = get_db()
    user_id = current_user["sub"]

    pipeline = [
        {"$match": {"user_id": user_id}},
        {"$group": {"_id": "$category", "owned_count": {"$sum": 1}}},
    ]
    category_counts = {}
    async for doc in db.items.aggregate(pipeline):
        category_counts[doc["_id"]] = doc["owned_count"]

    if not category_counts:
        return AllCollectionsResponse(collections=[])

    collections = []
    for category, owned in category_counts.items():
        meta = await db.collection_meta.find_one({"category": category})
        total = meta.get("total_count", 0) if meta else 0
        display_name = meta.get("display_name", category) if meta else category
        progress = round((owned / total * 100), 2) if total > 0 else 0.0

        collections.append(CollectionProgress(
            category=category,
            display_name=display_name,
            total_count=total,
            owned_count=owned,
            progress_percent=progress,
            items=[],
        ))

    return AllCollectionsResponse(collections=collections)


@router.get("/{category}", response_model=CollectionProgress)
async def get_collection(category: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    user_id = current_user["sub"]

    meta = await db.collection_meta.find_one({"category": category})
    if not meta:
        raise HTTPException(status_code=404, detail=f"No collection found for: {category}")

    items_cursor = db.items.find({"user_id": user_id, "category": category}).sort("added_at", -1)
    items = []
    async for item in items_cursor:
        item["_id"] = str(item["_id"])
        item["added_at"] = item["added_at"].isoformat()
        items.append(item)

    owned = len(items)
    total = meta.get("total_count", 0)
    progress = round((owned / total * 100), 2) if total > 0 else 0.0

    return CollectionProgress(
        category=category,
        display_name=meta.get("display_name", category),
        total_count=total,
        owned_count=owned,
        progress_percent=progress,
        items=items,
    )


@router.delete("/{category}", response_model=dict)
async def delete_collection(category: str, current_user: dict = Depends(get_current_user)):
    """Delete all of the current user's items in a category."""
    db = get_db()
    user_id = current_user["sub"]

    result = await db.items.delete_many({"user_id": user_id, "category": category})

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail=f"No items found in '{category}' to delete.")

    return {
        "success": True,
        "message": f"Deleted {result.deleted_count} item(s) from your {category} collection.",
        "deleted_count": result.deleted_count,
    }


@router.delete("/{category}/{item_name}", response_model=dict)
async def remove_item(category: str, item_name: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    user_id = current_user["sub"]

    result = await db.items.delete_one({
        "user_id": user_id,
        "category": category,
        "name": {"$regex": f"^{item_name}$", "$options": "i"},
    })

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail=f"'{item_name}' not found in {category}.")

    return {"success": True, "message": f"'{item_name}' removed from your collection."}
