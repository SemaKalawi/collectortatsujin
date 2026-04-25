import google.genai as genai
from google.genai import types
import os
import json
import base64
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

client = genai.Client(api_key=GEMINI_API_KEY)

# Prompt for image identification
IDENTIFY_PROMPT = """
You are an expert collector's assistant specializing in:
- Retro and modern video games (NES, SNES, N64, Game Boy, PlayStation, etc.)
- Gacha game characters (Genshin Impact, Honkai Star Rail, Blue Archive, etc.)
- Collectible figurines (anime, gaming, pop culture)
- Trading cards (Pokémon, Magic: The Gathering, Yu-Gi-Oh!, sports cards, etc.)

Analyze this image and identify what you see. Return ONLY a valid JSON object with these fields:
{
  "category": one of ["nes_games", "snes_games", "n64_games", "gameboy_games", "retro_games", "genshin_impact_characters", "honkai_star_rail_characters", "gacha_characters", "figurines", "trading_cards", "other"],
  "display_name": human-friendly category name (e.g. "NES Games", "Genshin Impact Characters"),
  "name": the specific item name (e.g. "Super Mario Bros.", "Hu Tao", "Charizard"),
  "description": a 1-2 sentence description of the item,
  "confidence": a float between 0 and 1 representing your confidence,
  "metadata": an object with relevant extra fields (e.g. {"year": 1985, "publisher": "Nintendo"} for games, {"element": "Pyro", "rarity": "5-star"} for gacha characters)
}

Be specific and accurate. If you cannot identify the item, set confidence below 0.3 and use "other" as the category.
Return ONLY the JSON object, no other text.
"""

# Prompt for web search grounding — looks up total collection size
def build_lookup_prompt(category: str, display_name: str) -> str:
    return f"""
Using your web search capability, find the most accurate and up-to-date answer to this question:

How many total items exist in the collection category: "{display_name}" (internal key: {category})?

Examples of what I mean:
- "nes_games" → total number of officially licensed NES games ever released
- "genshin_impact_characters" → total number of playable characters currently in Genshin Impact
- "trading_cards" → if this is a specific set, how many cards in that set

Return ONLY a valid JSON object:
{{
  "total_count": <integer>,
  "source_note": "<brief note about where this count comes from>"
}}

Return ONLY the JSON object, no other text.
"""


async def identify_image(image_bytes: bytes, mime_type: str = "image/jpeg") -> dict:
    """
    Send an image to Gemini Vision and get back identification details.
    """
    image_part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[image_part, IDENTIFY_PROMPT],
    )

    raw = response.text.strip()
    # Strip markdown code fences if present
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

    # Collect all text blocks (search grounding may produce multiple)
    raw = "".join(
        block.text for block in response.candidates[0].content.parts
        if hasattr(block, "text")
    ).strip()

    # Strip markdown fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    # Extract just the JSON object if there's extra text
    start = raw.find("{")
    end = raw.rfind("}") + 1
    if start != -1 and end != 0:
        raw = raw[start:end]

    return json.loads(raw)
