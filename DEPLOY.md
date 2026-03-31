# Deployment Guide — Heisenberg Group Digital Signature System

Stack: **GitHub → Render (backend) + Netlify (frontend) + Cloudflare (domain)**

---

## Step 1 — Push to GitHub

1. Go to https://github.com/new and create a new **public** repository
   - Name: `heisenberg-dss` (or anything you like)
   - Leave everything else default → click **Create repository**

2. Open PowerShell in your `hgdss` folder and run:

```powershell
git init
git add .
git commit -m "Initial commit — Heisenberg Group Digital Signature System"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/heisenberg-dss.git
git push -u origin main
```

---

## Step 2 — Deploy backend on Render

1. Go to https://render.com → sign up with GitHub

2. Click **New → Web Service**

3. Connect your `heisenberg-dss` GitHub repo

4. Fill in the settings:
   - **Name**: `hgdss-backend`
   - **Root Directory**: `backend`
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Plan**: Free

5. Under **Environment Variables**, add:

   | Key | Value |
   |-----|-------|
   | `SECRET_KEY` | (click Generate — copy this somewhere safe) |
   | `DATABASE_URL` | `sqlite:///./hgdss.db` |
   | `APP_NAME` | `Heisenberg Group Digital Signature System` |
   | `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` |
   | `ALLOWED_ORIGINS` | `https://YOUR_NETLIFY_URL.netlify.app` ← fill in after Step 3 |
   | `PYTHON_VERSION` | `3.11.0` |

6. Click **Create Web Service**

7. Wait ~3 minutes for the first deploy. You'll get a URL like:
   `https://hgdss-backend.onrender.com`

   **Copy this URL — you need it for Step 3.**

> Note: On the free tier Render spins down after 15 mins of inactivity.
> First request after sleep takes ~30 seconds. Upgrade to $7/mo Starter to avoid this.

---

## Step 3 — Deploy frontend on Netlify

1. Go to https://netlify.com → sign up with GitHub

2. Click **Add new site → Import an existing project → GitHub**

3. Select your `heisenberg-dss` repo

4. Fill in build settings:
   - **Base directory**: `frontend`
   - **Build command**: `npm run build`
   - **Publish directory**: `frontend/dist`

5. Under **Environment Variables**, add:

   | Key | Value |
   |-----|-------|
   | `VITE_API_URL` | `https://hgdss-backend.onrender.com` |

6. Click **Deploy site**

7. You'll get a URL like `https://random-name-123.netlify.app`

   Go to **Site settings → Domain management → Options → Edit site name**
   Change it to something like `heisenberg-dss` → your URL becomes:
   `https://heisenberg-dss.netlify.app`

8. Go back to Render → update `ALLOWED_ORIGINS` to your Netlify URL:
   `https://heisenberg-dss.netlify.app`
   Then click **Save** — Render will redeploy automatically.

---

## Step 4 — Buy domain on Cloudflare

1. Go to https://cloudflare.com → sign up

2. Click **Register a Domain** (left sidebar)

3. Search for something like:
   - `heisenbergdss.com`
   - `heisenberg-signatures.com`
   - `hgdss.app`
   - `quantumsign.app`

4. Pick one (~$8–10/yr) → add to cart → checkout

---

## Step 5 — Connect domain to Netlify (frontend)

1. In Netlify → **Site settings → Domain management → Add domain**
2. Enter your domain e.g. `heisenbergdss.com` → click Verify
3. Netlify will give you nameserver addresses like:
   ```
   dns1.p01.nsone.net
   dns2.p01.nsone.net
   ```
4. In Cloudflare → your domain → **DNS → Nameservers**
   Switch to **Custom nameservers** → paste Netlify's nameservers
   (Or keep Cloudflare NS and add a CNAME record — see below)

### Alternative — keep Cloudflare nameservers (recommended)

In Cloudflare DNS, add:
```
Type  Name   Content                          Proxy
CNAME @      heisenberg-dss.netlify.app       ON
CNAME www    heisenberg-dss.netlify.app       ON
```

Then in Netlify add `heisenbergdss.com` and `www.heisenbergdss.com` as custom domains.
Netlify will auto-provision a free SSL certificate via Let's Encrypt.

---

## Step 6 — Connect domain to Render (backend API)

Option A — subdomain (recommended):
```
Type   Name    Content                          Proxy
CNAME  api     hgdss-backend.onrender.com       OFF  ← must be OFF for Render
```

This gives you `api.heisenbergdss.com` as your backend URL.

Then update:
- Render env var `ALLOWED_ORIGINS` → `https://heisenbergdss.com,https://www.heisenbergdss.com`
- Netlify env var `VITE_API_URL` → `https://api.heisenbergdss.com`
- Redeploy both services

Option B — keep using the Render subdomain (simpler, no custom domain for API needed)

---

## Final architecture

```
User browser
    │
    ├── https://heisenbergdss.com  →  Netlify (React frontend)
    │                                  └── Cloudflare CDN + SSL
    │
    └── https://api.heisenbergdss.com  →  Render (FastAPI backend)
                                           └── SQLite DB + file storage
```

---

## After deployment — test checklist

- [ ] Register a new account → check QBER shown on screen
- [ ] Upload a file → key modal appears with download button
- [ ] Download `.key` file → check it opens as plain text
- [ ] Decrypt the file using pasted key
- [ ] Decrypt the file using uploaded `.key` file
- [ ] Share file with a second account → share key shown once
- [ ] Recipient downloads using share key
- [ ] Verify signature → both layers show VALID
- [ ] Try wrong key → confirm 400 error returned

---

## Troubleshooting

**CORS error in browser console**
→ `ALLOWED_ORIGINS` on Render doesn't include your Netlify URL exactly.
   Check for trailing slashes — `https://heisenberg-dss.netlify.app` not `https://heisenberg-dss.netlify.app/`

**"Failed to fetch" on login/register**
→ Render backend is sleeping (free tier). Wait 30 seconds and retry.
   Or check Render logs for startup errors.

**Build fails on Netlify**
→ Make sure `VITE_API_URL` env var is set before deploying.
   Trigger a manual redeploy after adding the variable.

**Files not persisting after Render redeploy**
→ Render free tier has ephemeral storage — files uploaded are lost on redeploy.
   For production use, upgrade to a paid plan and mount a Render Disk,
   or swap SQLite for PostgreSQL (Render provides a free PostgreSQL instance).
