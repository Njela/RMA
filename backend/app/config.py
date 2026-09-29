"""Configuration. Every setting can be overridden with an environment variable (see .env.example)."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    env: str = "dev"                       # dev | prod  (dev auto-creates tables)
    database_url: str = "sqlite:///./rma.db"
    redis_url: str = "redis://localhost:6379/0"
    cors_origins: str = "http://localhost:3000"

    # Pipeline
    pipeline_mode: str = "inline"          # inline (FastAPI background task) | celery
    automation_level: str = "auto"         # off = all human | suggest = AI suggests, human decides | auto
    confidence_threshold: float = 0.75
    repeat_claim_limit: int = 2            # prior RMAs on the same serial before a human must look
    default_region: str = "KE"

    # LLM (node 3). With no API key the deterministic heuristic extractor is used (dev/tests only).
    anthropic_api_key: str | None = None
    llm_model: str = "claude-sonnet-5-5"
    llm_timeout_seconds: float = 30
    llm_max_retries: int = 2

    # ERP (node 4)
    erp_mode: str = "database"             # database (local serial_units table) | http
    erp_base_url: str = ""
    erp_api_token: str = ""

    # Carrier (node 9)
    carrier_mode: str = "mock"
    carrier_webhook_secret: str = "change-me"

    # Auth / abuse protection
    inbound_email_secret: str = "change-me"
    staff_api_key: str = "dev-staff-key"   # replace with OIDC/SSO in production
    public_rate_limit_per_minute: int = 30

    # SLA business calendar
    business_tz: str = "Africa/Nairobi"
    business_start_hour: int = 8
    business_end_hour: int = 17
    # Fixed-date public holidays (MM-DD). Movable ones (Good Friday, Easter Monday, Eid) must be added yearly.
    holidays: str = "01-01,05-01,06-01,10-10,10-20,12-12,12-25,12-26"


@lru_cache
def get_settings() -> Settings:
    return Settings()
