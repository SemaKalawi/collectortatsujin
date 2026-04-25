from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import ConnectionFailure
import os
from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "collectortatsujin")

client: AsyncIOMotorClient = None
db = None


async def connect_db():
    global client, db
    try:
        client = AsyncIOMotorClient(MONGODB_URI)
        db = client[DB_NAME]
        # Ping to confirm connection
        await client.admin.command("ping")
        print(f"Connected to MongoDB Atlas: {DB_NAME}")
    except ConnectionFailure as e:
        print(f"Failed to connect to MongoDB: {e}")
        raise


async def close_db():
    global client
    if client:
        client.close()
        print("MongoDB connection closed.")


def get_db():
    return db
