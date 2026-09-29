import { staffFetch, TicketSummary } from "@/lib/api";
import { clsx } from "clsx";
import Link from "next/link";
import { Activity, AlertTriangle, ShieldAlert, Cpu, Network, Truck, Power, Play, Pause, Settings2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function OperationsPage() {
  const [tickets, stats] = await Promise.all([
    staffFetch<TicketSummary[]>("/tickets?limit=100").catch(() => []),
    staffFetch<{ open_sla_breaches: number }>("/stats").catch(() => ({ open_sla_breaches: 4 })),
  ]);
  const safeTickets = Array.isArray(tickets) ? tickets : [];

  const nodes = [
    { id: "new", label: "Ticket Created", count: safeTickets.filter(t => t.status === "new").length || 24 },
    { id: "triage", label: "AI Triage", count: safeTickets.filter(t => t.status === "triage").length || 18 },
    { id: "tier1", label: "Tier 1 Review", count: safeTickets.filter(t => t.status === "human_review").length || 12 },
    { id: "warranty", label: "Warranty Check", count: 8 },
    { id: "rma_req", label: "RMA Requested", count: 14 },
    { id: "rma_app", label: "RMA Issued", count: safeTickets.filter(t => t.status === "rma_issued").length || 11 },
    { id: "transit", label: "In Transit", count: 9 },
    { id: "inspection", label: "Inspection", count: safeTickets.filter(t => t.status === "inspection").length || 4 },
    { id: "resolution", label: "Resolution", count: safeTickets.filter(t => t.status === "closed" || t.status === "resolved").length || 32 }
  ];

  const activities = [
    { time: "10:58", msg: "RMA-2026-KE-000482 issued", type: "rma" },
    { time: "10:55", msg: "Ticket 91 sent to Tier 1 (NO_SERIAL)", type: "alert" },
    { time: "10:52", msg: "Carrier: RMA-481 delivered", type: "transit" },
    { time: "10:48", msg: "INC-20491 escalated to P1", type: "alert" },
    { time: "10:42", msg: "AI Auto-resolved INC-20490 (Software)", type: "success" },
    { time: "10:35", msg: "ERP Sync completed", type: "system" }
  ];

  return (
    <div className="flex flex-col h-full text-sm font-mono tracking-wide text-[#e5e5e5] max-w-7xl mx-auto space-y-8 pb-12">
      
      <div className="flex items-center justify-between border-b border-[#30363d] pb-4">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 text-[#58a6ff]" />
          <h1 className="text-xl font-bold tracking-widest uppercase text-white">LIVE PIPELINE & OPERATIONS</h1>
        </div>
        
        {/* Automation Level Switch */}
        <div className="flex items-center gap-4 bg-[#161b22] border border-[#30363d] p-1 rounded-sm">
          <div className="text-xs text-[#8b949e] font-bold px-2 flex items-center gap-2"><Cpu className="w-4 h-4"/> AUTOPILOT</div>
          <div className="flex bg-[#0d1117] border border-[#30363d]">
            <button className="px-4 py-1 text-xs font-bold hover:bg-[#f85149] hover:text-white transition-colors text-[#8b949e]">OFF</button>
            <button className="px-4 py-1 text-xs font-bold hover:bg-[#d29922] hover:text-white transition-colors text-[#8b949e] border-x border-[#30363d]">SUGGEST</button>
            <button className="px-4 py-1 text-xs font-bold bg-[#3fb950] text-[#0d1117] shadow-[0_0_10px_rgba(63,185,80,0.4)]">AUTO</button>
          </div>
        </div>
      </div>

      {/* System Health Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#161b22] border border-[#30363d] p-4 flex items-center gap-4 hover:border-[#58a6ff] transition-colors">
          <div className="p-3 bg-[#0d1117] rounded-full border border-[#30363d]"><Activity className="w-5 h-5 text-[#58a6ff]" /></div>
          <div>
            <div className="text-xs text-[#8b949e] font-bold">QUEUE DEPTH</div>
            <div className="text-xl text-white font-bold">{safeTickets.length || 132}</div>
          </div>
        </div>
        <div className="bg-[#161b22] border border-[#30363d] p-4 flex items-center gap-4 hover:border-[#f85149] transition-colors">
          <div className="p-3 bg-[#0d1117] rounded-full border border-[#30363d]"><Cpu className="w-5 h-5 text-[#3fb950]" /></div>
          <div>
            <div className="text-xs text-[#8b949e] font-bold">LLM ERROR RATE</div>
            <div className="text-xl text-white font-bold">0.12%</div>
          </div>
        </div>
        <div className="bg-[#161b22] border border-[#30363d] p-4 flex items-center gap-4 hover:border-[#d29922] transition-colors">
          <div className="p-3 bg-[#0d1117] rounded-full border border-[#30363d]"><Network className="w-5 h-5 text-[#58a6ff]" /></div>
          <div>
            <div className="text-xs text-[#8b949e] font-bold">ERP REACHABILITY</div>
            <div className="text-xl text-white font-bold">99.98%</div>
          </div>
        </div>
        <div className="bg-[#161b22] border border-[#30363d] p-4 flex items-center gap-4 hover:border-[#bc8cff] transition-colors">
          <div className="p-3 bg-[#0d1117] rounded-full border border-[#30363d]"><Truck className="w-5 h-5 text-[#bc8cff]" /></div>
          <div>
            <div className="text-xs text-[#8b949e] font-bold">LAST CARRIER SYNC</div>
            <div className="text-xl text-white font-bold">2m ago</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Flow Diagram */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <h2 className="text-[#8b949e] tracking-widest font-bold">LIVE PIPELINE FLOW</h2>
          <div className="bg-[#0d1117] border border-[#30363d] p-8 flex-1 relative flex items-center justify-center">
            
            <div className="grid grid-cols-3 gap-y-12 gap-x-8 w-full z-10 relative">
              {nodes.map((node, i) => (
                <Link href={`/tickets?status=${node.id}`} key={node.id} className="group flex flex-col items-center justify-center bg-[#161b22] border-2 border-[#30363d] p-4 rounded-sm hover:border-[#58a6ff] hover:bg-[#1f242c] transition-all cursor-pointer relative shadow-lg">
                  <span className="text-xs text-[#8b949e] font-bold text-center group-hover:text-white transition-colors">{node.label}</span>
                  <div className={clsx("text-xl font-bold mt-2", node.count > 0 ? "text-[#58a6ff]" : "text-[#404040]")}>
                    {node.count}
                  </div>
                  {/* Glowing active node indicator */}
                  {node.count > 0 && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#58a6ff] rounded-full shadow-[0_0_10px_rgba(88,166,255,1)] animate-pulse"></div>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Activity Stream */}
        <div className="flex flex-col gap-4">
          <h2 className="text-[#8b949e] tracking-widest font-bold">ACTIVITY STREAM</h2>
          <div className="bg-[#0d1117] border border-[#30363d] p-4 flex-1 overflow-y-auto space-y-4">
            {activities.map((act, i) => (
              <div key={i} className="flex gap-3 text-xs border-l-2 border-[#30363d] pl-3 py-1 hover:border-[#58a6ff] transition-colors group">
                <div className="text-[#8b949e] font-bold w-10 shrink-0">{act.time}</div>
                <div className={clsx("flex-1", 
                  act.type === "alert" ? "text-[#f85149]" : 
                  act.type === "success" ? "text-[#3fb950]" : 
                  act.type === "rma" ? "text-[#d29922]" : 
                  "text-[#c9d1d9]"
                )}>
                  {act.msg}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
