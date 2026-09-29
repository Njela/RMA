"""Machine-to-machine endpoints: inbound email and carrier status. Both are authenticated and idempotent."""
import hashlib
import hmac
import secrets

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Request
from sqlalchemy import select

from ..config import get_settings
from ..db import get_db
from ..models import Shipment
from ..pipeline import dispatch, intake, sla
from ..schemas import CarrierEvent, InboundEmail, TicketCreated

router = APIRouter(prefix="/api/webhooks")


@router.post("/email", response_model=TicketCreated, status_code=202)
def inbound_email(body: InboundEmail, background: BackgroundTasks, db=Depends(get_db),
                  x_webhook_secret: str = Header(default="")):
    if not secrets.compare_digest(x_webhook_secret.encode(), get_settings().inbound_email_secret.encode()):
        raise HTTPException(401, "Bad webhook secret")
    ticket, created = intake.create_ticket(
        db, source="email", customer_email=body.sender, customer_name=body.sender_name, subject=body.subject,
        body=body.body, idempotency_key=f"email:{body.message_id}")  # Message-ID makes redelivery safe
    if created:
        dispatch.enqueue(ticket.id, background)
    return TicketCreated(id=ticket.id, public_token=ticket.public_token, status=ticket.status)


@router.post("/carrier")
async def carrier_event(request: Request, db=Depends(get_db), x_carrier_signature: str = Header(default="")):
    raw = await request.body()
    expected = "sha256=" + hmac.new(get_settings().carrier_webhook_secret.encode(), raw, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, x_carrier_signature):
        raise HTTPException(401, "Bad signature")
    event = CarrierEvent.model_validate_json(raw)
    shipment = db.scalar(select(Shipment).where(Shipment.tracking_number == event.tracking_number))
    if shipment is None:
        raise HTTPException(404, "Unknown tracking number")
    changed = sla.apply_carrier_update(db, shipment, event.status, event.occurred_at)
    db.commit()
    return {"changed": changed}
