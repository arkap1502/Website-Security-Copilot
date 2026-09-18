# Website Security Copilot

An AI-powered assistant that scans, explains, and helps fix website security issues — like having a security engineer sitting next to you.

It works in **2 modes:**

1. **Manual Scan Mode:** Takes a URL as input, runs automated security checks (headers, SSL/TLS, open ports, common vulnerabilities, misconfigurations), and then uses AI to explain risks in plain English with prioritized, actionable fixes.
2. **Always-On Guard Mode (NEW):** A browser-level AI agent that you can manually turn **ON or OFF**. When **ON**, it automatically watches **every website you open by itself** — not just one website — and gives you an instant AI verdict / description that **this website is safe or harmful**. If it finds any suspicious website, it **automatically blocks it**. If you still want to force-open a blocked site, you **must turn OFF the Copilot first**.

---

## Features

**MVP (v0.1)**
- URL input → one-click security scan
- Security headers check (`CSP`, `HSTS`, `X-Frame-Options`, `X-Content-Type-Options`, etc.)
- SSL/TLS validation (expiry, issuer, protocol version, mixed content)
- Cookie flags check (`Secure`, `HttpOnly`, `SameSite`)
- Open ports / technology fingerprinting (banner grabbing)
- AI-generated report: risk score + plain-English explanations + fix snippets
- **Always-On Guard (ON/OFF toggle):**
  - Manual ON/OFF switch in UI / browser extension popup
  - When ON: auto-watches **all websites you open**, no need to paste URLs
  - Shows instant AI verdict badge + description: `Safe ✅ / Suspicious ⚠️ / Harmful/Blocked ⛔` with reason in plain English
  - **Auto-Block:** suspicious / harmful sites are blocked automatically before they fully load
  - **Force-Open rule:** to visit a blocked site anyway, user must turn OFF the Copilot — prevents accidental clicks on phishing/malware pages

**v0.2+**
- OWASP Top 10 passive checks (XSS reflection, SQLi error-based probes, CORS misconfig, directory listing)
- Subdomain / DNS checks (SPF, DMARC, DKIM, DNSSEC)
- JS library vulnerability detection (retire.js style)
- Continuous monitoring + alerts (re-scan on schedule)
- GitHub / CI integration (fail PR on critical misconfig)
- Chat interface: "How do I fix HSTS on Nginx?" with codebase-aware answers

---

## Always-On Guard Mode — How It Works

This Copilot is not limited to one website. It acts as an **AI agent for all websites you browse**.

1. **Manual ON/OFF Control:**
   - User controls the Copilot with a simple toggle (extension popup / toolbar button / web UI switch).
   - `OFF` = Copilot does nothing, browsing is normal.
   - `ON` = Copilot starts auto-protection immediately.

2. **Automatic Watching (when ON):**
   - No URL paste needed. Copilot automatically detects every new tab / navigation / link you open by itself.
   - Runs fast passive checks in background: URL reputation, SSL cert, security headers, phishing keywords, suspicious redirects, fake login forms, malicious JS patterns.
   - AI then shows a small popup/badge with a plain-English description, e.g.:
     - `Safe ✅ — This website uses valid HTTPS, has correct security headers, and shows no phishing signs.`
     - `Suspicious ⚠️ — This website has an expired certificate and asks for login over an insecure form. Be careful.`
     - `Harmful — Blocked ⛔ — This website matches known phishing/malware patterns and was blocked to protect you.`

3. **Automatic Blocking:**
   - If verdict is `Suspicious / Harmful`, Copilot **automatically blocks the page** before it can harm you (block screen + reason + risk score).
   - User cannot click-through / dismiss while Copilot is ON. This prevents accidental visits from phishing links, ads, or mistyped URLs.

4. **Force-Open Rule:**
   - If user really wants to open a blocked site anyway, they **must manually turn OFF the Copilot first**.
   - This is intentional friction: you take full responsibility when protection is OFF.
   - Recommended: turn ON again right after visiting.

```
OFF → browse freely, no checks, no blocks
ON  → auto-watch all sites → AI verdict (Safe/Harmful) → auto-block if suspicious
Blocked + ON  → cannot open, must turn OFF to force-open
```

