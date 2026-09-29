"""Sample ERP data so the demo works out of the box:  python -m app.seed"""
from datetime import date, timedelta

from sqlalchemy import select

from .db import Base, SessionLocal, engine
from .models import SerialUnit


def add_months(d: date, months: int) -> date:
    y, m = divmod(d.month - 1 + months, 12)
    year, month = d.year + y, m + 1
    for day in (d.day, 28):
        try:
            return date(year, month, day)
        except ValueError:
            continue
    return date(year, month, 28)


def sample_units(today: date | None = None) -> list[SerialUnit]:
    today = today or date.today()
    rows = [  # serial, sku, product, vendor, days ago purchased, warranty months, region
        ("5CG2481XYZ", "HP-EB840G9", "HP EliteBook 840 G9", "HP", 200, 36, "KE"),
        ("FOC2211ABCD", "CS-C9200-24P", "Cisco Catalyst 9200 24-port PoE", "Cisco", 90, 36, "KE"),
        ("DL7H29K3Q1", "DL-LAT5540", "Dell Latitude 5540", "Dell", 400, 12, "UG"),
        ("SN-OLD-77821", "DL-OPT7010", "Dell OptiPlex 7010", "Dell", 1200, 24, "KE"),
        ("LNV9X8842PQ", "LN-TP-E14", "Lenovo ThinkPad E14", "Lenovo", 30, 12, "TZ"),
    ]
    return [SerialUnit(serial_number=s, sku=sku, product_name=n, vendor=v, invoice_number=f"INV-{i + 1:05d}",
                       purchase_date=today - timedelta(days=ago),
                       warranty_expires_on=add_months(today - timedelta(days=ago), months), region=r)
            for i, (s, sku, n, v, ago, months, r) in enumerate(rows)]


def seed(db) -> int:
    added = 0
    for u in sample_units():
        if not db.scalar(select(SerialUnit).where(SerialUnit.serial_number == u.serial_number)):
            db.add(u)
            added += 1
    db.commit()
    return added


if __name__ == "__main__":
    Base.metadata.create_all(engine)
    with SessionLocal() as session:
        print(f"Seeded {seed(session)} serial units")
