from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime, timezone


# Supported collection categories
CategoryType = Literal[
    "nes_games",
    "snes_games",
    "n64_games",
    "gameboy_games",
    "retro_games",
    "genshin_impact_characters",
    "honkai_star_rail_characters",
    "gacha_characters",
    "figurines",
    "trading_cards",
    "other",
]


class CollectionMeta(BaseModel):
    """
    Stores metadata about a collection category:
    the total goal count and a friendly display name.
    """
    category: str
    display_name: str
    total_count: int  # AI-looked-up total (e.g. 714 NES games)
    description: Optional[str] = None
    last_updated: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CollectionItem(BaseModel):
    """
    Represents a single item in a user's collection.
    """
    category: str
    name: str                          # e.g. "Super Mario Bros."
    description: Optional[str] = None  # Short description returned by Gemini
    image_url: Optional[str] = None    # Optional: URL or base64 thumbnail
    confidence: Optional[float] = None # Gemini's confidence in the identification
    added_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    metadata: Optional[dict] = None    # Flexible field for extra info (year, publisher, etc.)


class IdentifyResponse(BaseModel):
    """Response returned after Gemini identifies an image."""
    category: str
    display_name: str
    name: str
    description: str
    confidence: float
    total_in_existence: int
    metadata: Optional[dict] = None


class AddItemRequest(BaseModel):
    """Request body to add an identified item to the collection."""
    category: str
    name: str
    description: Optional[str] = None
    confidence: Optional[float] = None
    metadata: Optional[dict] = None


class CollectionProgress(BaseModel):
    """Progress summary for a single category."""
    category: str
    display_name: str
    total_count: int
    owned_count: int
    progress_percent: float
    items: list[dict]


class AllCollectionsResponse(BaseModel):
    """Summary of all collections."""
    collections: list[CollectionProgress]
