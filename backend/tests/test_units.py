"""Unit tests for the deterministic building blocks."""
from datetime import date, datetime, timedelta, timezone

import pytest

from app.enums import Warranty
from app.pipeline import llm, pii, rma, router, sla
from app.pipeline.llm import Extraction


# ---- PII scrubber -----------------------------------------------------------------------------------
def test_pii_scrubs_contact_details_but_keeps_serials():
    text = "Serial 5CG2481XYZ. Call +254 712 345 678 or 0722 111 222, mail john@example.com. Regards, John Kamau"
    out = pii.scrub(text, known_names=["John Kamau"])
    assert "5CG2481XYZ" in out.text
    for leaked in ("john@example.com", "712 345 678", "0722 111 222", "Kamau"):
        assert leaked not in out.text
    assert out.counts["EMAIL"] == 1 and out.counts["PHONE"] == 2 and out.counts["NAME"] >= 1


def test_pii_scrubs_cards_and_ids_but_not_imei():
    out = pii.scrub("Card 4111 1111 1111 1111, national id 12345678, PIN A123456789Z. IMEI 490154203237518")
    assert "4111" not in out.text and "12345678" not in out.text and "A123456789Z" not in out.text
    assert "490154203237518" in out.text


def test_same_value_gets_same_token():
    out = pii.scrub("a@x.com and again a@x.com and b@x.com")
    assert out.text.count("[EMAIL_1]") == 2 and "[EMAIL_2]" in out.text


# ---- serial extraction guardrails ---------------------------------------------------------------------
def test_find_serials_ignores_dates_and_plain_words():
    assert llm.find_serials("bought on 2026-03-14, serial 5cg2481xyz, thanks") == ["5CG2481XYZ"]


def test_postprocess_drops_hallucinated_serials():
    ex = Extraction(serial_numbers=["ABC12345XYZ", "5CG2481XYZ"], confidence=0.9)
    fixed = llm._postprocess(ex, "my serial is 5cg2481xyz")
    assert fixed.serial_numbers == ["5CG2481XYZ"]
    assert llm._postprocess(Extraction(serial_numbers=["NOPE12345"], confidence=0.9), "nothing here").confidence <= 0.5


# ---- routing rules --------------------------------------------------------------------------------------
def _ex(category="hardware_fault", confidence=0.9):
    return Extraction(serial_numbers=["S1"], category=category, confidence=confidence)


@pytest.mark.parametrize("serials,warranty,prior,category,conf,route,code", [
    ([], Warranty.IN, 0, "hardware_fault", 0.9, "tier1_human", "NO_SERIAL"),
    (["A", "B"], Warranty.IN, 0, "hardware_fault", 0.9, "tier1_human", "MULTIPLE_SERIALS"),
    (["A"], Warranty.IN, 0, "hardware_fault", 0.4, "tier1_human", "LOW_CONFIDENCE"),
    (["A"], Warranty.UNKNOWN, 0, "hardware_fault", 0.9, "tier1_human", "UNKNOWN_SERIAL"),
    (["A"], Warranty.OUT, 0, "hardware_fault", 0.9, "paid_repair", "OUT_OF_WARRANTY"),
    (["A"], Warranty.IN, 2, "hardware_fault", 0.9, "tier1_human", "REPEAT_CLAIM"),
    (["A"], Warranty.IN, 0, "physical_damage", 0.9, "tier1_human", "NEEDS_INSPECTION"),
    (["A"], Warranty.IN, 0, "unknown", 0.9, "tier1_human", "NO_RULE_MATCHED"),
    (["A"], Warranty.IN, 0, "dead_on_arrival", 0.9, "auto_rma", "IN_WARRANTY_AUTO"),
    (["A"], Warranty.OUT, 0, "hardware_fault", 0.5, "tier1_human", "LOW_CONFIDENCE"),  # low confidence beats out-of-warranty
])
def test_routing_table(serials, warranty, prior, category, conf, route, code):
    d = router.decide(extraction=_ex(category, conf), serials=serials, warranty=warranty, prior_rmas=prior,
                      threshold=0.75, repeat_limit=2)
    assert (d.route.value, d.reason_code) == (route, code)


# ---- RMA numbers -------------------------------------------------------------------------------------------
def test_rma_number_format_check_digit_and_sequence(db):
    a, b = rma.next_rma_number(db, "ke"), rma.next_rma_number(db, "KE")
    db.commit()
    assert rma.is_valid_rma_number(a) and rma.is_valid_rma_number(b) and a != b
    assert a.split("-")[3] == "000001" and b.split("-")[3] == "000002"
    tampered = a[:-1] + str((int(a[-1]) + 1) % 10)
    assert not rma.is_valid_rma_number(tampered)


# ---- SLA business calendar and escalation -----------------------------------------------------------------
def test_business_hours_skip_weekend():
    friday_4pm_eat = datetime(2026, 10, 2, 13, 0, tzinfo=timezone.utc)      # Fri 16:00 EAT
    assert sla.add_business_hours(friday_4pm_eat, 4) == datetime(2026, 10, 5, 8, 0, tzinfo=timezone.utc)  # Mon 11:00 EAT


def test_business_hours_skip_holiday():
    tue = datetime(2026, 12, 24, 13, 0, tzinfo=timezone.utc)                # Thu 24 Dec 16:00 EAT; 25/26 Dec are holidays
    due = sla.add_business_hours(tue, 4)
    assert due == datetime(2026, 12, 28, 8, 0, tzinfo=timezone.utc)         # Mon 28 Dec 11:00 EAT


def test_sla_escalation_ladder_is_idempotent(db, submit):
    from app.models import RMATicket, SLADeadline
    t = RMATicket(source="portal", customer_email="a@b.co", body_raw="x", status="human_review")
    db.add(t); db.flush()
    start = datetime(2026, 9, 29, 6, 0, tzinfo=timezone.utc)
    sla.open_deadlines(db, t, [sla.DeadlineKind.RETURN_SHIPMENT], now=start)
    db.commit()
    window = timedelta(days=7)
    assert sla.scan(db, start + window * 0.5) == {"warning": 0, "lead": 0, "manager": 0}
    assert sla.scan(db, start + window * 0.8)["warning"] == 1
    assert sla.scan(db, start + window * 0.8)["warning"] == 0               # already fired
    assert sla.scan(db, start + window * 1.1)["lead"] == 1
    assert sla.scan(db, start + window * 1.6)["manager"] == 1
    assert db.query(SLADeadline).one().escalation_level == 3
