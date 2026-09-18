"""Passive security-header check. No exploitation, one normal GET."""

REQUIRED = {
    "strict-transport-security": (
        "medium",
        "HSTS header missing",
        "Allows SSL-stripping downgrade attacks.",
        'add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;',
    ),
    "content-security-policy": (
        "high",
        "CSP header missing",
        "Allows XSS / clickjacking payloads to execute.",
        "Header set Content-Security-Policy \"default-src 'self'\"",
    ),
    "x-frame-options": (
        "medium",
        "X-Frame-Options missing",
        "Site can be embedded in invisible iframes (clickjacking).",
        "add_header X-Frame-Options \"SAMEORIGIN\" always;",
    ),
    "x-content-type-options": (
        "low",
        "X-Content-Type-Options missing",
        "Browser may MIME-sniff responses into executable content.",
        'add_header X-Content-Type-Options "nosniff" always;',
    ),
    "referrer-policy": (
        "low",
        "Referrer-Policy missing",
        "Full URLs may leak to third parties.",
        'add_header Referrer-Policy "strict-origin-when-cross-origin" always;',
    ),
}


def check_security_headers(url: str, headers: dict) -> list[dict]:
    lowered = {k.lower(): v for k, v in headers.items()}
    findings = []
    for name, (sev, title, why, fix) in REQUIRED.items():
        if name not in lowered:
            findings.append(
                {
                    "id": f"missing-{name}",
                    "severity": sev,
                    "title": title,
                    "evidence": f"No {name} header on {url}",
                    "why": why,
                    "fix": fix,
                }
            )
    # Server banner leakage (info)
    server = lowered.get("server", "") or lowered.get("x-powered-by", "")
    if server:
        findings.append(
            {
                "id": "server-banner",
                "severity": "info",
                "title": "Server banner exposed",
                "evidence": f"Server: {server}",
                "why": "Helps attackers fingerprint version.",
                "fix": "Hide version: server_tokens off; (nginx) / ServerSignature Off (apache).",
            }
        )
    return findings
