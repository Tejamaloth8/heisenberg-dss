from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import os, uuid, hashlib, io

from app.db.deps import get_db
from app.db.models import User, EncryptedFile, FileSignature, FileShare
from app.core.auth import get_current_user
from app.services.heisenberg_service import (
    HeisenbergElement,
    h_sign, h_verify,
    generate_file_key,
    aes_encrypt, aes_decrypt,
    key_to_hex, hex_to_key, key_hint,
    run_bb84, hkdf, LABEL_FILE_KEY,
)

router       = APIRouter(prefix="/files", tags=["files"])
STORAGE_PATH = "storage"
os.makedirs(STORAGE_PATH, exist_ok=True)


def _get_user(email: str, db: Session) -> User:
    u = db.query(User).filter(User.email == email).first()
    if not u:
        raise HTTPException(status_code=401, detail="User not found")
    return u


def _sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


# ── List ──────────────────────────────────────────────────────

@router.get("/")
def list_files(user_email: str = Depends(get_current_user), db: Session = Depends(get_db)):
    user  = _get_user(user_email, db)
    owned = db.query(EncryptedFile).filter(EncryptedFile.owner_id == user.id).all()

    shared_rows = db.query(FileShare).filter(FileShare.shared_with_email == user_email).all()
    shared_file_ids = [s.file_id for s in shared_rows]
    shared_files    = db.query(EncryptedFile).filter(EncryptedFile.id.in_(shared_file_ids)).all() if shared_file_ids else []

    def file_info(f: EncryptedFile, is_shared=False, share_id=None):
        sig = db.query(FileSignature).filter(FileSignature.file_id == f.id).first()
        return {
            "id":        f.id,
            "filename":  f.filename,
            "owner":     f.owner.email,
            "key_hint":  f.key_hint,
            "signed":    sig is not None,
            "signer":    sig.signer.email if sig else None,
            "created_at": str(f.created_at),
            "is_shared": is_shared,
            "share_id":  share_id,
        }

    shared_info = []
    for s in shared_rows:
        f = db.query(EncryptedFile).filter(EncryptedFile.id == s.file_id).first()
        if f:
            shared_info.append({
                **file_info(f, is_shared=True, share_id=s.id),
                "share_key_hint": s.share_key_hint,
            })

    return {
        "owned":  [file_info(f) for f in owned],
        "shared": shared_info,
    }


# ── Upload ────────────────────────────────────────────────────

@router.post("/upload")
def upload_file(
    file: UploadFile = File(...),
    user_email: str  = Depends(get_current_user),
    db: Session      = Depends(get_db),
):
    user     = _get_user(user_email, db)
    raw_data = file.file.read()
    if not raw_data:
        raise HTTPException(status_code=400, detail="File is empty")

    # BB84 → unique AES key for this file
    try:
        file_key, qber, _ = generate_file_key()
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    # Encrypt and save
    ciphertext  = aes_encrypt(raw_data, file_key)
    unique_name = f"{uuid.uuid4()}.enc"
    filepath    = os.path.join(STORAGE_PATH, unique_name)
    with open(filepath, "wb") as f:
        f.write(ciphertext)

    # Sign the ciphertext hash with Heisenberg group key
    file_hash   = _sha256_hex(ciphertext)
    priv_int    = int.from_bytes(user.h_private_key, "big")
    r_str, z_str = h_sign(
        bytes.fromhex(file_hash),
        priv_int,
        nonce_seed=user.bb84_seed
    )

    # Persist file record
    enc_file = EncryptedFile(
        filename = file.filename,
        filepath = filepath,
        owner_id = user.id,
        key_hint = key_hint(file_key),
    )
    db.add(enc_file)
    db.commit()
    db.refresh(enc_file)

    # Persist signature
    sig = FileSignature(
        file_id   = enc_file.id,
        signer_id = user.id,
        h_sig_r   = r_str,
        h_sig_z   = z_str,
        file_hash = file_hash,
    )
    db.add(sig)
    db.commit()

    return {
        "message":     "File encrypted and signed",
        "document_id": enc_file.id,
        "filename":    file.filename,
        "key_hint":    key_hint(file_key),
        "qber":        qber,
        # THE KEY — shown ONCE, never stored on server
        "file_key":    key_to_hex(file_key),
        "warning":     "Save this key NOW. It will never be shown again.",
    }


# ── Download (owner) ──────────────────────────────────────────

@router.post("/download/{file_id}")
def download_file(
    file_id: int,
    key_hex: str     = Form(...),
    user_email: str  = Depends(get_current_user),
    db: Session      = Depends(get_db),
):
    user     = _get_user(user_email, db)
    enc_file = db.query(EncryptedFile).filter(EncryptedFile.id == file_id).first()
    if not enc_file:
        raise HTTPException(status_code=404, detail="File not found")
    if enc_file.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not your file — use the share download endpoint")

    return _decrypt_and_serve(enc_file, key_hex, db)


# ── Share ─────────────────────────────────────────────────────

