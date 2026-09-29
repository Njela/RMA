"""Customer-facing endpoints: submit a claim, check a serial, track a ticket."""
from datetime import date

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException
from sqlalchemy import select

from ..db import get_db
from ..models import RMATicket, SerialUnit
from ..pipeline import dispatch, intake
from ..schemas import TicketCreate, TicketCreated, TrackingView, WarrantyCheck
from .deps import rate_limit

router = APIRouter(prefix="/api", dependencies=[Depends(rate_limit)])

CUSTOMER_LABELS = {
    "received": "Claim received", "scrubbed": "Claim received", "extracted": "Claim received", "verified": "Claim received",
    "human_review": "With our support team", "rma_issued": "RMA approved: ship your item",
    "in_transit": "Your item is on its way to us", "delivered": "Received at our warehouse",
    "paid_repair": "Out of warranty: repair quote coming", "rejected": "Claim not accepted", "closed": "Closed",
}
PUBLIC_STEPS = {"received", "human_review", "rma_issued", "in_transit", "delivered", "paid_repair", "rejected", "closed"}


@router.post("/tickets", response_model=TicketCreated, status_code=202)
def submit_claim(body: TicketCreate, background: BackgroundTasks, db=Depends(get_db),
                 idempotency_key: str | None = Header(default=None, max_length=128)):
    ticket, created = intake.create_ticket(
        db, source="portal", customer_email=body.customer_email, customer_name=body.customer_name, subject=None,
        body=body.description, declared_serial=body.serial_number, preferred_resolution=body.preferred_resolution,
        idempotency_key=idempotency_key)
    if created:
        dispatch.enqueue(ticket.id, background)
    return TicketCreated(id=ticket.id, public_token=ticket.public_token, status=ticket.status)


@router.get("/serials/{serial}/warranty", response_model=WarrantyCheck)
def check_serial(serial: str, db=Depends(get_db)):
    """Minimal on purpose (no product/customer details) to limit serial enumeration."""
    unit = db.scalar(select(SerialUnit).where(SerialUnit.serial_number == serial.strip().upper()))
    if unit is None:
        return WarrantyCheck(found=False)
    return WarrantyCheck(found=True, in_warranty=unit.warranty_expires_on >= date.today(),
                         warranty_expires_on=unit.warranty_expires_on)


@router.get("/track/{token}", response_model=TrackingView)
def track(token: str, db=Depends(get_db)):
    t = db.scalar(select(RMATicket).where(RMATicket.public_token == token))
    if t is None:
        raise HTTPException(404, "Ticket not found")
    timeline, last = [], None
    for e in t.events:
        if e.event_type in ("received", "status_change") and (e.to_status in PUBLIC_STEPS) and e.to_status != last:
            timeline.append({"at": e.at, "label": CUSTOMER_LABELS[e.to_status]})
            last = e.to_status
    return TrackingView(status_label=CUSTOMER_LABELS[t.status], status=t.status, rma_number=t.rma_number,
                        label_url=t.shipment.label_url if t.shipment else None, updated_at=t.updated_at, timeline=timeline)
