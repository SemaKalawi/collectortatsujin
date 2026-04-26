from fastapi import APIRouter, HTTPException, status
from database import get_db
from models import User, LoginRequest, AuthResponse
import hashlib
import secrets
import base64

router = APIRouter()


def hash_password(password: str) -> str:
    """Simple password hashing with salt."""
    salt = secrets.token_hex(16)
    pwd_hash = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100000)
    return f"{salt}${pwd_hash.hex()}"


def verify_password(password: str, password_hash: str) -> bool:
    """Verify password against hash."""
    try:
        salt, pwd_hash = password_hash.split("$")
        pwd_check = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100000)
        return pwd_check.hex() == pwd_hash
    except:
        return False


def generate_token(username: str) -> str:
    """Generate a simple JWT-like token."""
    payload = f"{username}:{secrets.token_hex(32)}"
    return base64.b64encode(payload.encode()).decode()


@router.post("/register", response_model=AuthResponse)
async def register(req: LoginRequest):
    """Register a new user."""
    db = get_db()
    
    # Check if user already exists
    existing = await db.users.find_one({"username": req.username})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken."
        )
    
    # Create new user
    user_doc = {
        "username": req.username,
        "password_hash": hash_password(req.password),
    }
    result = await db.users.insert_one(user_doc)
    
    token = generate_token(req.username)
    return AuthResponse(token=token, username=req.username)


@router.post("/login", response_model=AuthResponse)
async def login(req: LoginRequest):
    """Login an existing user."""
    db = get_db()
    
    # Find user
    user = await db.users.find_one({"username": req.username})
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password."
        )
    
    token = generate_token(req.username)
    return AuthResponse(token=token, username=req.username)
