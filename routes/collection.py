from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone
from models import AddItemRequest, CollectionProgress, AllCollectionsResponse
from database import get_db

router = APIRouter()


@router.post("/add", response_model=dict)
async def add_item(request: AddItemRequest):
    """
    Add an identified item to the user's collection.
    Prevents duplicate entries by checking name + category.
    """
    db = get_db()

    # Check for duplicate
    existing = await db.items.find_one({
        "category": request.category,
        "name": {"$regex": f"^{request.name}$", "$options": "i"},  # case-insensitive
    })

    if existing:
        return {
            "success": False,
            "message": f"'{request.name}' is already in your {request.category} collection.",
            "duplicate": True,
        }

    item_doc = {
        "category": request.category,
        "name": request.name,
        "description": request.description,
        "confidence": request.confidence,
        "metadata": request.metadata or {},
        "added_at": datetime.now(timezone.utc),
    }

    result = await db.items.insert_one(item_doc)

    return {
        "success": True,
        "message": f"'{request.name}' added to your collection!",
        "id": str(result.inserted_id),
    }


@router.get("/{category}", response_model=CollectionProgress)
async def get_collection(category: str):
    """
    Get progress for a specific collection category.
    """
    db = get_db()

    meta = await db.collection_meta.find_one({"category": category})
    if not meta:
        raise HTTPException(status_code=404, detail=f"No collection found for category: {category}")

    items_cursor = db.items.find({"category": category}).sort("added_at", -1)
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


@router.get("/", response_model=AllCollectionsResponse)
async def get_all_collections():
    """
    Get a summary of all collection categories and their progress.
    """
    db = get_db()

    # Get all categories the user has items in
    pipeline = [
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
            items=[],  # Omit full items list in summary view
        ))

    return AllCollectionsResponse(collections=collections)


@router.delete("/{category}/{item_name}", response_model=dict)
async def remove_item(category: str, item_name: str):
    """
    Remove an item from the collection by name and category.
    """
    db = get_db()

    result = await db.items.delete_one({
        "category": category,
        "name": {"$regex": f"^{item_name}$", "$options": "i"},
    })

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail=f"'{item_name}' not found in {category}.")

    return {"success": True, "message": f"'{item_name}' removed from your collection."}
