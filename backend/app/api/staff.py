"""Staff endpoints (ticket board, ticket detail, human decisions, SLA tick)."""
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy import func, or_, select

from ..db import get_db
from ..enums import DeadlineKind, Status
from ..models import RMATicket, SLADeadline
from ..pipeline import erp, notify, rma, sla
from ..schemas import DecisionIn, TicketDetail, TicketSummary
from ..state import log_event, transition
from .deps import require_staff

router = APIRouter(prefix="/api/staff", dependencies=[Depends(require_staff)])


def summarize(t: RMATicket, model=TicketSummary):
    open_ = [d for d in t.deadlines if d.resolved_at is None]
    out = model.model_validate(t)
    out.sla_level = max((d.escalation_level for d in open_), default=0)
    out.next_due = min((d.due_at for d in open_), default=None)
    return out


@router.get("/tickets", response_model=list[TicketSummary])
def list_tickets(status: str | None = None, route: str | None = None, q: str | None = None,
                 limit: int = Query(50, le=200), offset: int = 0, db=Depends(get_db)):
    stmt = select(RMATicket).order_by(RMATicket.created_at.desc(), RMATicket.id.desc()).limit(limit).offset(offset)
    if status:
        stmt = stmt.where(RMATicket.status == status)
    if route:
        stmt = stmt.where(RMATicket.route == route)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(RMATicket.serial_number.ilike(like), RMATicket.rma_number.ilike(like),
                              RMATicket.customer_email.ilike(like)))
    return [summarize(t) for t in db.scalars(stmt)]


@router.get("/tickets/{ticket_id}", response_model=TicketDetail)
def get_ticket(ticket_id: int, db=Depends(get_db)):
    t = db.get(RMATicket, ticket_id)
    if t is None:
        raise HTTPException(404, "Ticket not found")
    return summarize(t, TicketDetail)


@router.post("/tickets/{ticket_id}/decision", response_model=TicketDetail)
def decide(ticket_id: int, body: DecisionIn, db=Depends(get_db), x_staff_user: str = Header(default="staff")):
    """A Tier 1 agent resolves a `human_review` ticket. Warranty is still verified against the ERP."""
    t = db.get(RMATicket, ticket_id)
    if t is None:
        raise HTTPException(404, "Ticket not found")
    if t.status != Status.HUMAN_REVIEW.value:
        raise HTTPException(409, f"Ticket is '{t.status}', not 'human_review'")
    actor = f"staff:{x_staff_user}"
    log_event(db, t, "staff_decision", actor, {"action": body.action, "note": body.note})

    if body.action == "approve_rma":
        serial = (body.serial_number or t.serial_number or "").strip().upper()
        if not serial:
            raise HTTPException(422, "A serial number is required to approve an RMA")
        try:
            record = erp.get_client(db).lookup(serial)
        except erp.ERPUnavailable as exc:
            raise HTTPException(503, f"ERP unavailable: {exc}") from exc
        if record is None:
            raise HTTPException(422, "Serial number not found in the ERP")
        t.serial_number = serial
        rma.issue_rma(db, t, record, actor=actor)
    elif body.action == "paid_repair":
        transition(db, t, Status.PAID_REPAIR, actor=actor, detail={"note": body.note})
        sla.resolve(db, t, [DeadlineKind.HUMAN_FIRST_RESPONSE], "decided")
        sla.open_deadlines(db, t, [DeadlineKind.QUOTE_RESPONSE])
        notify.send(db, t, "out_of_warranty_quote", audience="customer")
    else:
        transition(db, t, Status.REJECTED, actor=actor, detail={"note": body.note})
        sla.resolve_all(db, t, "rejected")
        notify.send(db, t, "claim_rejected", audience="customer")
    db.commit()
    return summarize(t, TicketDetail)


@router.post("/sla/tick")
def sla_tick(db=Depends(get_db)):
    """Run one SLA scan + carrier sync now (Celery beat does this every minute in production)."""
    return sla.tick(db)


@router.get("/stats")
def stats(db=Depends(get_db)):
    by_status = dict(db.execute(select(RMATicket.status, func.count()).group_by(RMATicket.status)).all())
    breached = db.scalar(select(func.count()).select_from(SLADeadline).where(
        SLADeadline.resolved_at.is_(None), SLADeadline.escalation_level >= 2)) or 0
    return {"by_status": by_status, "open_sla_breaches": breached}
