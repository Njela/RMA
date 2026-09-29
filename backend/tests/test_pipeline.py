"""End-to-end tests: HTTP in, full pipeline, state and audit trail out."""
import hashlib
import hmac
import json

from app.api import deps
from app.config import get_settings
from app.pipeline import llm, rma

from .conftest import STAFF

DOA = "My new laptop is dead on arrival, won't power on out of the box. Serial 5CG2481XYZ. Call +254 712 345 678, grace@example.com"


def test_in_warranty_claim_is_auto_approved(submit, staff_ticket):
    t = staff_ticket(submit(DOA)["id"])
    assert t["status"] == "rma_issued" and t["route"] == "auto_rma" and t["warranty_status"] == "in_warranty" and t["serial_number"] == "5CG2481XYZ"
    assert rma.is_valid_rma_number(t["rma_number"])
    assert t["shipment"]["status"] == "label_created"
    assert {d["kind"] for d in t["deadlines"]} == {"return_shipment", "delivery"}
    # PII never reaches the model-facing text, but raw text is kept for staff
    assert "grace@example.com" not in t["body_scrubbed"] and "712 345 678" not in t["body_scrubbed"]
    assert "grace@example.com" in t["body_raw"]
    stages = [e["actor"] for e in t["events"] if e["event_type"] == "status_change"]
    assert stages == ["pipeline:pii", "pipeline:llm", "pipeline:erp", "pipeline:router"]


def test_out_of_warranty_goes_to_paid_repair(submit, staff_ticket):
    t = staff_ticket(submit("Desktop stopped working, serial SN-OLD-77821", serial="SN-OLD-77821")["id"])
    assert (t["status"], t["route"], t["warranty_status"]) == ("paid_repair", "paid_repair", "out_of_warranty")
    assert t["rma_number"] is None and {d["kind"] for d in t["deadlines"]} == {"quote_response"}


def test_unknown_serial_goes_to_tier1(submit, staff_ticket):
    t = staff_ticket(submit("Laptop not working, serial ZZ99887766")["id"])
    assert (t["status"], t["route_reason"]) == ("human_review", "UNKNOWN_SERIAL")
    assert {d["kind"] for d in t["deadlines"]} == {"human_first_response"}


def test_missing_serial_low_confidence_goes_to_tier1(submit, staff_ticket):
    t = staff_ticket(submit("My laptop stopped working yesterday, please help me")["id"])
    assert (t["status"], t["route_reason"]) == ("human_review", "NO_SERIAL")


def test_damage_in_warranty_needs_human_inspection(submit, staff_ticket):
    t = staff_ticket(submit("I dropped it and the screen cracked. Serial 5CG2481XYZ")["id"])
    assert (t["status"], t["route_reason"]) == ("human_review", "NEEDS_INSPECTION")


def test_declared_and_message_serials_that_differ_are_flagged(submit, staff_ticket):
    t = staff_ticket(submit("Won't power on, brand new. Serial FOC2211ABCD", serial="5CG2481XYZ")["id"])
    assert t["route_reason"] == "MULTIPLE_SERIALS"


def test_repeat_claims_escalate(submit, staff_ticket):
    ids = [submit(DOA, email=f"u{i}@example.com")["id"] for i in range(3)]
    assert [staff_ticket(i)["status"] for i in ids] == ["rma_issued", "rma_issued", "human_review"]
    assert staff_ticket(ids[2])["route_reason"] == "REPEAT_CLAIM"


def test_idempotency_key_prevents_duplicates(submit, client):
    a, b = submit(DOA, key="k-1"), submit(DOA, key="k-1")
    assert a["id"] == b["id"]
    assert len(client.get("/api/staff/tickets", headers=STAFF).json()) == 1


def test_llm_failure_degrades_to_human(monkeypatch, submit, staff_ticket):
    class Boom:
        name = "boom"
        def extract(self, text): raise TimeoutError("model timed out")
    monkeypatch.setattr(llm, "get_extractor", lambda: Boom())
    t = staff_ticket(submit(DOA)["id"])
    assert (t["status"], t["route_reason"]) == ("human_review", "LLM_FAILURE")


def test_automation_modes(submit, staff_ticket):
    s = get_settings()
    s.automation_level = "suggest"
    t = staff_ticket(submit(DOA)["id"])
    assert (t["status"], t["route_reason"]) == ("human_review", "SUGGEST_ONLY") and t["suggested_route"] == "auto_rma"
    s.automation_level = "off"
    t = staff_ticket(submit(DOA, email="b@example.com")["id"])
    assert t["route_reason"] == "AUTOMATION_OFF" and t["extraction"] is None


