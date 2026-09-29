"""Pydantic request/response models."""
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

EMAIL_PATTERN = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"


class TicketCreate(BaseModel):
    customer_name: str = Field(min_length=2, max_length=200)
    customer_email: str = Field(pattern=EMAIL_PATTERN, max_length=320)
    description: str = Field(min_length=10, max_length=5000)
    serial_number: str | None = Field(default=None, max_length=32)
    preferred_resolution: Literal["repair", "replace", "refund"] = "repair"


class TicketCreated(BaseModel):
    id: int
    public_token: str
    status: str


class InboundEmail(BaseModel):
    message_id: str = Field(max_length=200)
    sender: str = Field(pattern=EMAIL_PATTERN)
    sender_name: str | None = None
    subject: str = Field(default="", max_length=300)
    body: str = Field(min_length=1, max_length=20000)


class CarrierEvent(BaseModel):
    tracking_number: str
    status: Literal["in_transit", "delivered", "exception"]
    occurred_at: datetime | None = None


class DecisionIn(BaseModel):
    action: Literal["approve_rma", "paid_repair", "reject"]
    note: str = Field(default="", max_length=1000)
    serial_number: str | None = Field(default=None, max_length=32)


class WarrantyCheck(BaseModel):
    found: bool
    in_warranty: bool | None = None
    warranty_expires_on: date | None = None


class _ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class EventOut(_ORM):
    at: datetime
    actor: str
    event_type: str
    from_status: str | None
    to_status: str | None
    detail: dict


class DeadlineOut(_ORM):
    kind: str
    starts_at: datetime
    due_at: datetime
    escalation_level: int
    resolved_at: datetime | None
    resolved_reason: str | None


class ShipmentOut(_ORM):
    carrier: str
    tracking_number: str
    label_url: str
    status: str
    delivered_at: datetime | None


class TicketSummary(_ORM):
    id: int
    status: str
    source: str
    customer_name: str | None
    customer_email: str
    serial_number: str | None
    vendor: str | None
    category: str | None
    severity: str | None
    confidence: float | None
    warranty_status: str | None
    route: str | None
    route_reason: str | None
    rma_number: str | None
    created_at: datetime
    updated_at: datetime
    sla_level: int = 0
    next_due: datetime | None = None


class TicketDetail(TicketSummary):
    subject: str | None
    body_raw: str
    body_scrubbed: str | None
    redactions: dict | None
    intent: str | None
    suggested_route: str | None
    prior_rma_count: int
    warranty_expires_on: date | None
    extraction: dict | None
    events: list[EventOut]
    deadlines: list[DeadlineOut]
    shipment: ShipmentOut | None


class TrackingView(BaseModel):
    status_label: str
    status: str
    rma_number: str | None
    label_url: str | None
    updated_at: datetime
    timeline: list[dict]
