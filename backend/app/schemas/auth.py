from pydantic import BaseModel, EmailStr, field_validator


class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str


class ClientSignupRequest(BaseModel):
    """Public self-signup: creates a client (business) + owner user in one step."""
    business_name: str
    full_name: str
    email: EmailStr
    password: str
    amazon_region: str = "eu"

    @field_validator("amazon_region")
    @classmethod
    def _check_region(cls, v: str) -> str:
        v = v.lower()
        if v not in {"eu", "na", "fe"}:
            return "eu"
        return v

    @field_validator("password")
    @classmethod
    def _check_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v

    @field_validator("business_name", "full_name")
    @classmethod
    def _check_name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Must be at least 2 characters")
        return v


class ClientSignupResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str
