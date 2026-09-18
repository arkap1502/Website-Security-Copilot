"""Cookie flag check: Secure / HttpOnly / SameSite."""


def check_cookies(set_cookie_headers: list[str]) -> list[dict]:
    findings = []
    if not set_cookie_headers:
        return findings
    for i, c in enumerate(set_cookie_headers):
        low = c.lower()
        missing = []
        if "secure" not in low:
            missing.append("Secure")
        if "httponly" not in low:
            missing.append("HttpOnly")
        if "samesite" not in low:
            missing.append("SameSite")
        if missing:
            findings.append(
                {
                    "id": f"cookie-flags-{i}",
                    "severity": "medium",
                    "title": f"Cookie missing flags: {', '.join(missing)}",
                    "evidence": c[:250],
                    "why": "Allows session theft via XSS / network sniffing / CSRF.",
                    "fix": "Set-Cookie: ...; Secure; HttpOnly; SameSite=Lax",
                }
            )
    return findings