@router.post("/share/{file_id}")
def share_file(
    file_id: int,
    recipient_email: str = Form(...),
    owner_key_hex: str   = Form(...),
    user_email: str      = Depends(get_current_user),
    db: Session          = Depends(get_db),
):
    user     = _get_user(user_email, db)
    enc_file = db.query(EncryptedFile).filter(
        EncryptedFile.id == file_id,
        EncryptedFile.owner_id == user.id
    ).first()
    if not enc_file:
        raise HTTPException(status_code=404, detail="File not found or not owned by you")

    recipient = db.query(User).filter(User.email == recipient_email).first()
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not registered in system")

    already = db.query(FileShare).filter(
        FileShare.file_id == file_id,
        FileShare.shared_with_email == recipient_email
    ).first()
    if already:
        raise HTTPException(status_code=400, detail="Already shared with this user")

    # Decrypt original file using owner's key
    try:
        owner_key = hex_to_key(owner_key_hex)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid key format — must be hex string")

    with open(enc_file.filepath, "rb") as f:
        ciphertext = f.read()

    try:
        plaintext = aes_decrypt(ciphertext, owner_key)
    except Exception:
        raise HTTPException(status_code=400, detail="Wrong key — could not decrypt file")

    # Generate NEW BB84 share key for this recipient
    try:
        share_key, qber, _ = generate_file_key()
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    # Re-encrypt for recipient
    share_ciphertext  = aes_encrypt(plaintext, share_key)
    share_unique_name = f"share_{uuid.uuid4()}.enc"
    share_filepath    = os.path.join(STORAGE_PATH, share_unique_name)
    with open(share_filepath, "wb") as f:
        f.write(share_ciphertext)

    share = FileShare(
        file_id           = enc_file.id,
        shared_with_email = recipient_email,
        share_filepath    = share_filepath,
        share_key_hint    = key_hint(share_key),
        share_qber        = qber,
    )
    db.add(share)
    db.commit()

    return {
        "message":        f"File shared with {recipient_email}",
        "share_key_hint": key_hint(share_key),
        "qber":           qber,
        # NEW KEY for recipient — shown ONCE to owner
        "share_key":  key_to_hex(share_key),
        "warning":    "Give this key to the recipient. It will never be shown again.",
    }


# ── Download (recipient via share) ────────────────────────────

@router.post("/download-share/{share_id}")
def download_shared_file(
    share_id: int,
    key_hex: str    = Form(...),
    user_email: str = Depends(get_current_user),
    db: Session     = Depends(get_db),
):
    share = db.query(FileShare).filter(
        FileShare.id == share_id,
        FileShare.shared_with_email == user_email
    ).first()
    if not share:
        raise HTTPException(status_code=404, detail="Share not found or not shared with you")

    enc_file = db.query(EncryptedFile).filter(EncryptedFile.id == share.file_id).first()

    try:
        key = hex_to_key(key_hex)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid key format")

    with open(share.share_filepath, "rb") as f:
        ciphertext = f.read()

    try:
        plaintext = aes_decrypt(ciphertext, key)
    except Exception:
        raise HTTPException(status_code=400, detail="Wrong key — decryption failed")

    return StreamingResponse(
        io.BytesIO(plaintext),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{enc_file.filename}"'}
    )


# ── Verify signature ──────────────────────────────────────────

@router.get("/verify/{file_id}")
def verify_file(file_id: int, db: Session = Depends(get_db)):
    enc_file = db.query(EncryptedFile).filter(EncryptedFile.id == file_id).first()
    if not enc_file:
        raise HTTPException(status_code=404, detail="File not found")

    sig = db.query(FileSignature).filter(FileSignature.file_id == file_id).first()
    if not sig:
        return {"signed": False, "message": "File has no signature"}

    # Re-read ciphertext and check hash matches what was signed
    with open(enc_file.filepath, "rb") as f:
        ciphertext = f.read()

    current_hash = _sha256_hex(ciphertext)
    hash_matches = current_hash == sig.file_hash

    # Verify Heisenberg group signature
    signer     = db.query(User).filter(User.id == sig.signer_id).first()
    pub_key    = HeisenbergElement.from_str(signer.h_public_key)
    sig_valid  = h_verify(
        bytes.fromhex(sig.file_hash),
        pub_key,
        sig.h_sig_r,
        sig.h_sig_z
    )

    overall = hash_matches and sig_valid

    return {
        "file_id":           file_id,
        "filename":          enc_file.filename,
        "signed":            True,
        "overall_valid":     overall,
        "hash_intact":       hash_matches,
        "signature_valid":   sig_valid,
        "tampered":          not hash_matches,
        "signed_by":         signer.email,
        "signed_at":         str(sig.created_at),
        "signer_public_key": signer.h_public_key,
        "algorithm":         "Heisenberg group Schnorr signature over H(Z/PZ)",
    }


# ── Helpers ───────────────────────────────────────────────────

def _decrypt_and_serve(enc_file: EncryptedFile, key_hex: str, db: Session):
    try:
        key = hex_to_key(key_hex)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid key format — must be hex string")

    with open(enc_file.filepath, "rb") as f:
        ciphertext = f.read()

    try:
        plaintext = aes_decrypt(ciphertext, key)
    except Exception:
        raise HTTPException(status_code=400, detail="Wrong key — decryption failed")

    return StreamingResponse(
        io.BytesIO(plaintext),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{enc_file.filename}"'}
    )
