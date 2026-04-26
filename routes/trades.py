from fastapi import APIRouter, HTTPException, status, Depends
from database import get_db
from models import TradeResponse, SendTradeRequest, TradeOffer, Trade
from bson import ObjectId
from datetime import datetime, timezone

router = APIRouter()


def get_current_user(authorization: str = None) -> str:
    """Extract username from Bearer token."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    # Token format is base64(username:random), just extract username
    try:
        import base64
        token = authorization.replace("Bearer ", "")
        decoded = base64.b64decode(token).decode()
        username = decoded.split(":")[0]
        return username
    except:
        raise HTTPException(status_code=401, detail="Invalid token")


@router.get("/incoming")
async def get_incoming_trades(authorization: str = None):
    """Get all incoming trade requests for current user."""
    current_user = get_current_user(authorization)
    db = get_db()
    
    trades = await db.trades.find({"to_user": current_user}).to_list(None)
    
    result = []
    for t in trades:
        result.append({
            "id": str(t["_id"]),
            "from_user": t["from_user"],
            "to_user": t["to_user"],
            "offer": t["offer"],
            "wants": t["wants"],
            "status": t.get("status", "pending"),
            "note": t.get("note"),
            "created_at": t["created_at"],
            "updated_at": t["updated_at"],
        })
    
    return {"trades": result}


@router.get("/outgoing")
async def get_outgoing_trades(authorization: str = None):
    """Get all outgoing trade requests from current user."""
    current_user = get_current_user(authorization)
    db = get_db()
    
    trades = await db.trades.find({"from_user": current_user}).to_list(None)
    
    result = []
    for t in trades:
        result.append({
            "id": str(t["_id"]),
            "from_user": t["from_user"],
            "to_user": t["to_user"],
            "offer": t["offer"],
            "wants": t["wants"],
            "status": t.get("status", "pending"),
            "note": t.get("note"),
            "created_at": t["created_at"],
            "updated_at": t["updated_at"],
        })
    
    return {"trades": result}


@router.post("/")
async def send_trade(req: SendTradeRequest, authorization: str = None):
    """Create a new trade request."""
    current_user = get_current_user(authorization)
    db = get_db()
    
    # Verify target user exists
    target_user = await db.users.find_one({"username": req.target_user})
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User '{req.target_user}' not found"
        )
    
    # Build offer
    if req.offer_type == "item":
        if not req.offer_item:
            raise HTTPException(status_code=400, detail="Item name required for item offer")
        offer = {
            "offer_type": "item",
            "item_name": req.offer_item,
            "item_value": None,
            "money_amount": None,
        }
    else:  # money
        if req.offer_money is None or req.offer_money <= 0:
            raise HTTPException(status_code=400, detail="Valid amount required for cash offer")
        offer = {
            "offer_type": "money",
            "item_name": None,
            "item_value": None,
            "money_amount": req.offer_money,
        }
    
    trade_doc = {
        "from_user": current_user,
        "to_user": req.target_user,
        "offer": offer,
        "wants": req.want_item,
        "status": "pending",
        "note": req.note or None,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    
    result = await db.trades.insert_one(trade_doc)
    
    return {
        "id": str(result.inserted_id),
        "message": f"Trade request sent to {req.target_user}",
        **trade_doc,
    }


@router.patch("/{trade_id}/accept")
async def accept_trade(trade_id: str, authorization: str = None):
    """Accept an incoming trade request."""
    current_user = get_current_user(authorization)
    db = get_db()
    
    try:
        trade_oid = ObjectId(trade_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid trade ID")
    
    trade = await db.trades.find_one({"_id": trade_oid})
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    
    # Only recipient can accept
    if trade["to_user"] != current_user:
        raise HTTPException(status_code=403, detail="Not authorized to accept this trade")
    
    await db.trades.update_one(
        {"_id": trade_oid},
        {"$set": {"status": "accepted", "updated_at": datetime.now(timezone.utc)}}
    )
    
    return {"message": "Trade accepted", "trade_id": trade_id, "status": "accepted"}


@router.patch("/{trade_id}/decline")
async def decline_trade(trade_id: str, authorization: str = None):
    """Decline an incoming trade request."""
    current_user = get_current_user(authorization)
    db = get_db()
    
    try:
        trade_oid = ObjectId(trade_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid trade ID")
    
    trade = await db.trades.find_one({"_id": trade_oid})
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    
    # Only recipient can decline
    if trade["to_user"] != current_user:
        raise HTTPException(status_code=403, detail="Not authorized to decline this trade")
    
    await db.trades.update_one(
        {"_id": trade_oid},
        {"$set": {"status": "declined", "updated_at": datetime.now(timezone.utc)}}
    )
    
    return {"message": "Trade declined", "trade_id": trade_id, "status": "declined"}


@router.patch("/{trade_id}/cancel")
async def cancel_trade(trade_id: str, authorization: str = None):
    """Cancel an outgoing trade request."""
    current_user = get_current_user(authorization)
    db = get_db()
    
    try:
        trade_oid = ObjectId(trade_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid trade ID")
    
    trade = await db.trades.find_one({"_id": trade_oid})
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    
    # Only sender can cancel
    if trade["from_user"] != current_user:
        raise HTTPException(status_code=403, detail="Not authorized to cancel this trade")
    
    await db.trades.update_one(
        {"_id": trade_oid},
        {"$set": {"status": "cancelled", "updated_at": datetime.now(timezone.utc)}}
    )
    
    return {"message": "Trade request cancelled", "trade_id": trade_id, "status": "cancelled"}
