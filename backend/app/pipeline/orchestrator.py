"""Runs the whole flow for one ticket:

  1 Intake (already stored)  ->  2 PII scrubber  ->  3 LLM extraction  ->  4 ERP warranty check
  ->  5 Routing rules  ->  6 Auto-RMA | 7 Tier 1 human queue | 8 Paid repair  ->  9 SLA monitor

Design rules: every stage commits (progress survives a crash), the run is idempotent (only a ticket in
`received` is processed), and ANY failure degrades to human review - automation never blocks intake.
"""
import hashlib
import logging
import time
from datetime import date

from ..config import get_settings
from ..db import SessionLocal
from ..enums import DeadlineKind, Route, Status, Warranty
from ..models import LLMRun, RMATicket
from ..state import log_event, transition
from . import erp, llm, notify, pii, rma, router, sla

log = logging.getLogger(__name__)


def run_pipeline_task(ticket_id: int) -> None:
    with SessionLocal() as db:
        run_pipeline(db, ticket_id)


def run_pipeline(db, ticket_id: int) -> RMATicket | None:
    ticket = db.get(RMATicket, ticket_id)
    if ticket is None or ticket.status != Status.RECEIVED.value:
        return ticket  # idempotent: already processed (or unknown)
    try:
        _run(db, ticket, get_settings())
    except Exception as exc:  # noqa: BLE001 - deliberate catch-all, see module docstring
        log.exception("pipeline failed for ticket %s", ticket_id)
        db.rollback()
        ticket = db.get(RMATicket, ticket_id)
        _to_human(db, ticket, "PIPELINE_ERROR", f"{type(exc).__name__}: {exc}"[:200])
    db.commit()
    return ticket


def _to_human(db, ticket: RMATicket, code: str, reason: str, detail: dict | None = None) -> None:
    """Node 7: Tier 1 human agent queue."""
    if ticket.status == Status.HUMAN_REVIEW.value:
        return
    ticket.route, ticket.route_reason = Route.TIER1_HUMAN.value, code
    transition(db, ticket, Status.HUMAN_REVIEW, actor="pipeline:router",
               detail={"reason_code": code, "reason": reason, **(detail or {})})
    sla.open_deadlines(db, ticket, [DeadlineKind.HUMAN_FIRST_RESPONSE])
    notify.send(db, ticket, "new_tier1_ticket", audience="staff", reason_code=code)
    notify.send(db, ticket, "claim_received", audience="customer")


def _run(db, ticket: RMATicket, s) -> None:
    if s.automation_level == "off":
        return _to_human(db, ticket, "AUTOMATION_OFF", "Automation is disabled; manual triage")

    # 2. PII scrubber ------------------------------------------------------------------------------
    scrubbed = pii.scrub(ticket.body_raw, known_names=[ticket.customer_name or ""])
    ticket.body_scrubbed, ticket.redactions = scrubbed.text, scrubbed.counts
    transition(db, ticket, Status.SCRUBBED, actor="pipeline:pii", detail={"redactions": scrubbed.counts})
    db.commit()

    # 3. LLM extraction (sees ONLY scrubbed text) -----------------------------------------------------
    extraction = _extract(db, ticket)
    if extraction is None:
        return _to_human(db, ticket, "LLM_FAILURE", "Extraction failed; manual triage")
    serials = list(dict.fromkeys(([ticket.declared_serial] if ticket.declared_serial else []) + extraction.serial_numbers))
    ticket.serial_number = serials[0] if len(serials) == 1 else None
    ticket.category, ticket.intent = extraction.category, extraction.intent
    ticket.severity, ticket.confidence = extraction.severity, extraction.confidence
    ticket.extraction = extraction.model_dump()
    transition(db, ticket, Status.EXTRACTED, actor="pipeline:llm",
               detail={"confidence": extraction.confidence, "category": extraction.category, "serials": serials})
    db.commit()

    # 4. ERP warranty check ------------------------------------------------------------------------------
    record, prior = None, 0
    if len(serials) == 1:
        try:
            record = erp.get_client(db).lookup(serials[0])
        except erp.ERPUnavailable as exc:
            return _to_human(db, ticket, "ERP_UNAVAILABLE", str(exc)[:200])
        prior = erp.prior_rma_count(db, serials[0], ticket.id)
    warranty = erp.evaluate(record, date.today())
    ticket.warranty_status, ticket.prior_rma_count = warranty.value, prior
    ticket.warranty_expires_on = record.warranty_expires_on if record else None
    if record:
        ticket.vendor, ticket.product_sku = record.vendor, record.sku
    transition(db, ticket, Status.VERIFIED, actor="pipeline:erp", detail={"warranty": warranty.value, "prior_rmas": prior})
    db.commit()

    # 5. Routing rules -------------------------------------------------------------------------------------
    decision = router.decide(extraction=extraction, serials=serials, warranty=warranty, prior_rmas=prior,
                             threshold=s.confidence_threshold, repeat_limit=s.repeat_claim_limit)
    log_event(db, ticket, "routing_decision", "pipeline:router",
              {"route": decision.route.value, "reason_code": decision.reason_code, **decision.checks})

    if s.automation_level == "suggest" and decision.route is not Route.TIER1_HUMAN:
        ticket.suggested_route = decision.route.value
        return _to_human(db, ticket, "SUGGEST_ONLY", f"Suggested {decision.route.value}: {decision.reason}")

    ticket.route, ticket.route_reason = decision.route.value, decision.reason_code
    if decision.route is Route.AUTO_RMA:                       # 6 -> 9
        rma.issue_rma(db, ticket, record, actor="pipeline:router")
    elif decision.route is Route.PAID_REPAIR:                  # 8
        transition(db, ticket, Status.PAID_REPAIR, actor="pipeline:router", detail={"reason_code": decision.reason_code})
        sla.open_deadlines(db, ticket, [DeadlineKind.QUOTE_RESPONSE])
        notify.send(db, ticket, "out_of_warranty_quote", audience="customer")
    else:                                                      # 7
        _to_human(db, ticket, decision.reason_code, decision.reason)


def _extract(db, ticket: RMATicket) -> llm.Extraction | None:
    started = time.perf_counter()
    run = LLMRun(ticket_id=ticket.id, model="unknown", prompt_version=llm.PROMPT_VERSION,
                 input_sha256=hashlib.sha256(ticket.body_scrubbed.encode()).hexdigest())
    result = None
    try:
        extractor = llm.get_extractor()
        run.model = extractor.name
        result = extractor.extract(ticket.body_scrubbed)
        run.ok, run.output = True, result.model_dump()
    except Exception as exc:  # noqa: BLE001
        run.error = f"{type(exc).__name__}: {exc}"[:500]
        log.warning("LLM extraction failed for ticket %s: %s", ticket.id, run.error)
    run.latency_ms = int((time.perf_counter() - started) * 1000)
    db.add(run)
    db.commit()
    return result

