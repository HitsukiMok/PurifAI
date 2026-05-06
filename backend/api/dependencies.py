"""
FastAPI dependency injection helpers.
Import these into route handlers via `Depends(...)`.
"""

from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError

from core.security import decode_access_token
from models.schemas import TokenData

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/user/login")


async def get_current_user(token: Annotated[str, Depends(oauth2_scheme)]) -> TokenData:
    """
    Validate the Bearer token and return the decoded TokenData.
    Raises HTTP 401 if the token is missing, invalid, or expired.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(token)
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
        return TokenData(user_id=user_id, email=payload.get("email", ""))
    except JWTError:
        raise credentials_exception


# Convenient type alias for annotated dependency injection
CurrentUser = Annotated[TokenData, Depends(get_current_user)]
