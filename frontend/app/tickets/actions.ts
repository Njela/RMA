"use server";

import { staffFetch, TicketSummary, TicketDetail } from "@/lib/api";
import { revalidatePath } from "next/cache";

export async function fetchTickets() {
  return staffFetch<TicketSummary[]>("/tickets?limit=100").catch(() => []);
}

export async function fetchTicketDetail(id: number) {
  return staffFetch<TicketDetail>(`/tickets/${id}`).catch(() => null);
}

export async function updateTicket(id: number, payload: any) {
  const SERVER_API = process.env.API_URL ?? "http://localhost:8000";
  const STAFF_KEY = process.env.STAFF_API_KEY ?? "dev-staff-key";
  
  await fetch(`${SERVER_API}/api/staff/tickets/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "X-API-Key": STAFF_KEY },
    body: JSON.stringify(payload)
  });
  revalidatePath("/tickets");
}

export async function bulkUpdateTickets(ids: number[], payload: any) {
  // Mocking bulk update by updating one by one since we don't have a bulk endpoint
  await Promise.all(ids.map(id => updateTicket(id, payload)));
}
