"""Template explainer (no LLM key needed). Swap with OpenAI later via LLM provider interface."""


def risk_score(findings: list[dict]) -> tuple[int, str]:
    weights = {"critical": 10, "high": 5, "medium": 2, "low": 1, "info": 0}
    penalty = sum(weights.get(f.get("severity", "info"), 0) for f in findings)
    score = max(0, 100 - min(100, penalty))
    grade = "A" if score >= 90 else "B" if score >= 75 else "C" if score >= 60 else "D" if score >= 40 else "F"
    return score, grade


def explain(url: str, verdict: str, findings: list[dict], score: int) -> str:
    if verdict == "harmful":
        base = f"{url} looks Harmful — blocked. It shows phishing/malware patterns. Do not enter passwords or download files."
    elif verdict == "suspicious":
        base = f"{url} looks Suspicious — be careful. It has risky signs (see findings). Avoid logging in until fixed."
    elif findings:
        base = f"{url} loads but has {len(findings)} security issue(s). Fix the high-severity items below, then it can be considered safe."
    else:
        base = f"{url} looks Safe — valid HTTPS, correct headers, no phishing signs found."
    if findings:
        top = sorted(findings, key=lambda f: {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}.get(f.get("severity", "info"), 5))[:3]
        base += " Top issues: " + "; ".join(f"{t['title']} ({t['severity']})" for t in top) + "."
    return base + f" Safety score {score}/100."
