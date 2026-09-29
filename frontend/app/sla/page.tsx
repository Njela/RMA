import { fetchTickets } from "@/app/tickets/actions";
import SLAWorkspace from "./workspace";

export const dynamic = "force-dynamic";

export default async function SLAPage() {
  const tickets = await fetchTickets();
  return <SLAWorkspace initialTickets={tickets} />;
}
