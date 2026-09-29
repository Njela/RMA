"use client";
import { useState } from "react";
import { TicketSummary } from "@/lib/api";
import { clsx } from "clsx";
import { ShieldAlert, UserPlus, FileText, CheckCircle, Clock, XCircle } from "lucide-react";
import Link from "next/link";

export default function EscalationsWorkspace({ initialTickets }: { initialTickets: TicketSummary[] }) {
  const [drawerTicket, setDrawerTicket] = useState<TicketSummary | null>(null);

  // Grouping: manager-level items on top (sla_level === 2)
  const sorted = [...initialTickets].sort((a, b) => {
    if (a.sla_level !== b.sla_level) return b.sla_level - a.sla_level;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  return (
    <div className="flex h-full text-sm font-mono tracking-wide text-[#e5e5e5] relative overflow-hidden bg-[#010409]">
      <div className={clsx("flex-1 flex flex-col transition-all duration-300", drawerTicket ? "mr-96" : "")}>
        <div className="border-b border-[#30363d] p-4 bg-[#0d1117] flex flex-col gap-4">
          <div className="flex items-center gap-2 font-bold text-white tracking-widest uppercase">
            <ShieldAlert className="w-5 h-5 text-[#f85149]"/> ESCALATIONS: EXCEPTIONS & INTERVENTION
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead className="sticky top-0 bg-[#161b22] border-b border-[#30363d] text-xs text-[#8b949e]">
              <tr>
                <th className="p-3 font-normal pl-6">TICKET</th>
                <th className="p-3 font-normal">WHY IT'S HERE</th>
                <th className="p-3 font-normal">ESCALATION LEVEL</th>
                <th className="p-3 font-normal">OVERDUE BY</th>
                <th className="p-3 font-normal">CURRENT OWNER</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(t => {
                const isManager = t.sla_level === 2;
                return (
                  <tr key={t.id} onClick={() => setDrawerTicket(t)} className={clsx(
                    "border-b border-[#30363d]/50 hover:bg-[#161b22] cursor-pointer transition-colors group",
                    isManager ? "bg-[#f85149]/5" : "",
                    drawerTicket?.id === t.id ? "bg-[#1f242c]" : ""
                  )}>
                    <td className="p-3 pl-6 font-bold group-hover:underline text-[#58a6ff]">INC-{t.id.toString().slice(0,5)}</td>
                    <td className="p-3 text-[#c9d1d9] font-bold">{t.route_reason === "REPEAT_CLAIM" ? "Repeat Claim Flag" : "SLA Breach (First Response)"}</td>
                    <td className="p-3">
                      <span className={clsx("px-2 py-0.5 text-[10px] rounded-full font-bold uppercase", isManager ? "bg-[#f85149]/10 text-[#f85149] border border-[#f85149]/30" : "bg-[#d29922]/10 text-[#d29922] border border-[#d29922]/30")}>
                        {isManager ? "MANAGER" : "LEAD"}
                      </span>
                    </td>
                    <td className="p-3 text-[#f85149]">2h 14m</td>
                    <td className="p-3 text-[#8b949e]">-</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drawer */}
      <div className={clsx("absolute top-0 right-0 h-full w-96 bg-[#0d1117] border-l border-[#30363d] shadow-2xl flex flex-col transition-transform duration-300 z-20 transform", drawerTicket ? "translate-x-0" : "translate-x-full")}>
        {drawerTicket && (
          <>
            <div className="flex items-center justify-between p-4 border-b border-[#30363d] bg-[#161b22]">
              <h2 className="text-[#f85149] font-bold tracking-widest text-lg">INC-{drawerTicket.id.toString().slice(0,5)}</h2>
              <button onClick={() => setDrawerTicket(null)} className="text-[#8b949e] hover:text-white p-1"><XCircle className="w-5 h-5"/></button>
            </div>
            
            <div className="flex-1 p-6 space-y-6 overflow-y-auto">
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-[#8b949e] tracking-widest">EXCEPTION DETAIL</h3>
                <div className="bg-[#161b22] border border-[#30363d] p-3 text-[#e5e5e5] text-sm">
                  {drawerTicket.route_reason === "REPEAT_CLAIM" ? "Customer has 3 prior RMAs for this exact serial number. Marked as potential fraud/abuse." : "Ticket has been sitting in Tier 1 for > 24 business hours without a human first response."}
                </div>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-[#8b949e] tracking-widest">EXTEND DEADLINE</h3>
                <div className="bg-[#161b22] border border-[#30363d] p-3 space-y-3">
                  <select className="w-full bg-[#0d1117] border border-[#30363d] p-2 text-white outline-none text-xs"><option>Extend by 24h</option><option>Extend by 48h</option></select>
                  <input type="text" placeholder="Required reason for audit trail..." className="w-full bg-[#0d1117] border border-[#30363d] p-2 text-white outline-none text-xs" />
                  <button className="w-full bg-[#161b22] border border-[#d29922] text-[#d29922] hover:bg-[#d29922] hover:text-[#0d1117] p-2 text-xs font-bold flex justify-center items-center gap-2"><Clock className="w-3 h-3"/> EXTEND</button>
                </div>
              </div>
            </div>

            <div className="border-t border-[#30363d] bg-[#161b22] p-4 flex flex-col gap-2">
              <button className="w-full flex items-center justify-center gap-2 bg-[#3fb950]/10 border border-[#3fb950] text-[#3fb950] p-2 hover:bg-[#3fb950] hover:text-[#0d1117] font-bold text-xs"><CheckCircle className="w-4 h-4"/> ACKNOWLEDGE</button>
              <div className="flex gap-2">
                <button className="flex-1 flex items-center justify-center gap-2 border border-[#58a6ff] text-[#58a6ff] p-2 hover:bg-[#58a6ff] hover:text-[#0d1117] font-bold text-xs"><UserPlus className="w-3 h-3"/> REASSIGN</button>
                <button className="flex-1 flex items-center justify-center gap-2 border border-[#30363d] text-[#8b949e] p-2 hover:bg-[#30363d] hover:text-white font-bold text-xs"><FileText className="w-3 h-3"/> NOTE</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
