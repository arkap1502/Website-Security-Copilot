"""SSL/TLS validation: expiry, issuer, self-signed. Passive handshake only."""
import socket
import ssl
from datetime import datetime, timezone


def check_tls(hostname: str, port: int = 443, timeout: float = 6.0) -> list[dict]:
    findings: list[dict] = []
    if hostname in ("localhost", "127.0.0.1"):
        return findings
    try:
        ctx = ssl.create_default_context()
        with socket.create_connection((hostname, port), timeout=timeout) as sock:
            with ctx.wrap_socket(sock, server_hostname=hostname) as ssock:
                cert = ssock.getpeercert()
                # expiry
                not_after = cert.get("notAfter")
                if not_after:
                    exp = datetime.strptime(not_after, "%b %d %H:%M:%S %Y %Z").replace(tzinfo=timezone.utc)
                    days = (exp - datetime.now(timezone.utc)).days
                    if days < 0:
                        findings.append(
                            {
                                "id": "ssl-expired",
                                "severity": "critical",
                                "title": "SSL certificate expired",
                                "evidence": f"Expired {abs(days)} days ago ({not_after})",
                                "why": "Browsers block it; traffic can be intercepted.",
                                "fix": "Renew certificate (Let's Encrypt / certbot renew).",
                            }
                        )
                    elif days < 14:
                        findings.append(
                            {
                                "id": "ssl-expiring",
                                "severity": "high",
                                "title": f"SSL expires in {days} days",
                                "evidence": f"notAfter={not_after}",
                                "why": "Outage + trust warnings imminent.",
                                "fix": "Auto-renew with certbot cron.",
                            }
                        )
                # issuer
                issuer = dict(x[0] for x in cert.get("issuer", ()))
                if "Let's Encrypt" not in str(issuer) and not issuer:
                    findings.append(
                        {
                            "id": "ssl-issuer",
                            "severity": "info",
                            "title": "Unusual certificate issuer",
                            "evidence": str(issuer),
                            "why": "May be self-signed or internal CA.",
                            "fix": "Use a public CA for internet sites.",
                        }
                    )
    except ssl.SSLCertVerificationError as e:
        findings.append(
            {
                "id": "ssl-invalid",
                "severity": "critical",
                "title": "Certificate validation failed",
                "evidence": str(e)[:300],
                "why": "Self-signed / hostname mismatch / untrusted chain.",
                "fix": "Install valid cert matching hostname.",
            }
        )
    except Exception as e:
        findings.append(
            {
                "id": "ssl-error",
                "severity": "info",
                "title": "Could not complete TLS handshake",
                "evidence": str(e)[:300],
                "why": "Host may not support HTTPS or blocked handshake.",
                "fix": "Ensure port 443 serves valid TLS 1.2+.",
            }
        )
    return findings
