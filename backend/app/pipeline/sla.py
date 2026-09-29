"""Node 9 - SLA monitor + carrier sync.

Deadlines are persisted rows (never in-memory timers) scanned by `tick()` every minute (Celery beat or
POST /api/staff/sla/tick). Escalation ladder, as a share of the SLA window elapsed:
    75% -> warning   100% -> escalate to team lead   150% -> escalate to manager
"""
import logging
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import select

from ..config import get_settings
from ..db import utcnow
from ..enums import DeadlineKind, Status
from ..models import RMATicket, Shipment, SLADeadline
from ..state import InvalidTransition, log_event, transition
from . import notify
from .carrier import get_carrier

log = logging.getLogger(__name__)

# kind -> (calendar, hours). In production move these to an `sla_policies` table keyed by customer tier.
POLICIES = {
    DeadlineKind.HUMAN_FIRST_RESPONSE: ("business", 4),
    DeadlineKind.QUOTE_RESPONSE: ("business", 16),
    DeadlineKind.RETURN_SHIPMENT: ("calendar", 7 * 24),
    DeadlineKind.DELIVERY: ("calendar", 14 * 24),
}
LEVELS = [(1.5, 3, "manager"), (1.0, 2, "lead"), (0.75, 1, "warning")]


# ---------------------------------------------------------------- business calendar
def _is_business_day(d: datetime) -> bool:
    return d.weekday() < 5 and f"{d:%m-%d}" not in {h.strip() for h in get_settings().holidays.split(",")}


def _next_open(cur: datetime) -> datetime:
    s = get_settings()
    while True:
        open_ = cur.replace(hour=s.business_start_hour, minute=0, second=0, microsecond=0)
        close = cur.replace(hour=s.business_end_hour, minute=0, second=0, microsecond=0)
        if _is_business_day(cur):
            if cur < open_:
                return open_
            if cur < close:
                return cur
        cur = (cur + timedelta(days=1)).replace(hour=s.business_start_hour, minute=0, second=0, microsecond=0)


def add_business_hours(start: datetime, hours: float) -> datetime:
    s = get_settings()
    cur = start.astimezone(ZoneInfo(s.business_tz))
    remaining = timedelta(hours=hours)
    while True:
        cur = _next_open(cur)
        close = cur.replace(hour=s.business_end_hour, minute=0, second=0, microsecond=0)
        if remaining <= close - cur:
            return (cur + remaining).astimezone(timezone.utc)
        remaining -= close - cur
        cur = close


# ---------------------------------------------------------------- deadlines
def due_at(kind: DeadlineKind, start: datetime) -> datetime:
    calendar, hours = POLICIES[kind]
    return add_business_hours(start, hours) if calendar == "business" else start + timedelta(hours=hours)


def open_deadlines(db, ticket: RMATicket, kinds: list[DeadlineKind], now: datetime | None = None) -> None:
    now = now or utcnow()
    for kind in kinds:
        db.add(SLADeadline(ticket_id=ticket.id, kind=kind.value, starts_at=now, due_at=due_at(kind, now)))
    db.flush()


def resolve(db, ticket: RMATicket, kinds: list[DeadlineKind], reason: str) -> None:
    wanted = {k.value for k in kinds}
    for d in db.scalars(select(SLADeadline).where(SLADeadline.ticket_id == ticket.id, SLADeadline.resolved_at.is_(None))):
        if d.kind in wanted:
            d.resolved_at, d.resolved_reason = utcnow(), reason


def resolve_all(db, ticket: RMATicket, reason: str) -> None:
    resolve(db, ticket, list(DeadlineKind), reason)


def scan(db, now: datetime | None = None) -> dict[str, int]:
    """Escalate open deadlines. Idempotent: each level fires once per deadline."""
    now = now or utcnow()
    stats = {"warning": 0, "lead": 0, "manager": 0}
    for d in db.scalars(select(SLADeadline).where(SLADeadline.resolved_at.is_(None))).all():
        total = (d.due_at - d.starts_at).total_seconds() or 1
        ratio = (now - d.starts_at).total_seconds() / total
        for threshold, level, name in LEVELS:
            if ratio >= threshold:
                if level > d.escalation_level:
                    d.escalation_level, d.escalated_at = level, now
                    ticket = db.get(RMATicket, d.ticket_id)
                    log_event(db, ticket, f"sla_{name}", "pipeline:sla",
                              {"deadline": d.kind, "due_at": d.due_at.isoformat(), "ratio": round(ratio, 2)})
                    notify.send(db, ticket, f"sla_{name}", audience="staff", deadline=d.kind)
                    stats[name] += 1
                break
    db.commit()
    return stats


# ---------------------------------------------------------------- carrier sync
def apply_carrier_update(db, shipment: Shipment, status: str, at: datetime | None = None,
                         actor: str = "carrier:webhook") -> bool:
    """Apply a carrier status. Safe to call twice with the same status (returns False when nothing changed)."""
    if status == shipment.status:
        return False
    at = at or utcnow()
    ticket = db.get(RMATicket, shipment.ticket_id)
    shipment.status = status
    detail = {"tracking_number": shipment.tracking_number, "carrier_status": status}
    try:
        if status == "in_transit" and ticket.status == Status.RMA_ISSUED.value:
            transition(db, ticket, Status.IN_TRANSIT, actor=actor, detail=detail)
            resolve(db, ticket, [DeadlineKind.RETURN_SHIPMENT], "carrier_in_transit")
        elif status == "delivered":
            shipment.delivered_at = at
            if ticket.status == Status.RMA_ISSUED.value:  # missed the in_transit event
                transition(db, ticket, Status.IN_TRANSIT, actor=actor, detail=detail)
            if ticket.status == Status.IN_TRANSIT.value:
                transition(db, ticket, Status.DELIVERED, actor=actor, detail=detail)
            resolve(db, ticket, [DeadlineKind.RETURN_SHIPMENT, DeadlineKind.DELIVERY], "delivered")
        elif status == "exception" and ticket.status in (Status.RMA_ISSUED.value, Status.IN_TRANSIT.value):
            transition(db, ticket, Status.HUMAN_REVIEW, actor=actor, detail={**detail, "reason": "CARRIER_EXCEPTION"})
            open_deadlines(db, ticket, [DeadlineKind.HUMAN_FIRST_RESPONSE])
        else:
            log_event(db, ticket, "carrier_update", actor, detail)
    except InvalidTransition:
        log.warning("carrier status %s ignored for ticket %s in state %s", status, ticket.id, ticket.status)
    return True


def sync_carriers(db, now: datetime | None = None) -> int:
    """Poll the carrier for shipments that have not been delivered (backup for missed webhooks)."""
    now, carrier, changed = now or utcnow(), get_carrier(), 0
    for sh in db.scalars(select(Shipment).where(Shipment.status != "delivered")).all():
        try:
            update = carrier.get_status(sh.tracking_number)
        except Exception:  # noqa: BLE001 - one bad carrier call must not stop the sweep
            log.exception("carrier poll failed for %s", sh.tracking_number)
            continue
        sh.last_synced_at = now
        if update and apply_carrier_update(db, sh, update.status, update.occurred_at, actor="pipeline:carrier-sync"):
            changed += 1
    db.commit()
    return changed


def tick(db) -> dict:
    return {"sla": scan(db), "carrier_updates": sync_carriers(db)}
