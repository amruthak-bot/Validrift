from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Validrift API"
    app_env: str = "development"
    debug: bool = True
    api_prefix: str = "/api"
    database_url: str = "sqlite:///./validrift.db"
    cors_origins: str = (
        "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173,"
        "http://localhost:5500,http://127.0.0.1:5500,"
        "http://localhost:8080,http://127.0.0.1:8080,"
        "http://localhost:8000,http://127.0.0.1:8000"
    )

    seed_demo: bool = True

    hindsight_mode: str = "live"  # live | mock | disabled
    hindsight_api_url: str = "https://api.hindsight.vectorize.io"
    hindsight_api_key: str | None = None
    hindsight_bank_id: str = "validrift-demo"
    hindsight_recall_budget: str = "mid"
    hindsight_recall_max_tokens: int = 2500
    hindsight_timeout_seconds: float = 60.0

    # Kept deterministic for the demo so the UI and backend remain consistent.
    validated_min_successes: int = 3
    drift_min_failures: int = 2

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [x.strip() for x in self.cors_origins.split(",") if x.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