**Example UX:**
- Toggle: `[ ● ON ] Website Security Copilot is protecting you`
- On safe site: `Copilot: example-bank.com looks Safe ✅ — valid SSL, no known threats.`
- On bad site: `Copilot: free-prize-login.xyz looks Harmful ⛔ — blocked. Reason: newly registered domain, fake login form, mismatched SSL. Turn OFF Copilot to force-open (not recommended).`

---

## Architecture

```
User (React UI) ──> API (FastAPI) ──> Scan Engine (Python workers)
                                          ├── Header / SSL / DNS checks
                                          ├── Port scan / fingerprinting
                                          └── Nuclei / ZAP (optional, active scan)
                         │
                         └── AI Copilot (LLM)
                              ├── Explains findings
                              ├── Generates fixes (Nginx/Apache/Next.js/Express)
                              └── Chat Q&A over scan results
                         │
                      Postgres/SQLite (scan history) + Redis (job queue)

Always-On Guard (Browser Extension / Background Agent):
Browser Tabs (all websites) ──> Guard Service (ON/OFF toggle)
                                     ├── Auto-watch navigation events
                                     ├── Fast passive verdict (Safe/Suspicious/Harmful)
                                     ├── AI description popup per site
                                     └── Auto-block + block page (bypass only if Copilot OFF)
```

**Design principles:**
1. Passive-safe by default. No aggressive exploitation. Active scans are opt-in.
2. Every finding must have: severity, evidence, why-it-matters, how-to-fix.
3. AI never invents findings — it only explains tool output.

---

## Tech Stack (recommended)

- **Frontend:** Next.js + Tailwind + shadcn/ui
- **Backend:** Python FastAPI
- **Scanner:** Python (`httpx`, `ssl`, `socket`, `dnspython`), + `nuclei` / `OWASP ZAP` for deep scans
- **Queue:** Redis + Celery / RQ (or just FastAPI BackgroundTasks for MVP)
- **DB:** SQLite (MVP) → Postgres (prod)
- **AI:** OpenAI / Anthropic / local Ollama via a single `LLM provider` interface
- **Deploy:** Docker Compose

---

## How to Implement It

### Prerequisites

- Python 3.11+, Node 20+, Docker (optional)
- An LLM API key (`OPENAI_API_KEY` or `ANTHROPIC_API_KEY`)

### 1. Scaffold the project

```bash
# repo structure to create:
Website-Security-Copilot/
├── extension/         # Browser extension (Always-On Guard) - load unpacked in Chrome/Edge
│   ├── manifest.json  # MV3, <all_urls>, storage + webNavigation + tabs
│   ├── background.js  # ON/OFF guard, auto-watch all sites, verdict + auto-block
│   ├── popup.html     # ON/OFF toggle + Safe/Harmful description
│   ├── popup.js
│   ├── content.js     # floating Copilot badge on every website
│   └── block.html     # block page (force-open only when OFF)
├── frontend/          # Next.js app
├── backend/
│   ├── app/
│   │   ├── main.py        # FastAPI entry
│   │   ├── scanners/      # headers.py, ssl_check.py, dns_check.py, ports.py
│   │   ├── ai/            # explainer.py, chat.py
│   │   └── models.py      # Scan, Finding schemas
│   ├── requirements.txt
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

### 1b. Add Copilot to Your Device as an Extension (Chrome / Edge / Brave)

This installs the Copilot as a browser extension on your device so it can guard **all websites you open**.

1. Open `chrome://extensions` (or `edge://extensions`).
2. Turn ON **Developer mode** (top-right).
3. Click **Load unpacked** → select the `extension/` folder from this project.
4. Click the puzzle 🧩 icon → **Pin** `Website Security Copilot`.
5. Click the Copilot icon:
   - Toggle **ON** = auto-watch every website by itself + show Safe/Harmful description + auto-block suspicious sites.
   - Toggle **OFF** = no checks, no blocks, browse freely.
6. Test it:
   - Open any safe site → you see `Copilot: Safe ✅ — valid HTTPS, no threats`.
   - Open a test bad URL like `http://free-prize-login-verify.xyz/login` → Copilot auto-blocks with reason.
   - While ON, you **cannot** click-through the block page. To force-open, you **must turn OFF** the Copilot first, then click Force-open. Turn it back ON after.

### 2. Backend — MVP scan engine

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install fastapi uvicorn httpx dnspython cryptography pydantic
```

Minimal `app/main.py`:

```python
from fastapi import FastAPI
from pydantic import BaseModel, HttpUrl

