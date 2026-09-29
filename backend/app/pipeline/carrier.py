"""Carrier integration for node 6 (label) and node 9 (sync). MockCarrier is for dev; implement `Carrier` for
DHL / Aramex / G4S / Sendy etc. Status also arrives push-style via POST /api/webhooks/carrier."""
import hashlib
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from ..config import get_settings


@dataclass
class Label:
    carrier: str
    tracking_number: str
    label_url: str


@dataclass
class TrackingUpdate:
    status: str          # label_created | in_transit | delivered | exception
    occurred_at: datetime | None = None


class Carrier(Protocol):
    def create_return_label(self, rma_number: str) -> Label: ...
    def get_status(self, tracking_number: str) -> TrackingUpdate | None: ...


class MockCarrier:
    name = "mock-courier"

    def create_return_label(self, rma_number: str) -> Label:
        tracking = "MC" + hashlib.sha1(rma_number.encode()).hexdigest()[:10].upper()
        return Label(self.name, tracking, f"/labels/{tracking}.pdf")

    def get_status(self, tracking_number: str) -> TrackingUpdate | None:
        return None  # no news; use the webhook to simulate progress


def get_carrier() -> Carrier:
    if get_settings().carrier_mode == "mock":
        return MockCarrier()
    raise NotImplementedError("Implement a Carrier for your courier and register it here")
