from sqlalchemy import Column, Integer, String, LargeBinary, DateTime, Float, ForeignKey, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.database import Base


class User(Base):
    __tablename__ = "users"

    id            = Column(Integer, primary_key=True, index=True)
    email         = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)

    # Heisenberg group signing keypair (permanent, generated at registration)
    h_private_key = Column(LargeBinary, nullable=False)   # stored as big-endian int bytes
    h_public_key  = Column(String, nullable=False)        # serialised "a,b,c"

    # BB84 identity keypair (used for key derivation context)
    bb84_seed     = Column(LargeBinary, nullable=False)

    created_at    = Column(DateTime(timezone=True), server_default=func.now())

    files      = relationship("EncryptedFile", back_populates="owner")
    signatures = relationship("FileSignature",  back_populates="signer")


class EncryptedFile(Base):
    __tablename__ = "encrypted_files"

    id          = Column(Integer, primary_key=True, index=True)
    filename    = Column(String, nullable=False)
    filepath    = Column(String, nullable=False)   # ciphertext on disk
    owner_id    = Column(Integer, ForeignKey("users.id"))
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    # Server NEVER stores the AES file key — only the encrypted blob
    # key_hint lets the owner confirm which key to use (first 8 chars of key hex)
    key_hint    = Column(String, nullable=False)

    owner       = relationship("User",          back_populates="files")
    signature   = relationship("FileSignature", back_populates="file", uselist=False)
    shares      = relationship("FileShare",     back_populates="file")


class FileSignature(Base):
    __tablename__ = "file_signatures"

    id          = Column(Integer, primary_key=True, index=True)
    file_id     = Column(Integer, ForeignKey("encrypted_files.id"), unique=True)
    signer_id   = Column(Integer, ForeignKey("users.id"))

    # Heisenberg group Schnorr signature components
    h_sig_r     = Column(String, nullable=False)   # serialised HeisenbergElement "a,b,c"
    h_sig_z     = Column(String, nullable=False)   # integer z as string

    # SHA-256 hash that was signed (hex) — used for tamper detection
    file_hash   = Column(String, nullable=False)

    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    file        = relationship("EncryptedFile", back_populates="signature")
    signer      = relationship("User",          back_populates="signatures")


class FileShare(Base):
    __tablename__ = "file_shares"

    id                  = Column(Integer, primary_key=True, index=True)
    file_id             = Column(Integer, ForeignKey("encrypted_files.id"))
    shared_with_email   = Column(String, nullable=False)

    # Re-encrypted blob for this recipient (separate file on disk)
    share_filepath      = Column(String, nullable=False)

    # key_hint for the share key (first 8 chars of share key hex)
    share_key_hint      = Column(String, nullable=False)

    # BB84 QBER recorded at share-key generation time
    share_qber          = Column(Float, default=0.0)

    created_at          = Column(DateTime(timezone=True), server_default=func.now())

    file                = relationship("EncryptedFile", back_populates="shares")
