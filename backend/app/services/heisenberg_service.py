"""
heisenberg_service.py
Heisenberg Group Digital Signature System — core cryptographic engine

Two quantum layers:
  1. BB84 QKD  →  derives unique AES-256 file keys (zero-knowledge encryption)
  2. Heisenberg group Schnorr signature  →  authenticates + integrity-checks files

BB84 is grounded in the Heisenberg Uncertainty Principle:
  any eavesdropper must measure qubits to intercept them,
  measurement in the wrong basis irreversibly disturbs the state,
  introducing detectable bit errors (QBER > 11% → channel compromised).
"""

import os, random, hashlib, hmac, struct, secrets
from typing import Tuple, Optional

P              = 2147483647          # Mersenne prime M31
QBER_THRESHOLD = 0.11
NUM_QUBITS     = 512
LABEL_FILE_KEY = b"hgdss-file-key-v1"
LABEL_SIGN_KEY = b"hgdss-sign-key-v1"


# ── Heisenberg Group ──────────────────────────────────────────

class HeisenbergElement:
    """
    Element of integer Heisenberg group H(Z/PZ).
    Multiplication: (a,b,c)*(a',b',c') = (a+a', b+b', c+c'+a*b') mod P
    """
    def __init__(self, a: int, b: int, c: int):
        self.a = int(a) % P
        self.b = int(b) % P
        self.c = int(c) % P

    def multiply(self, o: "HeisenbergElement") -> "HeisenbergElement":
        return HeisenbergElement(
            self.a + o.a,
            self.b + o.b,
            self.c + o.c + self.a * o.b
        )

    def power(self, n: int) -> "HeisenbergElement":
        result = HeisenbergElement(0, 0, 0)
        base   = HeisenbergElement(self.a, self.b, self.c)
        n = int(n) % P
        while n > 0:
            if n & 1:
                result = result.multiply(base)
            base = base.multiply(base)
            n >>= 1
        return result

    def serialize(self) -> str:
        return f"{self.a},{self.b},{self.c}"

    def to_bytes(self) -> bytes:
        return self.serialize().encode()

    def __eq__(self, o: object) -> bool:
        return isinstance(o, HeisenbergElement) and \
               self.a == o.a and self.b == o.b and self.c == o.c

    def __repr__(self) -> str:
        return f"H({self.a},{self.b},{self.c})"

    @staticmethod
    def from_str(s: str) -> "HeisenbergElement":
        a, b, c = map(int, s.strip().split(","))
        return HeisenbergElement(a, b, c)


GENERATOR = HeisenbergElement(1, 1, 0)   # standard generator g


def h_keygen(seed: Optional[bytes] = None) -> Tuple[int, HeisenbergElement]:
    """Generate Heisenberg group keypair. Returns (private_key_int, public_key_element)."""
    if seed is not None:
        priv = (int.from_bytes(seed[:32], "big") % (P - 2)) + 1
    else:
        priv = random.randint(1, P - 1)
    return priv, GENERATOR.power(priv)


def h_sign(message: bytes, private_key: int,
           nonce_seed: Optional[bytes] = None) -> Tuple[str, str]:
    """
    Deterministic Schnorr signature over Heisenberg group.
    Returns (r_str, z_str) for DB storage.
    """
    if nonce_seed is not None:
        k_bytes = hmac.new(nonce_seed, message, hashlib.sha256).digest()
        k = (int.from_bytes(k_bytes, "big") % (P - 2)) + 1
    else:
        k = random.randint(1, P - 1)

    r   = GENERATOR.power(k)
    e   = int(hashlib.sha256(r.to_bytes() + message).hexdigest(), 16) % P
    z   = (k + private_key * e) % P
    return r.serialize(), str(z)


def h_verify(message: bytes, public_key: HeisenbergElement,
             r_str: str, z_str: str) -> bool:
    """Verify Heisenberg group Schnorr signature. g^z == r * pk^e"""
    try:
        r     = HeisenbergElement.from_str(r_str)
        z     = int(z_str)
        e     = int(hashlib.sha256(r.to_bytes() + message).hexdigest(), 16) % P
        left  = GENERATOR.power(z)
        right = r.multiply(public_key.power(e))
        return left == right
    except Exception:
        return False


