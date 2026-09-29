"""Node 6 - Auto-RMA: number generation, label creation, SLA start. Also used when a human approves an RMA."""
import re

from sqlalchemy import select

from ..config import get_settings
from ..db import utcnow
from ..enums import DeadlineKind, Status
from ..models import RMASequence, RMATicket, Shipment
from ..state import transition
from . import notify, sla
from .carrier import get_carrier
from .erp import WarrantyRecord

RMA_RE = re.compile(r"^RMA-(\d{4})-([A-Z]{2})-(\d{6})-(\d)$")


def luhn_check_digit(digits: str) -> int:
    total = 0
    for i, ch in enumerate(reversed(digits)):
        d = int(ch)
        if i % 2 == 0:
            d = d * 2 - 9 if d > 4 else d * 2
        total += d
    return (10 - total % 10) % 10


def is_valid_rma_number(number: str) -> bool:
    m = RMA_RE.match(number)
    return bool(m) and luhn_check_digit(m.group(1) + m.group(3)) == int(m.group(4))


def next_rma_number(db, region: str, now=None) -> str:
    """RMA-2026-KE-000482-7. The sequence row is locked (SELECT ... FOR UPDATE on Postgres) inside the caller's
    transaction. Pre-create the year's row in a migration to avoid a first-of-year insert race."""
    year = (now or utcnow()).year
    row = db.execute(select(RMASequence).where(RMASequence.year == year).with_for_update()).scalar_one_or_none()
    if row is None:
        row = RMASequence(year=year, last_value=0)
        db.add(row)
    row.last_value += 1
    db.flush()
    seq = f"{row.last_value:06d}"
    return f"RMA-{year}-{region.upper()}-{seq}-{luhn_check_digit(f'{year}{seq}')}"


def issue_rma(db, ticket: RMATicket, record: WarrantyRecord, *, actor: str) -> None:
    ticket.rma_number = next_rma_number(db, record.region or get_settings().default_region)
    ticket.vendor, ticket.product_sku = record.vendor, record.sku
    label = get_carrier().create_return_label(ticket.rma_number)
    db.add(Shipment(ticket_id=ticket.id, carrier=label.carrier, tracking_number=label.tracking_number,
                    label_url=label.label_url, status="label_created"))
    transition(db, ticket, Status.RMA_ISSUED, actor=actor,
               detail={"rma_number": ticket.rma_number, "tracking_number": label.tracking_number})
    sla.resolve(db, ticket, [DeadlineKind.HUMAN_FIRST_RESPONSE], "rma_issued")
    sla.open_deadlines(db, ticket, [DeadlineKind.RETURN_SHIPMENT, DeadlineKind.DELIVERY])
    notify.send(db, ticket, "rma_issued", audience="customer", rma_number=ticket.rma_number, label_url=label.label_url)
