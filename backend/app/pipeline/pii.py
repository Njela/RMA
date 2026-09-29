"""Node 2 - PII scrubber (deterministic).

Runs BEFORE any text reaches the LLM. Replaces emails, phone numbers, card numbers, government IDs and
KRA PINs with stable placeholders such as [EMAIL_1]. Serial numbers and IMEIs are deliberately preserved.

Known limits: regexes cannot find arbitrary names or addresses. Names we already know (portal form name,
email sender name) are scrubbed explicitly; for full coverage plug an NER model (e.g. Presidio) into `scrub`.
"""
import re
from dataclasses import dataclass

EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
PHONE_INTL = re.compile(r"(?<!\w)\+\d{1,3}[\s-]?\(?\d{2,4}\)?[\s-]?\d{3}[\s-]?\d{3,4}(?!\w)")
PHONE_KE_LOCAL = re.compile(r"(?<!\w)0[17]\d{2}[\s-]?\d{3}[\s-]?\d{3}(?!\w)")
KRA_PIN = re.compile(r"\b[AP]\d{9}[A-Z]\b")
GOV_ID = re.compile(r"(?i)\b(national\s*id|id\s*(?:no|number)|passport)\s*(?:no\.?|number|#|:)?\s*([A-Z0-9]{6,12})\b")
CARD = re.compile(r"(?<!\w)(?:\d[ -]?){13,19}(?!\w)")
SERIAL_CONTEXT = re.compile(r"(?i)(serial|s/n|\bsn\b|imei)[^\n]{0,20}$")


@dataclass
class ScrubResult:
    text: str
    counts: dict[str, int]


def _luhn_ok(digits: str) -> bool:
    total = 0
    for i, ch in enumerate(reversed(digits)):
        d = int(ch)
        if i % 2 == 1:
            d = d * 2 - 9 if d > 4 else d * 2
        total += d
    return total % 10 == 0


def scrub(text: str, known_names: tuple[str, ...] | list[str] = ()) -> ScrubResult:
    counts: dict[str, int] = {}
    seen: dict[tuple[str, str], str] = {}

    def token(kind: str, original: str) -> str:
        key = (kind, original.lower())
        if key not in seen:
            counts[kind] = counts.get(kind, 0) + 1
            seen[key] = f"[{kind}_{counts[kind]}]"
        return seen[key]

    def card(m: re.Match) -> str:
        digits = re.sub(r"\D", "", m.group())
        if not (13 <= len(digits) <= 19 and _luhn_ok(digits)):
            return m.group()
        # IMEIs are Luhn-valid too: never scrub a number that is labelled as a serial/IMEI.
        if SERIAL_CONTEXT.search(m.string[max(0, m.start() - 30):m.start()]):
            return m.group()
        return token("CARD", digits)

    out = EMAIL.sub(lambda m: token("EMAIL", m.group()), text)
    out = KRA_PIN.sub(lambda m: token("KRA_PIN", m.group()), out)
    out = GOV_ID.sub(lambda m: m.group(0).replace(m.group(2), token("GOV_ID", m.group(2))), out)
    out = PHONE_INTL.sub(lambda m: token("PHONE", m.group()), out)
    out = PHONE_KE_LOCAL.sub(lambda m: token("PHONE", m.group()), out)
    out = CARD.sub(card, out)

    for full in known_names:
        for part in re.split(r"\s+", (full or "").strip()):
            if len(part) >= 3:
                out, n = re.subn(rf"\b{re.escape(part)}\b", "[NAME]", out, flags=re.I)
                if n:
                    counts["NAME"] = counts.get("NAME", 0) + n
    return ScrubResult(text=out, counts=counts)
