from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.db.deps import get_db
from app.db.models import User
from app.core.security import hash_password, verify_password, create_access_token
from app.core.auth import get_current_user
from app.services.heisenberg_service import h_keygen, run_bb84, hkdf, LABEL_SIGN_KEY
import secrets

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/register")
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    # Run BB84 to get identity seed
    bb84 = run_bb84()
    if not bb84.secure:
        raise HTTPException(status_code=503,
            detail=f"Quantum channel compromised (QBER={bb84.qber:.2%}). Please retry.")

    sign_seed = hkdf(bb84.raw_key, LABEL_SIGN_KEY, 32)

    # Generate Heisenberg group signing keypair from BB84 seed
    priv_int, pub_elem = h_keygen(seed=sign_seed)

    user = User(
        email         = data.email,
        password_hash = hash_password(data.password),
        h_private_key = priv_int.to_bytes(16, "big"),
        h_public_key  = pub_elem.serialize(),
        bb84_seed     = bb84.raw_key,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "message":  "Registered successfully",
        "qkd_info": {"qber": bb84.qber, "secure": bb84.secure},
    }


@router.post("/login")
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Invalid credentials")
    return {
        "access_token": create_access_token({"sub": user.email}),
        "token_type":   "bearer",
    }


@router.get("/me")
def me(user_email: str = Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == user_email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "email":      user.email,
        "public_key": user.h_public_key,
        "created_at": str(user.created_at),
    }
