"""ORM models. `ticket_events` is append-only: nothing in the codebase updates or deletes rows."""
import secrets
from datetime import date, datetime

from sqlalchemy import JSON, Boolean, Date, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base, UTCDateTime, utcnow
from .enums import Status


class SerialUnit(Base):
    """Local mirror of ERP sales data: which unit was sold, when, with what warranty."""
    __tablename__ = "serial_units"
    id: Mapped[int] = mapped_column(primary_key=True)
    serial_number: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    sku: Mapped[str] = mapped_column(String(64))
    product_name: Mapped[str] = mapped_column(String(200))
    vendor: Mapped[str] = mapped_column(String(64))
    invoice_number: Mapped[str | None] = mapped_column(String(64))
    customer_ref: Mapped[str | None] = mapped_column(String(64))
    purchase_date: Mapped[date] = mapped_column(Date)
    warranty_expires_on: Mapped[date] = mapped_column(Date)
    region: Mapped[str | None] = mapped_column(String(2))


class RMATicket(Base):
    __tablename__ = "rma_tickets"
    id: Mapped[int] = mapped_column(primary_key=True)
    public_token: Mapped[str] = mapped_column(String(32), unique=True, default=lambda: secrets.token_urlsafe(16))
    idempotency_key: Mapped[str | None] = mapped_column(String(128), unique=True)
    source: Mapped[str] = mapped_column(String(16))                     # portal | email
    status: Mapped[str] = mapped_column(String(24), default=Status.RECEIVED.value, index=True)

    # Customer + raw content (raw PII lives ONLY here; it is never sent to the LLM)
    customer_name: Mapped[str | None] = mapped_column(String(200))
    customer_email: Mapped[str] = mapped_column(String(320))
    subject: Mapped[str | None] = mapped_column(String(300))
    body_raw: Mapped[str] = mapped_column(Text)
    body_scrubbed: Mapped[str | None] = mapped_column(Text)
    redactions: Mapped[dict | None] = mapped_column(JSON)
    declared_serial: Mapped[str | None] = mapped_column(String(32))
    preferred_resolution: Mapped[str] = mapped_column(String(16), default="repair")

    # Pipeline outputs
    serial_number: Mapped[str | None] = mapped_column(String(32), index=True)
    product_sku: Mapped[str | None] = mapped_column(String(64))
    vendor: Mapped[str | None] = mapped_column(String(64))
    category: Mapped[str | None] = mapped_column(String(32))
    intent: Mapped[str | None] = mapped_column(String(24))
    severity: Mapped[str | None] = mapped_column(String(8))
    confidence: Mapped[float | None] = mapped_column(Float)
    extraction: Mapped[dict | None] = mapped_column(JSON)
    warranty_status: Mapped[str | None] = mapped_column(String(20))
    warranty_expires_on: Mapped[date | None] = mapped_column(Date)
    prior_rma_count: Mapped[int] = mapped_column(Integer, default=0)
    route: Mapped[str | None] = mapped_column(String(16))
    route_reason: Mapped[str | None] = mapped_column(String(64))
    suggested_route: Mapped[str | None] = mapped_column(String(16))     # set in "suggest" automation mode
    rma_number: Mapped[str | None] = mapped_column(String(32), unique=True)

    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    events: Mapped[list["TicketEvent"]] = relationship(order_by="TicketEvent.id", back_populates="ticket")
    deadlines: Mapped[list["SLADeadline"]] = relationship(order_by="SLADeadline.id", back_populates="ticket")
    shipment: Mapped["Shipment | None"] = relationship(uselist=False, back_populates="ticket")


class TicketEvent(Base):
    __tablename__ = "ticket_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    ticket_id: Mapped[int] = mapped_column(ForeignKey("rma_tickets.id"), index=True)
    at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    actor: Mapped[str] = mapped_column(String(64))                     # user:x | pipeline:y | carrier:webhook
    event_type: Mapped[str] = mapped_column(String(32))
    from_status: Mapped[str | None] = mapped_column(String(24))
    to_status: Mapped[str | None] = mapped_column(String(24))
    detail: Mapped[dict] = mapped_column(JSON, default=dict)
    ticket: Mapped[RMATicket] = relationship(back_populates="events")


class SLADeadline(Base):
    __tablename__ = "sla_deadlines"
    id: Mapped[int] = mapped_column(primary_key=True)
    ticket_id: Mapped[int] = mapped_column(ForeignKey("rma_tickets.id"), index=True)
    kind: Mapped[str] = mapped_column(String(32))
    starts_at: Mapped[datetime] = mapped_column(UTCDateTime)
    due_at: Mapped[datetime] = mapped_column(UTCDateTime, index=True)
    escalation_level: Mapped[int] = mapped_column(Integer, default=0)   # 0 ok, 1 warning, 2 lead, 3 manager
    escalated_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    resolved_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    resolved_reason: Mapped[str | None] = mapped_column(String(64))
    ticket: Mapped[RMATicket] = relationship(back_populates="deadlines")


class Shipment(Base):
    __tablename__ = "shipments"
    id: Mapped[int] = mapped_column(primary_key=True)
    ticket_id: Mapped[int] = mapped_column(ForeignKey("rma_tickets.id"), unique=True)
    carrier: Mapped[str] = mapped_column(String(32))
    tracking_number: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    label_url: Mapped[str] = mapped_column(String(300))
    status: Mapped[str] = mapped_column(String(16), default="label_created")
    last_synced_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    delivered_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    ticket: Mapped[RMATicket] = relationship(back_populates="shipment")


class LLMRun(Base):
    """One row per model call: the evaluation and cost-tracking dataset."""
    __tablename__ = "llm_runs"
    id: Mapped[int] = mapped_column(primary_key=True)
    ticket_id: Mapped[int] = mapped_column(ForeignKey("rma_tickets.id"), index=True)
    model: Mapped[str] = mapped_column(String(64))
    prompt_version: Mapped[str] = mapped_column(String(16))
    input_sha256: Mapped[str] = mapped_column(String(64))
    output: Mapped[dict | None] = mapped_column(JSON)
    ok: Mapped[bool] = mapped_column(Boolean, default=False)
    error: Mapped[str | None] = mapped_column(String(500))
    latency_ms: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class RMASequence(Base):
    __tablename__ = "rma_sequences"
    year: Mapped[int] = mapped_column(primary_key=True)
    last_value: Mapped[int] = mapped_column(Integer, default=0)
