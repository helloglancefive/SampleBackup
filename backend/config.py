from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve .env relative to this file so the server works from any CWD
_ENV_FILE = Path(__file__).parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Database
    database_url: str = "sqlite:///./dev.db"

    # Security
    jwt_secret: str = "dev-secret-change-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7
    encryption_key: str = ""

    # App
    environment: str = "development"
    log_level: str = "INFO"
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    # Phase 2+
    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_url: str = "redis://localhost:6379/2"

    # Amazon Advertising API
    amazon_token_url: str = "https://api.amazon.com/auth/o2/token"
    amazon_profiles_url: str = "https://advertising-api-eu.amazon.com/v2/profiles"
    amazon_reports_url: str = "https://advertising-api-eu.amazon.com/reporting/reports"

    # Amazon SP-API base URLs (region is stored per-client in credentials table)
    sp_api_base_url_na: str = "https://sellingpartnerapi-na.amazon.com"
    sp_api_base_url_eu: str = "https://sellingpartnerapi-eu.amazon.com"
    sp_api_base_url_fe: str = "https://sellingpartnerapi-fe.amazon.com"

    # SP-API sandbox mode — set True when testing with sandbox refresh token
    sp_api_sandbox: bool = False

    # SP-API LWA credentials override — only needed when the SP-API app uses
    # different OAuth client_id/secret than the Ads API app stored per-client in DB.
    sp_api_client_id: str = ""
    sp_api_client_secret: str = ""

    # Amazon OAuth — platform-level LWA credentials for Authorization Code flow
    # Both Ads API and SP-API share the same LWA Security Profile.
    amazon_ads_client_id: str = ""
    amazon_ads_client_secret: str = ""

    # SP-API Application ID from Solution Provider Portal
    sp_api_application_id: str = ""

    # Base URL of the frontend — Amazon redirects here after OAuth consent.
    # Dev: http://localhost:5173   Prod: https://glancefive.com
    frontend_url: str = "http://localhost:5173"

    # Email / SMTP — for password reset emails
    # Leave smtp_host empty to disable email sending (logs a warning instead)
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "noreply@glancefive.com"
    smtp_use_tls: bool = True

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
