import google.genai as genai
from google.genai import types
import os
import json
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

client = genai.Client(api_key=GEMINI_API_KEY)


def build_identify_prompt(collection_hint: str = None) -> str:
    """
    Build the identification prompt, optionally primed with a user-supplied
    collection name hint. When a hint is provided, Gemini is instructed to
    treat the image as belonging to that collection rather than guessing freely.
    """
    hint_block = ""
    if collection_hint and collection_hint.strip():
        hint_block = f"""
IMPORTANT: The user has told you this item belongs to the collection: "{collection_hint.strip()}"
Use this as strong guidance. Identify the specific item within that collection.
Set the display_name and category to reflect "{collection_hint.strip()}" rather than a broader category.
For category, use a slug version of the hint (e.g. "pokemon_games", "yugioh_cards", "one_piece_figures").
"""

    return f"""
You are an expert collector's assistant specializing in:
- Retro and modern video games (NES, SNES, N64, Game Boy, PlayStation, etc.)
- Gacha game characters (Genshin Impact, Honkai Star Rail, Blue Archive, etc.)
- Collectible figurines (anime, gaming, pop culture)
- Trading cards (Pokemon, Magic: The Gathering, Yu-Gi-Oh!, sports cards, etc.)
{hint_block}
Analyze this image and identify what you see. Return ONLY a valid JSON object with these fields:
{{
  "category": a short slug for the collection (e.g. "nes_games", "genshin_impact_characters", "pokemon_games"),
  "display_name": human-friendly collection name (e.g. "NES Games", "Pokemon Games"),
  "name": the specific item name (e.g. "Super Mario Bros.", "Hu Tao", "Charizard"),
  "description": a 1-2 sentence description of the item,
  "confidence": a float between 0 and 1 representing your confidence,
  "rarity": a short rarity string if applicable (e.g. "5-star", "Rare Holo", "Common") or null,
  "rarity_tier": one of ["common","uncommon","rare","super_rare","ultra_rare","legendary","unknown"],
  "price_estimate": estimated USD resale value as a float if you can reasonably estimate it, or null,
  "price_note": brief note on the price estimate (e.g. "loose cartridge, eBay avg") or null,
  "metadata": an object with extra fields relevant to the item type
}}

Be specific and accurate. If you cannot identify the item, set confidence below 0.3 and use "other" as the category.
Return ONLY the JSON object, no other text.
"""


def build_lookup_prompt(category: str, display_name: str) -> str:
    return f"""
Using your web search capability, find the most accurate and up-to-date answer to this question:

How many total items exist in the collection: "{display_name}" (category key: {category})?

Examples:
- "nes_games" / "NES Games" -> total officially licensed NES games ever released
- "genshin_impact_characters" / "Genshin Impact Characters" -> total playable characters currently in the game
- "pokemon_games" / "Pokemon Games" -> total mainline + spin-off Pokemon games released
- "yugioh_cards" / "Yu-Gi-Oh! Cards" -> total unique Yu-Gi-Oh! cards ever printed

Return ONLY a valid JSON object:
{{
  "total_count": <integer>,
  "source_note": "<brief note on where this count comes from>"
}}

Return ONLY the JSON object, no other text.
"""


async def identify_image(
    image_bytes: bytes,
    mime_type: str = "image/jpeg",
    collection_hint: str = None,
) -> dict:
    """
    Send an image to Gemini Vision and get back identification details.
    Optionally accepts a collection_hint from the user to guide identification.
    """
    prompt = build_identify_prompt(collection_hint)
    image_part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[image_part, prompt],
    )

    raw = response.text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    return json.loads(raw)


async def lookup_total_count(category: str, display_name: str) -> dict:
    """
    Use Gemini with Google Search grounding to look up total collection size.
    """
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
