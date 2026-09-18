"""Phishing-heuristic verdict shared by API + extension. Fast, no exploitation."""
from urllib.parse import urlparse
import re


def quick_verdict(raw_url: str) -> dict:
    try:
        u = urlparse(raw_url)
        host = (u.hostname or "").lower()
        full = raw_url.lower()
    except Exception:
        return {"verdict": "suspicious", "score": 50, "reasons": ["Unparsable URL"]}

    if host in ("localhost", "127.0.0.1"):
        return {"verdict": "safe", "score": 95, "reasons": ["Local development address"]}

    risk = 0
    reasons: list[str] = []
    if u.scheme == "http":
        risk += 30
        reasons.append("No HTTPS (insecure http://)")
    if re.match(r"^\d{1,3}(\.\d{1,3}){3}$", host):
        risk += 35
        reasons.append("Raw IP address instead of domain")
    if "@" in full:
        risk += 25
        reasons.append("'@' trick hides real destination")
    if host.count("-") >= 3:
        risk += 15
        reasons.append("Too many hyphens (typosquat pattern)")
    if "xn--" in host:
        risk += 25
        reasons.append("Punycode look-alike characters")
    for w in ["free-prize", "login-verify", "bank-secure", "account-suspended", "crypto-double", "airdrop-claim"]:
        if w in full:
            risk += 40
            reasons.append(f'Suspicious keyword "{w}"')
            break
    risk = min(100, risk)
    score = 100 - risk
    verdict = "harmful" if risk >= 50 else "suspicious" if risk >= 25 else "safe"
    return {"verdict": verdict, "score": score, "reasons": reasons}
