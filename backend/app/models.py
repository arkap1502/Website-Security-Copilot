from pydantic import BaseModel, HttpUrl
from typing import List, Literal


class Finding(BaseModel):
    id: str
    severity: Literal["critical", "high", "medium", "low", "info"]
    title: str
    evidence: str
    why: str
    fix: str


class ScanRequest(BaseModel):
    url: HttpUrl


class ScanResponse(BaseModel):
    url: str
    score: int
    grade: str
    verdict: Literal["safe", "suspicious", "harmful"]
    summary: str
    findings: List[Finding]