app = FastAPI(title="Website Security Copilot")

class ScanRequest(BaseModel):
    url: HttpUrl

@app.post("/api/scan")
def scan(req: ScanRequest):
    # 1. fetch headers with httpx
    # 2. check SSL expiry with ssl + socket
    # 3. check cookies, CORS, server banner
    # 4. return list of findings: {id, severity, title, evidence, fix}
    return {"url": str(req.url), "findings": []}

@app.get("/health")
def health():
    return {"ok": True}
```

Run it:

```bash
uvicorn app.main:app --reload --port 8000
```

Scanners to implement first (one file each, one function each):
1. `scanners/headers.py` — `check_security_headers(url)` → missing `Strict-Transport-Security`, `Content-Security-Policy`, etc.
2. `scanners/ssl_check.py` — `check_tls(hostname)` → cert expiry days, TLS 1.0/1.1 enabled, self-signed.
3. `scanners/cookies.py` — missing `Secure` / `HttpOnly` / `SameSite`.
4. `scanners/dns_email.py` — SPF / DMARC / DKIM presence.
5. `scanners/fingerprint.py` — `Server` / `X-Powered-By` leakage, outdated JS libs.

Each returns a normalized `Finding`:

```json
{
  "id": "missing-hsts",
  "severity": "medium",
  "title": "HSTS header missing",
  "evidence": "No Strict-Transport-Security header on https://example.com",
  "why": "Allows SSL-stripping downgrade attacks.",
  "fix": "add_header Strict-Transport-Security \"max-age=31536000; includeSubDomains\" always;"
}
```

### 3. AI explainer layer

`app/ai/explainer.py`:

- Input: list of `Finding`s
- Prompt template: "You are a web security engineer. Explain each finding for a junior dev, rank by risk, give copy-paste fix for Nginx + Apache + Next.js/Vercel..."
- Output: `summary`, `risk_score (0-100)`, `prioritized_fixes`
- Keep tool output as source of truth — LLM only explains, never adds new vulns.

### 4. Frontend — scan UI

```bash
npx create-next-app@latest frontend
cd frontend
npm install
```

Pages:
- `/` — URL input + "Scan" button + polling for results
- `/scan/[id]` — risk score donut, findings table (severity filter), "Copy fix" buttons, AI chat panel

Call `POST http://localhost:8000/api/scan` and render findings.

### 5. Run end-to-end

```bash
# terminal 1
cd backend && uvicorn app.main:app --reload
# terminal 2
cd frontend && npm run dev
```

Open `http://localhost:3000`, scan `https://example.com`.

### 6. Dockerize (optional but recommended)

```yaml
# docker-compose.yml
services:
  api:
    build: ./backend
    ports: ["8000:8000"]
  web:
    build: ./frontend
    ports: ["3000:3000"]
```

---

## Roadmap

### Phase 1 — MVP (Week 1–2) ✅ start here
- [ ] Project scaffold (FastAPI + Next.js)
- [ ] Passive scanners: headers, SSL, cookies, server banner
- [ ] Risk score (weighted: critical×10, high×5, medium×2, low×1)
- [ ] Basic report UI + PDF/markdown export
- [ ] AI explainer (single prompt, no chat yet)
- [ ] Always-On Guard MVP: ON/OFF toggle + auto-watch all open websites + Safe/Harmful AI verdict popup + auto-block suspicious sites (force-open only when OFF)

### Phase 2 — Real vuln coverage (Week 3–4)
- [ ] DNS/email security: SPF, DMARC, DKIM, DNSSEC
- [ ] CORS misconfiguration + open redirect smoke tests
- [ ] Directory listing / `.git` / `.env` exposure checks
- [ ] Retired JS library detection
- [ ] Nuclei integration (opt-in, `-severity critical,high` templates only)

### Phase 3 — Copilot chat (Week 5–6)
- [ ] Chat over scan context (RAG on findings + docs)
- [ ] Framework-aware fixes (detect Next.js / WordPress / Nginx and tailor snippets)
- [ ] False-positive feedback ("mark as ignored" → stored per domain)
- [ ] Auth + scan history (Clerk/Auth.js + Postgres)

