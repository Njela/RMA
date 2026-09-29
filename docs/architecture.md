# Architecture

## Runtime view

```mermaid
flowchart TB
  subgraph Clients
    W[Customer portal<br/>Next.js]
    M[Inbound email provider]
    C[Carrier]
    S[Staff board<br/>Next.js, server-side]
  end
  subgraph API["FastAPI"]
    P[public.py]
    WH[webhooks.py]
    ST[staff.py]
  end
  W --> P
  M --> WH
  C --> WH
  S --> ST
  P & WH -- "create ticket (status received)" --> DB[(PostgreSQL)]
  P & WH -- enqueue --> Q[(Redis)]
  Q --> WK[Celery worker<br/>run_pipeline]
  BT[Celery beat<br/>every 60s] --> Q
  WK --> DB
  WK -. "extract only" .-> LLM[LLM API]
  WK -. lookup .-> ERP[ERP]
  WK -. label .-> CAR[Carrier API]
```

Intake returns `202` as soon as the raw claim is stored. The pipeline runs asynchronously, so a slow model or ERP
never slows the customer down and never loses the claim.

## Ticket state machine

Enforced in `state.py`; any other move raises `InvalidTransition`.

```mermaid
stateDiagram-v2
  [*] --> received
  received --> scrubbed
  scrubbed --> extracted
  extracted --> verified
  verified --> rma_issued: in warranty, clear
  verified --> paid_repair: out of warranty
  verified --> human_review: low confidence, unknown serial, damage, repeat
  received --> human_review: automation off / any failure
  scrubbed --> human_review
  extracted --> human_review
  rma_issued --> in_transit: carrier
  in_transit --> delivered: carrier
  rma_issued --> human_review: carrier exception
  in_transit --> human_review: carrier exception
  human_review --> rma_issued: agent approves (ERP re-checked)
  human_review --> paid_repair
  human_review --> rejected
  delivered --> closed
  paid_repair --> closed
  paid_repair --> rejected
  rejected --> closed
  closed --> [*]
```

## Data model

```mermaid
erDiagram
  RMA_TICKETS ||--o{ TICKET_EVENTS : "append-only audit"
  RMA_TICKETS ||--o{ SLA_DEADLINES : has
  RMA_TICKETS ||--o| SHIPMENTS : has
  RMA_TICKETS ||--o{ LLM_RUNS : "one per model call"
  RMA_TICKETS }o--o| SERIAL_UNITS : "matched by serial"
  RMA_SEQUENCES { int year PK  int last_value }
  RMA_TICKETS { int id PK  string public_token  string idempotency_key  string status  string route  string rma_number  text body_raw  text body_scrubbed }
  SERIAL_UNITS { string serial_number  string sku  string vendor  date purchase_date  date warranty_expires_on }
```

## Sequence: an in-warranty claim

```mermaid
sequenceDiagram
  participant U as Customer
  participant A as API
  participant W as Worker
  participant L as LLM
  participant E as ERP
  participant K as Carrier
  U->>A: POST /api/tickets (Idempotency-Key)
  A-->>U: 202 + tracking token
  A->>W: enqueue(ticket_id)
  W->>W: scrub PII, commit
  W->>L: scrubbed text only
  L-->>W: serial, category, confidence
  W->>E: lookup(serial)
  E-->>W: warranty record
  W->>W: rules: IN_WARRANTY_AUTO
  W->>K: create return label
  W->>W: RMA number, SLA deadlines, notify
  K-->>A: webhook in_transit / delivered (HMAC)
  A->>A: update status, resolve deadlines
```

## Why these choices

| Choice | Reason |
|--------|--------|
| PostgreSQL | Claims are relational and transactional; JSON columns hold model output and event detail |
| Celery + Redis | Retries, acks-late delivery and a scheduler for SLA scans, with a familiar operational model |
| Persisted SLA deadlines | Survive restarts and deploys; auditable; scanned by one idempotent job |
| Rules engine separate from the LLM | Explainable decisions, testable as a pure function, no model in the money path |
| Append-only event table | One source of truth for "who or what did this and why" |
