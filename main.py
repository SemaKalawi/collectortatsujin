from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn

from routes import identify, collection
from routes import auth
from database import connect_db, close_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    yield
    await close_db()


app = FastAPI(
    title="CollectorTatsujin API",
    description="AI-powered collection tracker for games, figurines, gacha characters, and trading cards.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tighten this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(identify.router, prefix="/identify", tags=["Identify"])
app.include_router(collection.router, prefix="/collection", tags=["Collection"])


@app.get("/")
async def root():
    return {"message": "CollectorTatsujin API is running."}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
