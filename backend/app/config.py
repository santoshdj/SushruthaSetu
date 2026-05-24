from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    fhir_base_url: str
    fhir_auth_token: str = ""
    anthropic_api_key: str
    clerk_jwks_url: str
    clerk_issuer: str
    # Comma-separated list of allowed CORS origins.
    # Example: https://frontend.up.railway.app,http://localhost:5173
    allowed_origins: str = "http://localhost:5173"

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    class Config:
        env_file = ".env"


settings = Settings()
