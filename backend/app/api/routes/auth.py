"""Authentication routes."""

from fastapi import APIRouter, Cookie, Depends, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.exceptions import UnauthorizedError
from app.core.tokens import TokenType, create_access_token, decode_token
from app.db.models import User
from app.db.session import get_db
from app.repositories.users import get_active_user_by_id
from app.schemas.auth import TokenResponse, UserPublic, UserRegister
from app.services.auth import authenticate_user, create_token_pair, register_user

router = APIRouter(prefix="/auth", tags=["auth"])

REFRESH_COOKIE_NAME = "refresh_token"


def _set_refresh_cookie(response: Response, refresh_token: str) -> None:
    settings = get_settings()
    is_secure = settings.environment == "production"
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=refresh_token,
        httponly=True,
        secure=is_secure,
        # docs/security.md already flagged this: "Separate default Cloud Run
        # URLs may be treated as cross-site... browser privacy policy can
        # block refresh cookies despite correct CORS." Confirmed for real via
        # Module 15's E2E suite - frontend and backend on different Docker
        # hostnames (frontend-test/backend-test, mirroring separate Cloud Run
        # service URLs) never sent this cookie on the refresh fetch at all
        # under `samesite="lax"`, since Lax cookies are only attached to
        # top-level navigations, never to a cross-site fetch()/XHR. `None`
        # requires `Secure` (HTTPS-only, hence tied to the same production
        # check) - browsers reject `SameSite=None` without it, so this can't
        # be applied outside production without also serving HTTPS locally.
        samesite="none" if is_secure else "lax",
        max_age=settings.refresh_token_expire_days * 24 * 60 * 60,
        path="/api/v1/auth",
    )


@router.post(
    "/register", response_model=UserPublic, status_code=status.HTTP_201_CREATED
)
def register(payload: UserRegister, db: Session = Depends(get_db)) -> UserPublic:
    user = register_user(db, payload.email, payload.full_name, payload.password)
    return UserPublic.model_validate(user)


@router.post("/login", response_model=TokenResponse)
def login(
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> TokenResponse:
    user = authenticate_user(db, form_data.username, form_data.password)
    access_token, refresh_token = create_token_pair(user.id)
    _set_refresh_cookie(response, refresh_token)
    settings = get_settings()
    return TokenResponse(
        access_token=access_token,
        expires_in=settings.access_token_expire_minutes * 60,
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh(
    response: Response,
    refresh_token: str | None = Cookie(default=None, alias="refresh_token"),
    db: Session = Depends(get_db),
) -> TokenResponse:
    if refresh_token is None:
        raise UnauthorizedError("No refresh token provided")
    try:
        user_id = decode_token(refresh_token, TokenType.REFRESH)
    except Exception as exc:
        raise UnauthorizedError("Invalid or expired refresh token") from exc

    user = get_active_user_by_id(db, user_id)
    if user is None:
        raise UnauthorizedError("User not found or inactive")

    new_access_token = create_access_token(user.id)
    settings = get_settings()
    return TokenResponse(
        access_token=new_access_token,
        expires_in=settings.access_token_expire_minutes * 60,
    )


@router.post("/logout")
def logout(response: Response) -> dict[str, str]:
    response.delete_cookie(REFRESH_COOKIE_NAME, path="/api/v1/auth")
    return {"message": "Logged out"}


@router.get("/me", response_model=UserPublic)
def get_me(current_user: User = Depends(get_current_user)) -> UserPublic:
    return UserPublic.model_validate(current_user)
