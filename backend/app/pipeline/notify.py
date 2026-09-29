"""Notifications. Currently records an audit event + log line. Swap the body of `send` for email / SMS /
WhatsApp providers; because every send is an event, the outbox pattern (see docs) is a small step away."""
import logging

from ..state import log_event

log = logging.getLogger("rma.notify")


def send(db, ticket, template: str, *, audience: str = "customer", **ctx) -> None:
    log.info("notify template=%s audience=%s ticket=%s", template, audience, ticket.id)
    log_event(db, ticket, "notification", "pipeline:notify", {"template": template, "audience": audience, **ctx})
