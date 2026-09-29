"""Node 4 - ERP database / warranty check (deterministic).

`DatabaseERPClient` reads the local `serial_units` mirror. `HttpERPClient` shows where to plug the real ERP
(Dynamics, SAP, Odoo...): implement the field mapping in `lookup` and set ERP_MODE=http.
"""
from dataclasses import dataclass
from datetime import date

import httpx
from sqlalchemy import func, select

from ..config import get_settings
from ..enums import Warranty
from ..models import RMATicket, SerialUnit


class ERPUnavailable(Exception):
    """ERP timed out or returned 5xx. The pipeline degrades to human review instead of failing."""


@dataclass
class WarrantyRecord:
    serial_number: str
    sku: str
    product_name: str
    vendor: str
    purchase_date: date
    warranty_expires_on: date
    region: str | None = None


class DatabaseERPClient:
    def __init__(self, db):
        self.db = db

    def lookup(self, serial: str) -> WarrantyRecord | None:
        u = self.db.scalar(select(SerialUnit).where(SerialUnit.serial_number == serial))
        if u is None:
            return None
        return WarrantyRecord(u.serial_number, u.sku, u.product_name, u.vendor, u.purchase_date,
                              u.warranty_expires_on, u.region)


class HttpERPClient:
    """Expected response: {"serial","sku","product_name","vendor","purchase_date","warranty_expires_on","region"}."""

    def __init__(self):
        s = get_settings()
        self.base, self.token = s.erp_base_url.rstrip("/"), s.erp_api_token

    def lookup(self, serial: str) -> WarrantyRecord | None:
        try:
            r = httpx.get(f"{self.base}/serials/{serial}", headers={"Authorization": f"Bearer {self.token}"}, timeout=10)
        except httpx.HTTPError as exc:
            raise ERPUnavailable(str(exc)) from exc
        if r.status_code == 404:
            return None
        if r.status_code >= 500:
            raise ERPUnavailable(f"ERP returned {r.status_code}")
        r.raise_for_status()
        d = r.json()
        return WarrantyRecord(d["serial"], d["sku"], d["product_name"], d["vendor"],
                              date.fromisoformat(d["purchase_date"]),
                              date.fromisoformat(d["warranty_expires_on"]), d.get("region"))


def get_client(db):
    return HttpERPClient() if get_settings().erp_mode == "http" else DatabaseERPClient(db)


def evaluate(record: WarrantyRecord | None, today: date) -> Warranty:
    if record is None:
        return Warranty.UNKNOWN
    return Warranty.IN if record.warranty_expires_on >= today else Warranty.OUT


def prior_rma_count(db, serial: str, exclude_ticket_id: int) -> int:
    return db.scalar(select(func.count()).select_from(RMATicket).where(
        RMATicket.serial_number == serial, RMATicket.rma_number.is_not(None), RMATicket.id != exclude_ticket_id)) or 0
