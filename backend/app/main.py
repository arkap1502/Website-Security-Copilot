"""Website Security Copilot API — free-deploy ready (Render / HuggingFace / Docker)."""
from urllib.parse import urlparse

import httpx
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from .ai.explainer import explain, risk_score
from .models import Finding, ScanRequest, ScanResponse
from .scanners.cookies import check_cookies
from .scanners.headers import check_security_headers
from .scanners.ssl_check import check_tls
from .scanners.verdict import quick_verdict

app = FastAPI(title="Website Security Copilot")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # lock to your Vercel domain in prod
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/api/verdict")
def verdict(url: str = Query(..., min_length=4, max_length=2000)):
    """Fast guard check used by the browser extension + frontend badge."""
    v = quick_verdict(url)
    return {"url": url, **v}


@app.post("/api/scan", response_model=ScanResponse)
def scan(req: ScanRequest):
    url = str(req.url)
    host = urlparse(url).hostname or ""

    # 1. fetch headers + cookies (single passive GET)
    headers: dict = {}
    set_cookies: list[str] = []
    try:
        r = httpx.get(url, timeout=10, follow_redirects=True, headers={"User-Agent": "WebsiteSecurityCopilot/0.1"})
        headers = dict(r.headers)
        # httpx merges set-cookie; grab raw if available
        raw = r.headers.get_list("set-cookie") if hasattr(r.headers, "get_list") else []
        set_cookies = raw or ([r.headers["set-cookie"]] if "set-cookie" in r.headers else [])
    except Exception as e:
        headers = {}
        set_cookies = []

    findings: list[dict] = []
    findings += check_security_headers(url, headers)
    findings += check_cookies(set_cookies)
    if url.startswith("https"):
        findings += check_tls(host)
    # phishing heuristic folded in as findings too
    v = quick_verdict(url)
    if v["verdict"] in ("suspicious", "harmful"):
        findings.append(
            {
                "id": "phishing-heuristic",
                "severity": "critical" if v["verdict"] == "harmful" else "high",
                "title": f"Phishing pattern: {v['verdict']}",
                "evidence": " | ".join(v["reasons"]) or "Heuristic match",
                "why": "URL matches known scam/phishing shapes.",
                "fix": "Do not visit; verify domain spelling and certificate.",
            }
        )

    score, grade = risk_score(findings)
    # heuristic can only lower verdict, deep findings decide final
    final = v["verdict"]
    if any(f["severity"] == "critical" for f in findings):
        final = "harmful"
    elif any(f["severity"] == "high" for f in findings) and final == "safe":
        final = "suspicious"

    summary = explain(url, final, findings, score)
    return ScanResponse(
        url=url,
        score=score,
        grade=grade,
        verdict=final,  # type: ignore
        summary=summary,
        findings=[Finding(**f) for f in findings],
    )
