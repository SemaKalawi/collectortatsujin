from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from datetime import datetime, timedelta, timezone
from database import get_db
import bcrypt
import jwt
import os

router = APIRouter()
security = HTTPBearer()

JWT_SECRET = os.getenv("JWT_SECRET", "change-this-secret-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 24 * 30  # 30 days


class RegisterRequest(BaseModel):
    username: str
    password: str


class LoginRequest(BaseModel):
    username: str
    password: str


def create_token(user_id: str, username: str) -> str:
    payload = {
        "sub": user_id,
        "username": username,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token.")


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    return decode_token(credentials.credentials)


@router.post("/register")
async def register(request: RegisterRequest):
    db = get_db()

    if len(request.username.strip()) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters.")
    if len(request.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    existing = await db.users.find_one({"username": {"$regex": f"^{request.username.strip()}$", "$options": "i"}})
    if existing:
        raise HTTPException(status_code=409, detail="Username already taken.")

    hashed = bcrypt.hashpw(request.password.encode(), bcrypt.gensalt()).decode()
    result = await db.users.insert_one({
        "username": request.username.strip(),
        "password_hash": hashed,
        "created_at": datetime.now(timezone.utc),
    })

    token = create_token(str(result.inserted_id), request.username.strip())
    return {"token": token, "username": request.username.strip()}


@router.post("/login")
async def login(request: LoginRequest):
    db = get_db()

    user = await db.users.find_one({"username": {"$regex": f"^{request.username.strip()}$", "$options": "i"}})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password.")

    if not bcrypt.checkpw(request.password.encode(), user["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="Invalid username or password.")

    token = create_token(str(user["_id"]), user["username"])
    return {"token": token, "username": user["username"]}


@router.get("/me")
async def me(current_user: dict = Depends(get_current_user)):
    return {"username": current_user["username"], "user_id": current_user["sub"]}
