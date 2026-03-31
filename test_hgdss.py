import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from app.services.heisenberg_service import (
    HeisenbergElement, GENERATOR,
    h_keygen, h_sign, h_verify,
    run_bb84, hkdf, generate_file_key,
    aes_encrypt, aes_decrypt,
    key_to_hex, hex_to_key, key_hint,
    LABEL_FILE_KEY, LABEL_SIGN_KEY,
)

P, F = "✓", "✗"
results = []
def test(name, cond):
    s = P if cond else F
    results.append((s, name))
    print(f"  {s}  {name}")

print("\n── Heisenberg group arithmetic ──────────────────────────")
a = HeisenbergElement(3, 5, 2)
b = HeisenbergElement(7, 2, 4)
I = HeisenbergElement(0, 0, 0)
test("multiply produces element",       a.multiply(b).a >= 0)
test("identity: a * I == a",            a.multiply(I) == a)
test("serialize / deserialize",         HeisenbergElement.from_str(a.serialize()) == a)
g5 = GENERATOR.power(5)
test("power(5) is repeatable",          g5 == GENERATOR.power(5))

print("\n── Heisenberg keypair + sign/verify ─────────────────────")
priv, pub = h_keygen()
msg = b"heisenberg group digital signature system"
r, z = h_sign(msg, priv)
test("signature verifies",              h_verify(msg, pub, r, z))
test("tampered message fails",          not h_verify(b"tampered", pub, r, z))
test("wrong public key fails",          not h_verify(msg, HeisenbergElement(1,2,3), r, z))

print("\n── Deterministic nonce (RFC 6979 style) ─────────────────")
r1,z1 = h_sign(msg, priv, nonce_seed=b"seed")
r2,z2 = h_sign(msg, priv, nonce_seed=b"seed")
test("same nonce seed → same sig",      r1==r2 and z1==z2)
test("deterministic sig verifies",      h_verify(msg, pub, r1, z1))

print("\n── Seeded keypair (BB84 deterministic) ──────────────────")
seed = b"\xab" * 32
p1, k1 = h_keygen(seed=seed)
p2, k2 = h_keygen(seed=seed)
test("same seed → same private key",    p1 == p2)
test("same seed → same public key",     k1 == k2)

print("\n── BB84 QKD simulation ───────────────────────────────────")
r = run_bb84(num_qubits=512)
test("produces 32-byte raw key",        len(r.raw_key) == 32)
test("QBER in valid range",             0.0 <= r.qber <= 1.0)
test("channel is secure",               r.secure)

r2 = run_bb84(num_qubits=512)
test("different runs → different keys", r.raw_key != r2.raw_key)

print("\n── HKDF key derivation ──────────────────────────────────")
sk = hkdf(r.raw_key, LABEL_SIGN_KEY, 32)
ek = hkdf(r.raw_key, LABEL_FILE_KEY, 32)
test("sign key is 32 bytes",            len(sk) == 32)
test("encrypt key is 32 bytes",         len(ek) == 32)
test("sign key != encrypt key",         sk != ek)
sk2 = hkdf(r.raw_key, LABEL_SIGN_KEY, 32)
test("HKDF is deterministic",           sk == sk2)

print("\n── AES-256-GCM encrypt / decrypt ────────────────────────")
key, qber, secure = generate_file_key()
test("file key is 32 bytes",            len(key) == 32)
plaintext = b"classified quantum document contents"
cipher    = aes_encrypt(plaintext, key)
test("ciphertext != plaintext",         cipher != plaintext)
test("decrypts correctly",              aes_decrypt(cipher, key) == plaintext)
wrong_key = bytes(32)
try:
    aes_decrypt(cipher, wrong_key)
    test("wrong key raises exception",  False)
except Exception:
    test("wrong key raises exception",  True)

print("\n── Key encoding helpers ─────────────────────────────────")
hex_str = key_to_hex(key)
test("hex string length is 64",         len(hex_str) == 64)
test("round-trip hex → bytes",          hex_to_key(hex_str) == key)
hint = key_hint(key)
test("key hint is 8 chars",             len(hint) == 8)
test("hint is prefix of hex",           hex_str.startswith(hint))

print("\n── Full sign + verify pipeline ──────────────────────────")
priv2, pub2 = h_keygen(seed=sk)
file_data   = b"sensitive file data 12345"
file_cipher = aes_encrypt(file_data, key)
import hashlib
file_hash   = hashlib.sha256(file_cipher).digest()
r_s, z_s    = h_sign(file_hash, priv2, nonce_seed=sk)
test("file signature verifies",         h_verify(file_hash, pub2, r_s, z_s))
tampered_cipher = file_cipher[:-1] + bytes([file_cipher[-1] ^ 0xFF])
tampered_hash   = hashlib.sha256(tampered_cipher).digest()
test("tampered file hash fails sig",    not h_verify(tampered_hash, pub2, r_s, z_s))

print("\n── Summary ──────────────────────────────────────────────")
passed = sum(1 for s,_ in results if s==P)
failed = sum(1 for s,_ in results if s==F)
print(f"  {passed} passed, {failed} failed\n")
if failed:
    for s,n in results:
        if s==F: print(f"  {F}  {n}")
    sys.exit(1)
else:
    print("  All tests passed!")
