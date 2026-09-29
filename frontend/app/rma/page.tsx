import { fetchTickets } from "@/app/tickets/actions";
import RMAWorkspace from "./workspace";

export const dynamic = "force-dynamic";

export default async function RMAPage() {
  const initialTickets = await fetchTickets();
  // We only want tickets that have an RMA number
  const rmas = initialTickets.filter(t => t.rma_number);
  return <RMAWorkspace initialRMAs={rmas} />;
}
