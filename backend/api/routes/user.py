"""
/api/user — Authentication & profile endpoints.
Handles login, registration, and current-user retrieval.
"""

from fastapi import APIRouter, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from typing import Annotated
from fastapi import Depends

from api.dependencies import CurrentUser
from core.security import create_access_token, hash_password, verify_password
from models.schemas import Token, UserCreate, UserProfile

router = APIRouter()

# ── In-memory store (replace with a real DB later) ────────────────────────────
_USERS: dict[str, dict] = {}


@router.post("/register", response_model=UserProfile, status_code=status.HTTP_201_CREATED)
async def register(body: UserCreate) -> UserProfile:
    """Create a new user account."""
    if body.email in _USERS:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered.",
        )
    user = {
        "id": f"usr_{len(_USERS) + 1:04d}",
        "email": body.email,
        "name": body.name,
        "hashed_password": hash_password(body.password),
    }
    _USERS[body.email] = user
    return UserProfile(id=user["id"], email=user["email"], name=user["name"])


@router.post("/login", response_model=Token, summary="OAuth2 password login")
async def login(form: Annotated[OAuth2PasswordRequestForm, Depends()]) -> Token:
    """Exchange credentials for a JWT access token."""
    user = _USERS.get(form.username)
    if not user or not verify_password(form.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token({"sub": user["id"], "email": user["email"]})
    return Token(access_token=token, token_type="bearer")


@router.get("/me", response_model=UserProfile, summary="Get current user profile")
async def me(current_user: CurrentUser) -> UserProfile:
    """Return the authenticated user's profile."""
    user = next(
        (u for u in _USERS.values() if u["id"] == current_user.user_id), None
    )
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    return UserProfile(id=user["id"], email=user["email"], name=user["name"])
