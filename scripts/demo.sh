#!/usr/bin/env bash
# Walks one claim through the flow and simulates the carrier. Requires a running API (make dev-backend).
set -euo pipefail
API=${API:-http://localhost:8000}; KEY=${STAFF_API_KEY:-dev-staff-key}; SECRET=${CARRIER_WEBHOOK_SECRET:-change-me}
json() { python3 -c "import sys,json; d=json.load(sys.stdin); print($1)"; }

echo "1) Submit an in-warranty claim (contains PII that must never reach the LLM)"
RES=$(curl -s -X POST "$API/api/tickets" -H 'Content-Type: application/json' -H "Idempotency-Key: demo-$(date +%s)" -d '{
  "customer_name":"Grace Wanjiru","customer_email":"grace@example.com","preferred_resolution":"replace",
  "description":"My new laptop is dead on arrival and will not power on out of the box. Serial 5CG2481XYZ. Call me on 0712 345 678."}')
echo "$RES"; ID=$(echo "$RES" | json 'd["id"]')
sleep 1

echo; echo "2) Staff view: decision trace"
T=$(curl -s "$API/api/staff/tickets/$ID" -H "X-API-Key: $KEY")
echo "$T" | python3 -c '
import sys,json; t=json.load(sys.stdin)
print("status:", t["status"], "| route:", t["route"], "|", t["route_reason"], "| RMA:", t["rma_number"])
print("scrubbed:", t["body_scrubbed"])
for e in t["events"]: print(" -", e["event_type"], e["actor"], e["to_status"] or "")'
TRACK=$(echo "$T" | json 'd["shipment"]["tracking_number"]')

echo; echo "3) Simulate the carrier: in_transit, then delivered (HMAC-signed webhook)"
for STATUS in in_transit delivered; do
  BODY="{\"tracking_number\":\"$TRACK\",\"status\":\"$STATUS\"}"
  SIG="sha256=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $NF}')"
  curl -s -X POST "$API/api/webhooks/carrier" -H 'Content-Type: application/json' -H "X-Carrier-Signature: $SIG" -d "$BODY"; echo
done
curl -s "$API/api/staff/tickets/$ID" -H "X-API-Key: $KEY" | json '"final status: " + d["status"]'
