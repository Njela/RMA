import { fetchTickets } from "./actions";
import TicketWorkspace from "./workspace";

export const dynamic = "force-dynamic";

export default async function TicketsPage({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined } }) {
  const initialTickets = await fetchTickets();
  return <TicketWorkspace initialTickets={initialTickets} defaultStatus={searchParams.status as string} />;
}
