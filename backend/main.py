import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db.database import Base, engine
from app.api.auth import router as auth_router
from app.api.files import router as files_router

os.makedirs("storage", exist_ok=True)

app = FastAPI(
    title="Heisenberg Group Digital Signature System",
    description="Zero-knowledge file encryption via BB84 QKD + Heisenberg group Schnorr signatures",
    version="2.0.0",
)

# Read allowed origins from env — supports both local dev and production domain
RAW_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
origins = [o.strip() for o in RAW_ORIGINS.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

app.include_router(auth_router)
app.include_router(files_router)

Base.metadata.create_all(bind=engine)

@app.get("/")
def root():
    return {
        "system":  "Heisenberg Group Digital Signature System",
        "version": "2.0.0",
        "layers": {
            "encryption": "BB84 QKD → unique AES-256-GCM key per file (zero-knowledge)",
            "signature":  "Heisenberg group Schnorr signature for authenticity + integrity",
        }
    }
