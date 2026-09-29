// Server-side calls use API_URL and carry the staff key, which never reaches the browser.
// The browser only talks to the public endpoints through NEXT_PUBLIC_API_URL.
const SERVER_API = process.env.API_URL ?? "http://localhost:8000";
export const PUBLIC_API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const STAFF_KEY = process.env.STAFF_API_KEY ?? "dev-staff-key";

export type Event = { at: string; actor: string; event_type: string; from_status: string | null; to_status: string | null; detail: Record<string, unknown> };
export type Deadline = { kind: string; starts_at: string; due_at: string; escalation_level: number; resolved_at: string | null };
export type Shipment = { carrier: string; tracking_number: string; label_url: string; status: string; delivered_at: string | null };
export type TicketSummary = {
  id: number; status: string; source: string; customer_name: string | null; customer_email: string;
  serial_number: string | null; vendor: string | null; category: string | null; confidence: number | null;
  warranty_status: string | null; route: string | null; route_reason: string | null; rma_number: string | null;
  created_at: string; updated_at: string; sla_level: number; next_due: string | null;
};
export type TicketDetail = TicketSummary & {
  body_raw: string; body_scrubbed: string | null; redactions: Record<string, number> | null; intent: string | null;
  suggested_route: string | null; prior_rma_count: number; events: Event[]; deadlines: Deadline[]; shipment: Shipment | null;
};
export type Tracking = {
  status_label: string; status: string; rma_number: string | null; label_url: string | null;
  updated_at: string; timeline: { at: string; label: string }[];
};

export async function staffFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${SERVER_API}/api/staff${path}`, {
    ...init, cache: "no-store",
    headers: { "X-API-Key": STAFF_KEY, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json() as Promise<T>;
}

export async function trackFetch(token: string): Promise<Tracking | null> {
  const res = await fetch(`${SERVER_API}/api/track/${encodeURIComponent(token)}`, { cache: "no-store" });
  return res.ok ? ((await res.json()) as Tracking) : null;
}
