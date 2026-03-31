# Heisenberg Group Digital Signature System

A zero-knowledge quantum-secure file sharing system combining two independent cryptographic layers:

- **BB84 QKD** — unique AES-256-GCM key per file, derived from simulated quantum key distribution. The server *never* stores encryption keys.
- **Heisenberg Group Schnorr Signature** — every file is signed using a Schnorr-style signature over the integer Heisenberg group H(Z/PZ), providing authenticity and tamper detection.

---

## Security model

| Property | How it's achieved |
|---|---|
| Zero-knowledge encryption | Server holds only ciphertext. File key shown once to uploader, never stored. |
| Per-file unique key | BB84 QKD simulation runs fresh for every upload and every share. |
| Tamper detection | SHA-256 of ciphertext is signed at upload time; re-checked on verify. |
| Authenticity | Heisenberg group public key tied to uploader's identity. |
| Re-keying on share | New BB84 key generated per recipient; owner must supply their own key to re-encrypt. |

---

## Project structure

```
hgdss/
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   ├── .env
│   └── app/
│       ├── api/        auth.py  files.py
│       ├── core/       auth.py  config.py  security.py
│       ├── db/         database.py  deps.py  models.py
│       └── services/   heisenberg_service.py
└── frontend/
    ├── index.html  package.json  vite.config.js
    └── src/
        ├── App.jsx  main.jsx  index.css
        ├── pages/       LoginPage  RegisterPage  DashboardPage
        ├── components/  AuthLayout  KeyModal  VerifyModal  ShareModal  DownloadModal
        └── services/    api.js
```

---

## Setup (Windows PowerShell)

### Backend

```powershell
cd hgdss\backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload
```

API docs: http://localhost:8000/docs

### Frontend (new window)

```powershell
cd hgdss\frontend
npm install
npm run dev
```

App: http://localhost:5173

---

## API reference

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Register — runs BB84 QKD, generates H-group signing keypair |
| POST | `/auth/login` | Login — returns JWT |
| GET  | `/auth/me` | Current user + public key |
| GET  | `/files/` | List owned + shared files |
| POST | `/files/upload` | Upload → BB84 key gen → AES encrypt → H-group sign → **key shown once** |
| POST | `/files/download/{id}` | Provide key → decrypt → stream file |
| POST | `/files/share/{id}` | Provide owner key → re-key per BB84 → re-encrypt → **share key shown once** |
| POST | `/files/download-share/{id}` | Recipient provides share key → decrypt → stream |
| GET  | `/files/verify/{id}` | Check hash integrity + H-group signature validity |

---

## How it works

### Upload
1. BB84 runs with 512 simulated qubits → sifted key → HKDF → 32-byte AES key
2. File encrypted with AES-256-GCM
3. SHA-256 of ciphertext signed with uploader's Heisenberg group private key
4. AES key displayed once on screen — download as `.key` file or copy
5. Server stores: ciphertext + signature. Never the key.

### Share
1. Owner provides their file key → server decrypts
2. New BB84 run → new AES key for this recipient
3. Plaintext re-encrypted with new key
4. New key shown once to owner to forward to recipient

### Verify
1. Re-read ciphertext from disk
2. Recompute SHA-256 — compare with signed hash (tamper check)
3. Verify Heisenberg group Schnorr signature: g^z == r * pk^e
4. Both checks must pass for `overall_valid: true`
