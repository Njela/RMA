"""Node 1 - Intake (portal form + inbound email). Stores the raw claim and returns immediately;
the pipeline runs asynchronously. Idempotency keys make client/webhook retries safe."""
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from ..enums import Status
from ..models import RMATicket, TicketEvent


def create_ticket(db, *, source: str, customer_email: str, customer_name: str | None, subject: str | None,
                  body: str, declared_serial: str | None = None, preferred_resolution: str = "repair",
                  idempotency_key: str | None = None) -> tuple[RMATicket, bool]:
    def existing():
        return db.scalar(select(RMATicket).where(RMATicket.idempotency_key == idempotency_key)) if idempotency_key else None

    if (found := existing()):
        return found, False
    ticket = RMATicket(
        source=source, idempotency_key=idempotency_key, customer_email=customer_email.strip().lower(),
        customer_name=(customer_name or "").strip() or None, subject=subject,
        body_raw=body if source == "portal" else f"{subject or ''}\n\n{body}".strip(),
        declared_serial=(declared_serial or "").strip().upper() or None,
        preferred_resolution=preferred_resolution, status=Status.RECEIVED.value)
    db.add(ticket)
    try:
        db.flush()
    except IntegrityError:            # two identical requests raced: return the winner
        db.rollback()
        if (found := existing()):
            return found, False
        raise
    db.add(TicketEvent(ticket_id=ticket.id, actor=f"intake:{source}", event_type="received",
                       to_status=Status.RECEIVED.value, detail={"source": source}))
    db.commit()
    return ticket, True
