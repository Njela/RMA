"""Shared enums. Kept dependency-free so every module can import them."""
from enum import Enum


class Status(str, Enum):
    RECEIVED = "received"          # 1. Intake
    SCRUBBED = "scrubbed"          # 2. PII scrubber done
    EXTRACTED = "extracted"        # 3. LLM extraction done
    VERIFIED = "verified"          # 4. ERP warranty check done
    RMA_ISSUED = "rma_issued"      # 6. Auto-RMA (or human-approved RMA)
    IN_TRANSIT = "in_transit"      # 9. carrier sync
    DELIVERED = "delivered"        # 9. carrier sync
    HUMAN_REVIEW = "human_review"  # 7. Tier 1 support queue
    PAID_REPAIR = "paid_repair"    # 8. Out-of-warranty
    REJECTED = "rejected"
    CLOSED = "closed"


class Route(str, Enum):
    AUTO_RMA = "auto_rma"
    TIER1_HUMAN = "tier1_human"
    PAID_REPAIR = "paid_repair"


class Warranty(str, Enum):
    IN = "in_warranty"
    OUT = "out_of_warranty"
    UNKNOWN = "unknown_serial"


class DeadlineKind(str, Enum):
    HUMAN_FIRST_RESPONSE = "human_first_response"
    QUOTE_RESPONSE = "quote_response"
    RETURN_SHIPMENT = "return_shipment"
    DELIVERY = "delivery"


# Categories the rules engine may approve without a human (see pipeline/router.py).
AUTO_ELIGIBLE_CATEGORIES = {"dead_on_arrival", "hardware_fault", "software_firmware", "wrong_item"}
