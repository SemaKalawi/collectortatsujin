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

# Rarity tiers (loosely universal across categories)
RarityType = Literal[
    "common",
    "uncommon",
    "rare",
    "super_rare",
    "ultra_rare",
    "legendary",
    "unknown",
]


class CollectionMeta(BaseModel):
    category: str
    display_name: str
    total_count: int
    description: Optional[str] = None
    last_updated: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CollectionItem(BaseModel):
    category: str
    name: str
    description: Optional[str] = None
    image_data: Optional[str] = None       # base64-encoded JPEG thumbnail
    confidence: Optional[float] = None
    rarity: Optional[str] = None           # e.g. "rare", "5-star", "uncommon"
    rarity_tier: Optional[RarityType] = None  # normalised tier for sorting
    price_estimate: Optional[float] = None    # estimated USD value
    price_note: Optional[str] = None          # e.g. "loose cartridge, eBay avg"
    added_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    metadata: Optional[dict] = None


class IdentifyResponse(BaseModel):
    category: str
    display_name: str
    name: str
    description: str
    confidence: float
    total_in_existence: int
    rarity: Optional[str] = None
    rarity_tier: Optional[RarityType] = None
    price_estimate: Optional[float] = None
    price_note: Optional[str] = None
    metadata: Optional[dict] = None


class AddItemRequest(BaseModel):
    category: str
    name: str
    description: Optional[str] = None
    confidence: Optional[float] = None
    rarity: Optional[str] = None
    rarity_tier: Optional[str] = None
    price_estimate: Optional[float] = None
    price_note: Optional[str] = None
    image_data: Optional[str] = None   # base64 JPEG
    metadata: Optional[dict] = None


class CollectionProgress(BaseModel):
    category: str
    display_name: str
    total_count: int
    owned_count: int
    progress_percent: float
    items: list[dict]


class AllCollectionsResponse(BaseModel):
    collections: list[CollectionProgress]
