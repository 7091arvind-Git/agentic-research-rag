import hashlib
import time
from typing import Optional, Dict
from backend.models import User

# In-memory user database
USERS_DB: Dict[str, dict] = {
    "demo@college.edu": {
        "id": "usr_demo_student",
        "name": "Alex Turner (Demo Student)",
        "email": "demo@college.edu",
        "password_hash": hashlib.sha256("demo123".encode()).hexdigest(),
        "createdAt": "2026-09-01T10:00:00.000Z",
    },
    "arvind.ai@example.com": {
        "id": "usr_demo_1",
        "name": "Dr. Arvind (AIML Researcher)",
        "email": "arvind.ai@example.com",
        "password_hash": hashlib.sha256("password123".encode()).hexdigest(),
        "createdAt": "2026-09-01T10:00:00.000Z",
    },
}

# Active user sessions: token -> user_dict
SESSIONS_DB: Dict[str, dict] = {
    "token_demo_student": USERS_DB["demo@college.edu"],
    "token_demo_arvind": USERS_DB["arvind.ai@example.com"],
}

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def register_user(name: str, email: str, password: str) -> dict:
    email_clean = email.strip().lower()
    if email_clean in USERS_DB:
        raise ValueError("An account with this email already exists.")
    
    user_id = f"usr_{int(time.time())}_{hashlib.md5(email_clean.encode()).hexdigest()[:6]}"
    user_data = {
        "id": user_id,
        "name": name.strip(),
        "email": email_clean,
        "password_hash": hash_password(password),
        "createdAt": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
    }
    USERS_DB[email_clean] = user_data
    token = f"tok_{user_id}_{int(time.time())}"
    SESSIONS_DB[token] = user_data
    return {
        "token": token,
        "user": {
            "id": user_data["id"],
            "name": user_data["name"],
            "email": user_data["email"],
            "createdAt": user_data["createdAt"],
        }
    }

def login_user(email: str, password: str) -> dict:
    email_clean = email.strip().lower()
    user_data = USERS_DB.get(email_clean)
    if not user_data or user_data["password_hash"] != hash_password(password):
        raise ValueError("Invalid email or password.")
    
    token = f"tok_{user_data['id']}_{int(time.time())}"
    SESSIONS_DB[token] = user_data
    return {
        "token": token,
        "user": {
            "id": user_data["id"],
            "name": user_data["name"],
            "email": user_data["email"],
            "createdAt": user_data["createdAt"],
        }
    }

def get_user_from_token(auth_header: Optional[str]) -> Optional[User]:
    default_demo = USERS_DB.get("demo@college.edu") or USERS_DB.get("arvind.ai@example.com")
    if not auth_header:
        if default_demo:
            return User(
                id=default_demo["id"],
                name=default_demo["name"],
                email=default_demo["email"],
                createdAt=default_demo["createdAt"]
            )
        return None
    token = auth_header.replace("Bearer ", "").strip()
    user_data = SESSIONS_DB.get(token) or default_demo
    if user_data:
        return User(
            id=user_data["id"],
            name=user_data["name"],
            email=user_data["email"],
            createdAt=user_data["createdAt"]
        )
    return None

def logout_user(auth_header: Optional[str]) -> None:
    if auth_header:
        token = auth_header.replace("Bearer ", "").strip()
        SESSIONS_DB.pop(token, None)
