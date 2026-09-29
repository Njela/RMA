"""Node 5 - Routing logic / triage rules engine (deterministic, first match wins).

| # | Condition                                          | Route        | reason_code           |
|---|----------------------------------------------------|--------------|-----------------------|
| 1 | no serial number found                             | TIER1_HUMAN  | NO_SERIAL             |
| 2 | more than one distinct serial                      | TIER1_HUMAN  | MULTIPLE_SERIALS      |
| 3 | extraction confidence < threshold                  | TIER1_HUMAN  | LOW_CONFIDENCE        |
| 4 | serial not found in ERP                            | TIER1_HUMAN  | UNKNOWN_SERIAL        |
| 5 | out of warranty                                    | PAID_REPAIR  | OUT_OF_WARRANTY       |
| 6 | prior RMAs on this serial >= repeat limit          | TIER1_HUMAN  | REPEAT_CLAIM          |
| 7 | category needs physical inspection                 | TIER1_HUMAN  | NEEDS_INSPECTION      |
| 8 | in warranty + auto-eligible category               | AUTO_RMA     | IN_WARRANTY_AUTO      |
| 9 | anything else                                      | TIER1_HUMAN  | NO_RULE_MATCHED       |
"""
from dataclasses import dataclass, field

from ..enums import AUTO_ELIGIBLE_CATEGORIES, Route, Warranty
from .llm import Extraction


@dataclass
class Decision:
    route: Route
    reason_code: str
    reason: str
    checks: dict = field(default_factory=dict)


def decide(*, extraction: Extraction, serials: list[str], warranty: Warranty, prior_rmas: int,
           threshold: float, repeat_limit: int) -> Decision:
    checks = {"serials": serials, "confidence": extraction.confidence, "category": extraction.category,
              "warranty": warranty.value, "prior_rmas": prior_rmas, "threshold": threshold}

    def d(route: Route, code: str, reason: str) -> Decision:
        return Decision(route, code, reason, checks)

    if not serials:
        return d(Route.TIER1_HUMAN, "NO_SERIAL", "No serial number could be found in the claim")
    if len(serials) > 1:
        return d(Route.TIER1_HUMAN, "MULTIPLE_SERIALS", "Conflicting or multiple serial numbers")
    if extraction.confidence < threshold:
        return d(Route.TIER1_HUMAN, "LOW_CONFIDENCE", f"Confidence {extraction.confidence:.2f} < {threshold}")
    if warranty is Warranty.UNKNOWN:
        return d(Route.TIER1_HUMAN, "UNKNOWN_SERIAL", "Serial not found in ERP")
    if warranty is Warranty.OUT:
        return d(Route.PAID_REPAIR, "OUT_OF_WARRANTY", "Warranty expired")
    if prior_rmas >= repeat_limit:
        return d(Route.TIER1_HUMAN, "REPEAT_CLAIM", f"{prior_rmas} earlier RMAs on this serial")
    if extraction.category in {"physical_damage", "shipping_damage", "not_warranty"}:
        return d(Route.TIER1_HUMAN, "NEEDS_INSPECTION", f"Category '{extraction.category}' needs a human check")
    if extraction.category in AUTO_ELIGIBLE_CATEGORIES:
        return d(Route.AUTO_RMA, "IN_WARRANTY_AUTO", "In warranty and auto-eligible")
    return d(Route.TIER1_HUMAN, "NO_RULE_MATCHED", "No automatic rule matched")