def test_email_intake_webhook(client, staff_ticket):
    payload = {"message_id": "<abc@mail>", "sender": "Ann@Example.com", "sender_name": "Ann Otieno",
               "subject": "Faulty switch", "body": "Switch stopped working, serial FOC2211ABCD. Thanks, Ann"}
    assert client.post("/api/webhooks/email", json=payload).status_code == 401
    h = {"X-Webhook-Secret": get_settings().inbound_email_secret}
    a, b = client.post("/api/webhooks/email", json=payload, headers=h), client.post("/api/webhooks/email", json=payload, headers=h)
    assert a.json()["id"] == b.json()["id"]
    t = staff_ticket(a.json()["id"])
    assert t["source"] == "email" and t["customer_email"] == "ann@example.com" and t["status"] == "rma_issued"
    assert "Ann" not in t["body_scrubbed"]


def _signed(client, tracking, status, secret=None):
    body = json.dumps({"tracking_number": tracking, "status": status})
    sig = "sha256=" + hmac.new((secret or get_settings().carrier_webhook_secret).encode(), body.encode(), hashlib.sha256).hexdigest()
    return client.post("/api/webhooks/carrier", content=body, headers={"X-Carrier-Signature": sig, "Content-Type": "application/json"})


def test_carrier_webhook_drives_status_and_sla(client, submit, staff_ticket):
    t = staff_ticket(submit(DOA)["id"])
    tracking = t["shipment"]["tracking_number"]
    assert _signed(client, tracking, "in_transit", secret="wrong").status_code == 401
    assert _signed(client, tracking, "in_transit").json() == {"changed": True}
    assert _signed(client, tracking, "in_transit").json() == {"changed": False}   # idempotent
    t = staff_ticket(t["id"])
    assert t["status"] == "in_transit"
    assert {d["kind"]: d["resolved_at"] is not None for d in t["deadlines"]} == {"return_shipment": True, "delivery": False}
    _signed(client, tracking, "delivered")
    t = staff_ticket(t["id"])
    assert t["status"] == "delivered" and all(d["resolved_at"] for d in t["deadlines"])


def test_carrier_exception_returns_ticket_to_humans(client, submit, staff_ticket):
    t = staff_ticket(submit(DOA)["id"])
    _signed(client, t["shipment"]["tracking_number"], "exception")
    t = staff_ticket(t["id"])
    assert t["status"] == "human_review"


def test_staff_decisions(client, submit, staff_ticket):
    tid = submit("Laptop stopped working, serial ZZ99887766")["id"]
    url = f"/api/staff/tickets/{tid}/decision"
    assert client.post(url, json={"action": "reject"}).status_code == 401          # no API key
    r = client.post(url, headers=STAFF, json={"action": "approve_rma", "serial_number": "NOT-IN-ERP-1"})
    assert r.status_code == 422                                                      # human cannot bypass the ERP
    r = client.post(url, headers=STAFF, json={"action": "approve_rma", "serial_number": "FOC2211ABCD", "note": "typo fixed"})
    assert r.status_code == 200 and r.json()["status"] == "rma_issued" and rma.is_valid_rma_number(r.json()["rma_number"])
    assert all(d["resolved_at"] for d in r.json()["deadlines"] if d["kind"] == "human_first_response")
    assert client.post(url, headers=STAFF, json={"action": "reject"}).status_code == 409   # no longer in human_review


def test_public_tracking_hides_internal_data(client, submit):
    created = submit(DOA)
    view = client.get(f"/api/track/{created['public_token']}").json()
    assert view["status"] == "rma_issued" and view["rma_number"] and view["label_url"]
    assert "grace@example.com" not in json.dumps(view)
    assert client.get("/api/track/does-not-exist").status_code == 404


def test_warranty_lookup_is_minimal(client):
    ok = client.get("/api/serials/5cg2481xyz/warranty").json()
    assert ok["found"] and ok["in_warranty"] and set(ok) == {"found", "in_warranty", "warranty_expires_on"}
    assert client.get("/api/serials/NOPE/warranty").json() == {"found": False, "in_warranty": None, "warranty_expires_on": None}


def test_input_validation_and_rate_limit(client):
    assert client.post("/api/tickets", json={"customer_name": "A", "customer_email": "bad", "description": "x"}).status_code == 422
    get_settings().public_rate_limit_per_minute = 2
    deps._hits.clear()
    codes = [client.get("/api/serials/X/warranty").status_code for _ in range(3)]
    assert codes == [200, 200, 429]
