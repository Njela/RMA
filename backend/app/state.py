"""The ticket state machine. All status changes MUST go through `transition()`."""
from .db import utcnow
from .enums import Status
from .models import RMATicket, TicketEvent

S = Status
TRANSITIONS: dict[Status, set[Status]] = {
    S.RECEIVED: {S.SCRUBBED, S.HUMAN_REVIEW},
    S.SCRUBBED: {S.EXTRACTED, S.HUMAN_REVIEW},
    S.EXTRACTED: {S.VERIFIED, S.HUMAN_REVIEW},
    S.VERIFIED: {S.RMA_ISSUED, S.PAID_REPAIR, S.HUMAN_REVIEW},
    S.RMA_ISSUED: {S.IN_TRANSIT, S.HUMAN_REVIEW, S.CLOSED},
    S.IN_TRANSIT: {S.DELIVERED, S.HUMAN_REVIEW},
    S.DELIVERED: {S.CLOSED},
    S.HUMAN_REVIEW: {S.RMA_ISSUED, S.PAID_REPAIR, S.REJECTED},
    S.PAID_REPAIR: {S.CLOSED, S.REJECTED},
    S.REJECTED: {S.CLOSED},
    S.CLOSED: set(),
}


class InvalidTransition(Exception):
    pass


def transition(db, ticket: RMATicket, to: Status, *, actor: str, event_type: str = "status_change",
               detail: dict | None = None) -> None:
    current = Status(ticket.status)
    if to not in TRANSITIONS[current]:
        raise InvalidTransition(f"{current.value} -> {to.value} is not allowed")
    ticket.status = to.value
    ticket.updated_at = utcnow()
    db.add(TicketEvent(ticket_id=ticket.id, actor=actor, event_type=event_type,
                       from_status=current.value, to_status=to.value, detail=detail or {}))
    db.flush()


def log_event(db, ticket: RMATicket, event_type: str, actor: str, detail: dict | None = None) -> None:
    db.add(TicketEvent(ticket_id=ticket.id, actor=actor, event_type=event_type, detail=detail or {}))
    db.flush()
