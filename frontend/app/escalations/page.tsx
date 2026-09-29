import { fetchTickets } from "@/app/tickets/actions";
import EscalationsWorkspace from "./workspace";

export const dynamic = "force-dynamic";

export default async function EscalationsPage() {
  const tickets = await fetchTickets();
  // Filter escalations: SLA > 0 or REPEAT_CLAIM
  const escalations = tickets.filter(t => t.sla_level > 0 || t.route_reason === "REPEAT_CLAIM");
  return <EscalationsWorkspace initialTickets={escalations} />;
}
