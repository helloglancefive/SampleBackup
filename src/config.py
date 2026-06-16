"""Configuration management for GlanceFive."""
from pathlib import Path
from typing import Optional
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """Application settings from environment variables."""

    amazon_client_id: str = Field(..., alias="AMAZON_CLIENT_ID")
    amazon_client_secret: str = Field(..., alias="AMAZON_CLIENT_SECRET")
    amazon_refresh_token: str = Field(..., alias="AMAZON_REFRESH_TOKEN")

    amazon_token_url: str = Field(
        default="https://api.amazon.com/auth/o2/token",
        alias="AMAZON_TOKEN_URL"
    )
    amazon_profiles_url: str = Field(
        default="https://advertising-api-eu.amazon.com/v2/profiles",
        alias="AMAZON_PROFILES_URL"
    )
    amazon_reports_url: str = Field(
        default="https://advertising-api-eu.amazon.com/reporting/reports",
        alias="AMAZON_REPORTS_URL"
    )

    reports_output_dir: Path = Field(
        default=Path("./reports"),
        alias="REPORTS_OUTPUT_DIR"
    )
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    max_retry_attempts: int = Field(default=3, alias="MAX_RETRY_ATTEMPTS")
    retry_backoff_factor: int = Field(default=2, alias="RETRY_BACKOFF_FACTOR")

    class Config:
        env_file = ".env"
        case_sensitive = False
        populate_by_name = True

    def __init__(self, **data):
        super().__init__(**data)
        self.reports_output_dir.mkdir(parents=True, exist_ok=True)


_settings: Optional[Settings] = None


def get_settings() -> Settings:
    """Get application settings singleton."""
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings
