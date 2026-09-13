import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
APP_URL = os.getenv("APP_URL", "http://localhost:8000")

# Embedding & LLM Models
EMBEDDING_MODEL = "gemini-embedding-001"
CHAT_MODEL = "gemini-3.6-flash"

def has_gemini_key() -> bool:
    return bool(GEMINI_API_KEY and len(GEMINI_API_KEY.strip()) > 10 and not GEMINI_API_KEY.startswith("MY_"))