### Phase 4 — Monitoring & CI (Week 7–8)
- [ ] Scheduled re-scans + email/Slack alerts on regression
- [ ] Public badge / score embed (`security: A`)
- [ ] GitHub Action: `security-copilot --fail-on critical`
- [ ] Rate limiting, scan allowlist, abuse guardrails, robots.txt respect

### Future / stretch
- OWASP ZAP full active scan mode (isolated worker)
- Subdomain enumeration + screenshot diffing
- Team workspaces, API keys, webhooks
- Local-LLM mode (Ollama) for offline / privacy-sensitive scans

---

## Risk Scoring (v0.1 formula)

```
score = 100 - min(100, 10*C + 5*H + 2*M + 1*L)
grade: A ≥90, B ≥75, C ≥60, D ≥40, F <40
```

Tune weights after testing against 20–30 real sites.

---

## Safety & Legal

- **Manual Scan Mode:** Only scan sites you own or have permission to test.
- **Always-On Guard Mode:** Only does passive, client-side safety checks on sites *you* open in your own browser (like an antivirus / Safe Browsing). No exploitation, no attacking remote sites.
- Default to **passive** checks (normal HTTP requests only). No fuzzing, no brute force, no DoS.
- Respect `robots.txt`, throttle requests, set a clear `User-Agent: WebsiteSecurityCopilot/0.1`.
- Add a disclaimer + "I own this site / have permission" checkbox in the manual-scan UI.
- Guard block page must clearly explain why it was blocked + how to turn OFF Copilot to force-open at user's own risk.

---

## Deploy for Free (built MVP — verified working)

What I built for you (tested: backend `/health` + `/api/scan` OK, frontend `next build` OK):

```
Website-Security-Copilot/
├── extension/   → browser guard (load unpacked, works offline)
├── backend/     → FastAPI: /health, /api/verdict, /api/scan (headers/SSL/cookies/phishing)
└── frontend/    → Next.js: URL scan UI + Guard ON/OFF demo
```

### Where to deploy free

| Part | Best free host | Why |
|---|---|---|
| Frontend (`frontend/`) | **Vercel Free** | Native Next.js, free SSL, `vercel --prod` in 2 min |
| Backend (`backend/`) | **Render Free** (Docker) | Free web service, uses `render.yaml` + `backend/Dockerfile` already added |
| Alt backend | **Hugging Face Spaces** (Docker, free) or **Railway trial** | Good if Render sleeps |
| Extension | **Load unpacked** free; **Edge Add-ons** free publish; **Chrome Web Store** $5 one-time | No server needed |

Note: Render free sleeps after inactivity (~30s cold start). That is normal.

### A. Deploy backend to Render (free)

1. Push this folder to GitHub (root must contain `render.yaml` + `backend/`).
2. Go to `render.com` → New → Blueprint → select your repo.
3. It detects `security-copilot-api` (Docker, free, health check `/health`).
4. Deploy → copy URL, e.g. `https://security-copilot-api.onrender.com`.
5. Test: open `https://<your-api>/health` → `{"ok": true}`, and `.../api/verdict?url=https://example.com`.

### B. Deploy frontend to Vercel (free)

1. Go to `vercel.com` → Add New Project → import same GitHub repo.
2. Root Directory = `frontend`, Framework = Next.js (auto).
3. Env var: `NEXT_PUBLIC_API_URL` = your Render URL from step A (e.g. `https://security-copilot-api.onrender.com`).
4. Deploy → you get `https://<your-app>.vercel.app`. Open it, scan `https://example.com`.

Local run (same as cloud):
```bash
# backend
cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload --port 8000
# frontend (new terminal)
cd frontend && npm install && npm run dev
# open http://localhost:3000, API at http://localhost:8000/health
```

### C. Ship the extension (free)

- Dev/own device: `chrome://extensions` → Developer mode → Load unpacked → `extension/` (already in repo).
- Share free: GitHub Releases → upload `extension.zip` + install instructions.
- Public store: Edge Add-ons (free) first, Chrome Web Store later ($5 fee). No code change needed.

---

---

## Contributing

1. Pick one unchecked box in the Roadmap.
2. One scanner = one file + one test (`pytest backend/tests/test_headers.py`).
3. Open a PR with sample output (before/after JSON).

---

## License

MIT — free for personal and commercial use. You are responsible for lawful use.
