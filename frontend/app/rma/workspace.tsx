"use client";
import { useState, useEffect } from "react";
import { TicketSummary } from "@/lib/api";
import { clsx } from "clsx";
import { Package, Truck, Search, Printer, XCircle, ClipboardCheck, ArrowRight, Save, CornerUpLeft } from "lucide-react";
import Link from "next/link";

function agoDays(iso: string) {
  const d = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 86400000));
  return d;
}

function mockShipment(rma: string) {
  // deterministic mock based on rma string
  const charCode = rma.charCodeAt(rma.length - 1) || 0;
  const carrier = charCode % 2 === 0 ? "FedEx" : "UPS";
  const prefix = carrier === "UPS" ? "1Z" : "FX";
  const tracking = `${prefix}999${charCode}888${rma.slice(-4)}`;
  return { carrier, tracking };
}

export default function RMAWorkspace({ initialRMAs }: { initialRMAs: TicketSummary[] }) {
  const [rmas, setRmas] = useState<TicketSummary[]>(initialRMAs);
  const [activeTab, setActiveTab] = useState("in_transit");
  
  const [drawerRMA, setDrawerRMA] = useState<TicketSummary | null>(null);

  useEffect(() => {
    setRmas(initialRMAs);
  }, [initialRMAs]);

  const displayedRMAs = rmas.filter(t => {
    if (activeTab === "awaiting") return t.status === "rma_issued";
    if (activeTab === "in_transit") return t.status === "in_transit";
    if (activeTab === "delivered") return t.status === "delivered" || t.status === "inspection";
    if (activeTab === "closed") return t.status === "closed" || t.status === "resolved";
    return true;
  });

  const handleAction = (action: string) => {
    alert(`Mock action triggered: ${action}`);
    setDrawerRMA(null);
  };

  return (
    <div className="flex h-full text-sm font-mono tracking-wide text-[#e5e5e5] relative overflow-hidden bg-[#010409]">
      
      {/* Main Workspace */}
      <div className={clsx("flex-1 flex flex-col transition-all duration-300", drawerRMA ? "mr-96" : "")}>
        
        {/* Top Header */}
        <div className="border-b border-[#30363d] p-4 bg-[#0d1117] flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="font-bold text-white tracking-widest uppercase flex items-center gap-2">
                <Package className="w-5 h-5 text-[#d29922]"/>
                RMA Logistics
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setActiveTab("awaiting")} className={clsx("px-4 py-1 text-xs font-bold transition-colors", activeTab === "awaiting" ? "bg-[#d29922] text-[#0d1117]" : "text-[#8b949e] hover:text-white")}>Awaiting Shipment</button>
                <button onClick={() => setActiveTab("in_transit")} className={clsx("px-4 py-1 text-xs font-bold transition-colors", activeTab === "in_transit" ? "bg-[#58a6ff] text-[#0d1117]" : "text-[#8b949e] hover:text-white")}>In Transit</button>
                <button onClick={() => setActiveTab("delivered")} className={clsx("px-4 py-1 text-xs font-bold transition-colors", activeTab === "delivered" ? "bg-[#bc8cff] text-[#0d1117]" : "text-[#8b949e] hover:text-white")}>Delivered / Inspect</button>
                <button onClick={() => setActiveTab("closed")} className={clsx("px-4 py-1 text-xs font-bold transition-colors", activeTab === "closed" ? "bg-[#3fb950] text-[#0d1117]" : "text-[#8b949e] hover:text-white")}>Closed</button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-[#161b22] border border-[#30363d] px-3 py-1">
                <Search className="w-4 h-4 text-[#8b949e]" />
                <input type="text" placeholder="Search RMA, tracking..." className="bg-transparent border-none outline-none text-white text-xs w-48" />
              </div>
            </div>
          </div>
        </div>

        {/* Main Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead className="sticky top-0 bg-[#161b22] border-b border-[#30363d] text-xs text-[#8b949e] shadow-sm z-10">
              <tr>
                <th className="p-3 font-normal pl-6">RMA NUMBER</th>
                <th className="p-3 font-normal">SERIAL</th>
                <th className="p-3 font-normal">PRODUCT / CATEGORY</th>
                <th className="p-3 font-normal">VENDOR</th>
                <th className="p-3 font-normal">CARRIER & TRACKING</th>
                <th className="p-3 font-normal">CARRIER STATUS</th>
                <th className="p-3 font-normal">DAYS ISSUED</th>
                <th className="p-3 font-normal">SLA LIMIT</th>
                <th className="p-3 font-normal text-right pr-6"></th>
              </tr>
            </thead>
            <tbody>
              {displayedRMAs.map(t => {
                const ship = mockShipment(t.rma_number || t.id.toString());
                const days = agoDays(t.updated_at || t.created_at);
                const isOverdue = days > 14;
                return (
                  <tr key={t.id} onClick={() => setDrawerRMA(t)} className={clsx(
                    "border-b border-[#30363d]/50 hover:bg-[#161b22] cursor-pointer transition-colors group",
                    drawerRMA?.id === t.id ? "bg-[#1f242c]" : ""
                  )}>
                    <td className="p-3 pl-6 text-[#d29922] font-bold group-hover:underline">{t.rma_number}</td>
                    <td className="p-3 text-[#c9d1d9] font-mono">{t.serial_number || "Unknown"}</td>
                    <td className="p-3 text-[#8b949e] truncate max-w-[150px]">{t.category || "Hardware"}</td>
                    <td className="p-3 text-[#c9d1d9]">{t.vendor || "-"}</td>
                    <td className="p-3">
                      <div className="flex flex-col">
                        <span className="text-[#e5e5e5]">{ship.carrier}</span>
                        <span className="text-xs text-[#58a6ff] hover:underline">{ship.tracking}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className={clsx("px-2 py-0.5 text-[10px] rounded-full font-bold uppercase", 
                        t.status === "in_transit" ? "bg-[#58a6ff]/10 text-[#58a6ff] border border-[#58a6ff]/30" : 
                        t.status === "delivered" || t.status === "inspection" ? "bg-[#bc8cff]/10 text-[#bc8cff] border border-[#bc8cff]/30" :
                        "bg-[#30363d] text-[#8b949e]")}>
                        {t.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={clsx("font-bold", isOverdue ? "text-[#f85149]" : "text-[#c9d1d9]")}>{days} days</span>
                    </td>
                    <td className="p-3 text-[#8b949e]">14 Days</td>
                    <td className="p-3 pr-6 text-right">
                      <button className="text-[#8b949e] hover:text-[#58a6ff]"><ArrowRight className="w-4 h-4 inline"/></button>
                    </td>
                  </tr>
                );
              })}
              {displayedRMAs.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-[#8b949e] border border-dashed border-[#30363d] m-4">No RMAs in this stage.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drawer */}
      <div className={clsx(
        "absolute top-0 right-0 h-full w-96 bg-[#0d1117] border-l border-[#30363d] shadow-2xl flex flex-col transition-transform duration-300 z-20 transform",
        drawerRMA ? "translate-x-0" : "translate-x-full"
      )}>
        {drawerRMA && (
          <>
            <div className="flex items-center justify-between p-4 border-b border-[#30363d] bg-[#161b22]">
              <div className="flex flex-col">
                <h2 className="text-[#d29922] font-bold tracking-widest text-lg">{drawerRMA.rma_number}</h2>
                <div className="text-xs text-[#8b949e]">Ticket: <Link href={`/board/${drawerRMA.id}`} className="text-[#58a6ff] hover:underline">INC-{drawerRMA.id.toString().slice(0,5)}</Link></div>
              </div>
              <button onClick={() => setDrawerRMA(null)} className="text-[#8b949e] hover:text-white transition-colors p-1"><XCircle className="w-5 h-5"/></button>
            </div>

            <div className="flex-1 p-6 space-y-8 overflow-y-auto">
              
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-[#8b949e] tracking-widest border-b border-[#30363d] pb-2">LOGISTICS TRACE</h3>
                
                <div className="relative pl-6 space-y-6">
                  {/* Vertical Line */}
                  <div className="absolute left-2.5 top-2 bottom-2 w-0.5 bg-[#30363d]"></div>
                  
                  {/* Step 1 */}
                  <div className="relative">
                    <div className="absolute -left-[1.35rem] top-1 w-3 h-3 rounded-full bg-[#3fb950] shadow-[0_0_8px_rgba(63,185,80,0.5)]"></div>
                    <div className="text-[#e5e5e5] text-sm font-bold">RMA Issued</div>
                    <div className="text-[#8b949e] text-xs">{new Date(drawerRMA.created_at).toLocaleString()}</div>
                  </div>
                  
                  {/* Step 2 */}
                  <div className="relative">
                    <div className={clsx("absolute -left-[1.35rem] top-1 w-3 h-3 rounded-full", drawerRMA.status === "rma_issued" ? "bg-[#30363d]" : "bg-[#58a6ff] shadow-[0_0_8px_rgba(88,166,255,0.5)]")}></div>
                    <div className={clsx("text-sm font-bold", drawerRMA.status === "rma_issued" ? "text-[#8b949e]" : "text-[#e5e5e5]")}>In Transit (Carrier Picked Up)</div>
                    <div className="text-[#8b949e] text-xs">Tracking: {mockShipment(drawerRMA.rma_number || "X").tracking}</div>
                  </div>

                  {/* Step 3 */}
                  <div className="relative">
                    <div className={clsx("absolute -left-[1.35rem] top-1 w-3 h-3 rounded-full", drawerRMA.status === "delivered" || drawerRMA.status === "inspection" || drawerRMA.status === "closed" ? "bg-[#bc8cff] shadow-[0_0_8px_rgba(188,140,255,0.5)]" : "bg-[#30363d]")}></div>
                    <div className={clsx("text-sm font-bold", drawerRMA.status === "delivered" || drawerRMA.status === "inspection" || drawerRMA.status === "closed" ? "text-[#e5e5e5]" : "text-[#8b949e]")}>Delivered to Facility</div>
                  </div>
                </div>
              </div>

            </div>

            {/* Actions Bottom Bar */}
            <div className="border-t border-[#30363d] bg-[#161b22] p-4 flex flex-col gap-2">
              <button onClick={() => handleAction("mark_received")} className="w-full flex items-center justify-center gap-2 bg-[#bc8cff]/10 border border-[#bc8cff] text-[#bc8cff] p-2 hover:bg-[#bc8cff] hover:text-[#0d1117] transition-all font-bold tracking-widest text-xs">
                <ClipboardCheck className="w-4 h-4"/> RECORD INSPECTION RESULT
              </button>
              
              <div className="flex gap-2">
                <button onClick={() => handleAction("reprint_label")} className="flex-1 flex items-center justify-center gap-2 border border-[#30363d] text-[#e5e5e5] p-2 hover:border-[#8b949e] transition-all font-bold tracking-widest text-xs">
                  <Printer className="w-3 h-3"/> RESEND LABEL
                </button>
                <button onClick={() => handleAction("cancel_rma")} className="flex-1 flex items-center justify-center gap-2 border border-[#f85149] text-[#f85149] p-2 hover:bg-[#f85149] hover:text-white transition-all font-bold tracking-widest text-xs">
                  <XCircle className="w-3 h-3"/> CANCEL RMA
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