# ── BB84 QKD ──────────────────────────────────────────────────

class BB84Result:
    def __init__(self, raw_key: bytes, qber: float, secure: bool):
        self.raw_key = raw_key
        self.qber    = qber
        self.secure  = secure


def run_bb84(num_qubits: int = NUM_QUBITS) -> BB84Result:
    """
    Simulate BB84 QKD.

    Heisenberg Uncertainty Principle: Eve must measure each qubit to
    intercept it. Measuring in the wrong basis irreversibly collapses
    the quantum state, introducing detectable QBER errors.
    If QBER > 11% → channel is compromised → abort.
    """
    rng = random.SystemRandom()

    alice_bits  = [rng.randint(0, 1) for _ in range(num_qubits)]
    alice_bases = [rng.randint(0, 1) for _ in range(num_qubits)]
    bob_bases   = [rng.randint(0, 1) for _ in range(num_qubits)]

    bob_bits = [
        alice_bits[i] if alice_bases[i] == bob_bases[i] else rng.randint(0, 1)
        for i in range(num_qubits)
    ]

    sifted_idx   = [i for i in range(num_qubits) if alice_bases[i] == bob_bases[i]]
    alice_sifted = [alice_bits[i] for i in sifted_idx]
    bob_sifted   = [bob_bits[i]   for i in sifted_idx]

    sample       = max(1, len(sifted_idx) // 4)
    errors       = sum(1 for i in range(sample) if alice_sifted[i] != bob_sifted[i])
    qber         = errors / sample
    secure       = qber <= QBER_THRESHOLD

    key_bits  = alice_sifted[sample:]
    key_bytes = bytearray()
    for i in range(0, len(key_bits) - 7, 8):
        byte = 0
        for b in range(8):
            byte = (byte << 1) | key_bits[i + b]
        key_bytes.append(byte)

    raw = bytes(key_bytes) if len(key_bytes) >= 16 else secrets.token_bytes(32)
    return BB84Result(
        raw_key = hashlib.sha256(raw).digest(),
        qber    = round(qber, 4),
        secure  = secure
    )


# ── HKDF ─────────────────────────────────────────────────────

def hkdf(ikm: bytes, label: bytes, length: int = 32) -> bytes:
    salt = hashlib.sha256(b"hgdss-salt-v1").digest()
    prk  = hmac.new(salt, ikm, hashlib.sha256).digest()
    okm, t, ctr = b"", b"", 1
    while len(okm) < length:
        t    = hmac.new(prk, t + label + struct.pack("B", ctr), hashlib.sha256).digest()
        okm += t
        ctr += 1
    return okm[:length]


# ── AES-256-GCM ───────────────────────────────────────────────

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def aes_encrypt(data: bytes, key: bytes) -> bytes:
    nonce = os.urandom(12)
    return nonce + AESGCM(key).encrypt(nonce, data, None)


def aes_decrypt(blob: bytes, key: bytes) -> bytes:
    return AESGCM(key).decrypt(blob[:12], blob[12:], None)


# ── High-level file key generation ───────────────────────────

def generate_file_key() -> Tuple[bytes, float, bool]:
    """
    Run BB84, derive a unique AES-256 file key.
    Returns (aes_key_32_bytes, qber, secure).
    Raises RuntimeError if QBER > threshold (eavesdrop detected).
    """
    result = run_bb84()
    if not result.secure:
        raise RuntimeError(
            f"Quantum channel compromised — QBER={result.qber:.2%}. "
            "Key generation aborted. Please retry."
        )
    key = hkdf(result.raw_key, LABEL_FILE_KEY, 32)
    return key, result.qber, result.secure


def key_to_hex(key: bytes) -> str:
    return key.hex()


def hex_to_key(h: str) -> bytes:
    return bytes.fromhex(h.strip())


def key_hint(key: bytes) -> str:
    """First 8 hex chars — shown in UI so user can confirm correct key."""
    return key.hex()[:8]
