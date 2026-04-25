import google.genai as genai
from google.genai import types
import os
import json
import base64
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

client = genai.Client(api_key=GEMINI_API_KEY)

# Rarity tier mapping — used to normalise category-specific rarity labels
RARITY_TIER_MAP = {
    # Common aliases
    "common": "common",
    "n": "common",           # Pokémon
    "normal": "common",
    "1-star": "common",
    "uncommon": "uncommon",
    "u": "uncommon",
    "2-star": "uncommon",
    "rare": "rare",
    "r": "rare",
    "3-star": "rare",
    "4-star": "rare",
    "super rare": "super_rare",
    "sr": "super_rare",
    "double rare": "super_rare",
    "ultra rare": "ultra_rare",
    "ur": "ultra_rare",
    "5-star": "ultra_rare",
    "secret rare": "ultra_rare",
    "secret": "ultra_rare",
    "hyper rare": "ultra_rare",
    "legendary": "legendary",
    "6-star": "legendary",
    "special illustration rare": "legendary",
    "sir": "legendary",
    "rainbow rare": "legendary",
}

IDENTIFY_PROMPT = """
You are an expert collector's assistant specialising in:
- Retro and modern video games (NES, SNES, N64, Game Boy, PlayStation, etc.)
- Gacha game characters (Genshin Impact, Honkai Star Rail, Blue Archive, etc.)
- Collectible figurines (anime, gaming, pop culture)
- Trading cards (Pokémon, Magic: The Gathering, Yu-Gi-Oh!, sports cards, etc.)

Analyse this image and identify what you see. Return ONLY a valid JSON object with these exact fields:
{
  "category": one of ["nes_games","snes_games","n64_games","gameboy_games","retro_games","genshin_impact_characters","honkai_star_rail_characters","gacha_characters","figurines","trading_cards","other"],
  "display_name": human-friendly category name (e.g. "NES Games", "Pokémon Cards"),
  "name": specific item name (e.g. "Super Mario Bros.", "Hu Tao", "Charizard VMAX"),
  "description": 1–2 sentence description,
  "confidence": float 0–1,
  "rarity": the item's rarity label as it appears in its category (e.g. "5-star", "Rare Holo", "Ultra Rare", "common", "Super Rare"). Use null if not applicable (e.g. most video games),
  "rarity_tier": normalise rarity to one of ["common","uncommon","rare","super_rare","ultra_rare","legendary","unknown"]. Use "unknown" when rarity is null or unclear,
  "price_estimate": estimated current market value in USD as a float (loose/ungraded condition where relevant). Use your knowledge of recent sold listings. Return null if truly unknown,
  "price_note": brief note about the price estimate, e.g. "loose cartridge, avg eBay sold" or "PSA 10 graded". Return null if price_estimate is null,
  "metadata": object with relevant extra fields. For games: {"year": 1985, "publisher": "Nintendo", "platform": "NES"}. For gacha: {"element": "Pyro", "rarity": "5-star", "game": "Genshin Impact"}. For cards: {"set": "Base Set", "number": "4/102", "grade": "ungraded"}
}

Return ONLY the JSON object, no markdown, no extra text.
"""


def build_lookup_prompt(category: str, display_name: str) -> str:
    return f"""
Using your web search capability, find the most accurate and up-to-date answer:

How many total items exist in the collection category: "{display_name}" (key: {category})?

Examples:
- "nes_games" → total officially licensed NES games ever released
- "genshin_impact_characters" → total playable characters currently in Genshin Impact
- "trading_cards" → if a specific set, how many cards in that set

Return ONLY a valid JSON object:
{{
  "total_count": <integer>,
  "source_note": "<brief note on source>"
}}

Return ONLY the JSON, no markdown, no extra text.
"""


def normalise_rarity_tier(raw_rarity: str | None) -> str:
    """Map a raw rarity string to a canonical tier."""
    if not raw_rarity:
        return "unknown"
    key = raw_rarity.lower().strip()
    return RARITY_TIER_MAP.get(key, "unknown")


async def identify_image(image_bytes: bytes, mime_type: str = "image/jpeg") -> dict:
    image_part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[image_part, IDENTIFY_PROMPT],
    )

    raw = response.text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    data = json.loads(raw)

    # Normalise rarity tier if Gemini didn't return a valid one
    if data.get("rarity_tier") not in [
        "common", "uncommon", "rare", "super_rare", "ultra_rare", "legendary", "unknown"
    ]:
        data["rarity_tier"] = normalise_rarity_tier(data.get("rarity"))

    return data


async def lookup_total_count(category: str, display_name: str) -> dict:
    prompt = build_lookup_prompt(category, display_name)

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
            tools=[types.Tool(google_search=types.GoogleSearch())]
        ),
    )

    raw = "".join(
        block.text for block in response.candidates[0].content.parts
        if hasattr(block, "text")
    ).strip()

    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    start = raw.find("{")
    end = raw.rfind("}") + 1
    if start != -1 and end != 0:
        raw = raw[start:end]

    return json.loads(raw)
