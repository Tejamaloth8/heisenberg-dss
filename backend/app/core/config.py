from dotenv import load_dotenv
import os
load_dotenv()

class Settings:
    APP_NAME: str                    = os.getenv("APP_NAME", "Heisenberg Group Digital Signature System")
    SECRET_KEY: str                  = os.getenv("SECRET_KEY", "change-me")
    DATABASE_URL: str                = os.getenv("DATABASE_URL", "sqlite:///./hgdss.db")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60))

settings = Settings()
