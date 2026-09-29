"use client";
import { TicketSummary } from "@/lib/api";
import { clsx } from "clsx";
import { Clock, Play, CalendarDays, Activity } from "lucide-react";

export default function SLAWorkspace({ initialTickets }: { initialTickets: TicketSummary[] }) {
  
  const handleScan = async () => {
    // Calls POST /api/staff/sla/tick
    alert("Running SLA scan sweep...");
  };

  return (
    <div className="flex flex-col h-full text-sm font-mono tracking-wide text-[#e5e5e5] max-w-7xl mx-auto space-y-6 pb-12 overflow-y-auto">
      
      <div className="flex items-center justify-between border-b border-[#30363d] pb-4 bg-[#010409] sticky top-0 z-10 pt-4">
        <div className="flex items-center gap-3">
          <Clock className="w-5 h-5 text-[#d29922]" />
          <h1 className="text-xl font-bold tracking-widest uppercase text-white">SLA MONITOR</h1>
        </div>
        
        <div className="flex gap-4">
          <button onClick={handleScan} className="flex items-center gap-2 px-4 py-2 bg-[#161b22] border border-[#d29922] text-[#d29922] hover:bg-[#d29922] hover:text-[#0d1117] transition-all font-bold text-xs shadow-[0_0_8px_rgba(210,153,34,0.3)]">
            <Play className="w-4 h-4"/> RUN SCAN NOW
          </button>
        </div>
      </div>

      {/* Compliance & Health */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#161b22] border border-[#30363d] p-6">
          <div className="text-xs text-[#8b949e] font-bold tracking-widest mb-4">COMPLIANCE (30D)</div>
          <div className="flex items-end gap-4">
            <span className="text-4xl font-bold text-[#3fb950]">94.2%</span>
            <span className="text-xs text-[#8b949e] mb-1">MET SLA</span>
          </div>
          <div className="w-full h-2 bg-[#0d1117] mt-4 flex rounded-full overflow-hidden">
            <div className="bg-[#3fb950] h-full" style={{ width: "94.2%" }}></div>
            <div className="bg-[#f85149] h-full" style={{ width: "5.8%" }}></div>
          </div>
        </div>

        <div className="bg-[#161b22] border border-[#30363d] p-6">
          <div className="text-xs text-[#8b949e] font-bold tracking-widest mb-4 flex justify-between">
            CARRIER SYNC PANEL
            <span className="text-[#58a6ff]">2m ago</span>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-[#c9d1d9]">Shipments Tracked</span>
              <span className="font-bold">142</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-[#f85149]">Stuck {">"} 5 days</span>
              <span className="font-bold">4</span>
            </div>
          </div>
        </div>

        <div className="bg-[#161b22] border border-[#30363d] p-6">
          <div className="text-xs text-[#8b949e] font-bold tracking-widest mb-4 flex items-center gap-2">
            <CalendarDays className="w-4 h-4"/> BUSINESS HOURS
          </div>
          <div className="text-xs text-[#c9d1d9] space-y-2">
            <div>Mon - Fri: 09:00 - 17:00 (EST)</div>
            <div className="text-[#8b949e]">Next holiday: Thanksgiving (Nov 26)</div>
            <div className="mt-2 text-[#3fb950] font-bold">? CLOCK IS RUNNING</div>
          </div>
        </div>
      </div>

      {/* SLA Queue */}
      <div className="border border-[#30363d] bg-[#0d1117] flex-1 flex flex-col">
        <div className="p-4 border-b border-[#30363d] flex items-center gap-4 bg-[#161b22]">
          <select className="bg-[#0d1117] border border-[#30363d] px-3 py-1.5 text-xs text-[#c9d1d9] outline-none"><option>Deadline: All Types</option><option>First Response</option></select>
          <select className="bg-[#0d1117] border border-[#30363d] px-3 py-1.5 text-xs text-[#c9d1d9] outline-none"><option>Vendor: All</option></select>
          <select className="bg-[#0d1117] border border-[#30363d] px-3 py-1.5 text-xs text-[#c9d1d9] outline-none"><option>Team: Tier 1</option></select>
        </div>

        <div className="p-6 space-y-6">
          {/* Example Rows */}
          {[
            { id: 1204, type: "First Response", left: "14m left", pct: 90, alert: true },
            { id: 1215, type: "Quote Generation", left: "2h 45m left", pct: 65, alert: false },
            { id: 1218, type: "First Response", left: "4h 12m left", pct: 40, alert: false },
            { id: 1190, type: "Return Shipment", left: "Breached by 1d", pct: 150, alert: true, breached: true }
          ].map((d, i) => (
            <div key={i} className="flex flex-col gap-2 relative">
              <div className="flex justify-between text-xs">
                <div>
                  <span className="text-[#58a6ff] font-bold mr-2">INC-{d.id}</span>
                  <span className="text-[#8b949e]">{d.type}</span>
                </div>
                <div className={clsx("font-bold", d.alert ? "text-[#f85149]" : "text-[#c9d1d9]")}>{d.left}</div>
              </div>
              
              {/* Progress Bar */}
              <div className="relative w-full h-3 bg-[#161b22] border border-[#30363d]">
                {/* Markers */}
                <div className="absolute top-0 bottom-0 left-[75%] w-px bg-[#d29922]/50 z-10"></div>
                <div className="absolute top-0 bottom-0 left-[100%] w-px bg-[#f85149]/50 z-10"></div>
                
                <div className={clsx("h-full transition-all", d.breached ? "bg-[#f85149]" : d.pct > 75 ? "bg-[#d29922]" : "bg-[#3fb950]")} style={{ width: `${Math.min(d.pct, 100)}%` }}></div>
                
                {/* Overflow/Breach indicator */}
                {d.breached && (
                  <div className="absolute top-0 bottom-0 left-0 right-0 bg-[#f85149]/20 flex items-center overflow-hidden">
                    <div className="h-full bg-[#f85149]/50 animate-pulse" style={{ width: "100%" }}></div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
