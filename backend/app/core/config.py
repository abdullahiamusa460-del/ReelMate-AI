"""Application configuration loaded from environment variables.

Nothing in this module is ever imported by the browser bundle. Secrets must be
provided through the process environment (or a local, git-ignored `.env`).
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "ReelMate AI API"
    app_env: str = "development"
    debug: bool = False
    log_level: str = "INFO"
    app_timezone: str = "UTC"

    backend_public_url: str = "http://localhost:8000"
    frontend_url: str = "http://localhost:3000"
    cors_origins: str = "http://localhost:3000"

    database_url: str = "postgresql+asyncpg://reelmate:reelmate@127.0.0.1:5432/reelmate"
    database_echo: bool = False
    auto_create_tables: bool = False
    seed_demo_data: bool = True

    secret_key: str = "change-me-to-a-long-random-string"
    encryption_key: str = ""
    api_access_token: str = ""

    # Instagram / Meta
    ig_app_id: str = ""
    ig_app_secret: str = ""
    ig_redirect_uri: str = ""
    ig_webhook_verify_token: str = ""
    ig_access_token: str = ""
    ig_account_id: str = ""
    ig_graph_version: str = "v23.0"
    ig_graph_base_url: str = "https://graph.instagram.com"
    ig_messaging_scope: str = "instagram_business_manage_messages"
    ig_oauth_scopes: str = "instagram_business_basic,instagram_business_manage_messages"

    # AI
    ai_provider: str = "demo"
    ai_api_key: str = ""
    ai_base_url: str = "https://api.openai.com/v1"
    ai_model: str = "gpt-4o-mini"
    ai_video_model: str = ""
    ai_timeout_sec: int = 90
    ai_max_frames: int = 6
    ai_max_output_tokens: int = 700

    media_allowed_hosts: str = "cdninstagram.com,fbcdn.net,instagram.com"

    # Media storage
    upload_dir: str = str(BACKEND_DIR / "uploads")
    max_upload_bytes: int = 52_428_800
    max_media_download_bytes: int = 104_857_600
    media_download_timeout_sec: int = 30

    # Background worker
    enable_worker: bool = True
    worker_poll_interval_sec: float = 1.0
    job_max_attempts: int = 5

    # Rate limits
    api_rate_limit_per_minute: int = 120
    sensitive_rate_limit_per_minute: int = 20

    default_workspace_email: str = Field(default="owner@reelmate.local")

    @field_validator("log_level")
    @classmethod
    def _valid_log_level(cls, value: str) -> str:
        allowed = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
        upper = value.upper()
        if upper not in allowed:
            raise ValueError(f"LOG_LEVEL must be one of {sorted(allowed)}")
        return upper

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() in {"production", "prod"}

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def allowed_media_hosts(self) -> tuple[str, ...]:
        return tuple(
            host.strip().lower()
            for host in self.media_allowed_hosts.split(",")
            if host.strip()
        )

    @property
    def oauth_scopes(self) -> list[str]:
        return [scope.strip() for scope in self.ig_oauth_scopes.split(",") if scope.strip()]

    @property
    def instagram_configured(self) -> bool:
        return bool(self.ig_app_id and self.ig_app_secret and self.ig_redirect_uri)

    @property
    def ai_configured(self) -> bool:
        provider = self.ai_provider.strip().lower()
        return provider in {"openai", "openai_compatible", "gemini"} and bool(self.ai_api_key)

    @property
    def ai_video_capable(self) -> bool:
        """Whether the configured provider can accept actual video bytes."""
        return self.ai_configured and self.ai_provider.strip().lower() == "gemini"

    @property
    def upload_path(self) -> Path:
        return Path(self.upload_dir).resolve()

    def validate_production_secrets(self) -> list[str]:
        """Return configuration problems that must be fixed before production."""
        problems: list[str] = []
        if self.is_production:
            if self.secret_key == "change-me-to-a-long-random-string" or len(self.secret_key) < 32:
                problems.append("SECRET_KEY must be a long random value in production")
            if not self.encryption_key:
                problems.append("ENCRYPTION_KEY must be set in production")
            if not self.api_access_token:
                problems.append("API_ACCESS_TOKEN must be set in production")
            if not self.database_url.startswith(("postgresql", "postgres")):
                problems.append("DATABASE_URL must point to PostgreSQL in production")
            if self.cors_origins.strip() == "*":
                problems.append("CORS_ORIGINS must not be '*' in production")
        return problems


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
