"use client";
import { useState, useEffect } from "react";
import { TicketSummary, TicketDetail } from "@/lib/api";
import { fetchTicketDetail, updateTicket, bulkUpdateTickets } from "./actions";
import { clsx } from "clsx";
import { X, Search, Filter, Save, MoreHorizontal, MessageSquare, Check, XCircle, Wrench, UserPlus, FileText, ChevronRight, Cpu } from "lucide-react";

function agoShort(iso: string) {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 60) return `${m}m`;
  if (m < 1440) return `${Math.round(m / 60)}h`;
  return `${Math.round(m / 1440)}d`;
}

function getDotColor(level: number) {
  if (level === 2) return "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]";
  if (level === 1) return "bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]";
  return "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]";
}

export default function TicketWorkspace({ initialTickets, defaultStatus }: { initialTickets: TicketSummary[], defaultStatus?: string }) {
  const [tickets, setTickets] = useState<TicketSummary[]>(initialTickets);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [activeTab, setActiveTab] = useState(defaultStatus ? "filtered" : "tier1");
  const [drawerTicket, setDrawerTicket] = useState<TicketDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  
  const [serialOverride, setSerialOverride] = useState("");

  useEffect(() => {
    setTickets(initialTickets);
  }, [initialTickets]);

  const displayedTickets = tickets.filter(t => {
    if (activeTab === "tier1") return t.status === "human_review";
    if (activeTab === "filtered" && defaultStatus) return t.status === defaultStatus;
    return true; // "all"
  });

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectAll = () => {
    if (selectedIds.length === displayedTickets.length) setSelectedIds([]);
    else setSelectedIds(displayedTickets.map(t => t.id));
  };

  const openDrawer = async (id: number) => {
    setLoadingDetail(true);
    setDrawerTicket(null);
    const detail = await fetchTicketDetail(id);
    if (detail) {
      setDrawerTicket(detail);
      setSerialOverride(detail.serial_number || "");
    }
    setLoadingDetail(false);
  };

  const handleAction = async (action: string) => {
    if (!drawerTicket) return;
    setLoadingDetail(true);
    if (action === "approve") {
      await updateTicket(drawerTicket.id, { status: "rma_issued", serial_number: serialOverride });
    } else if (action === "reject") {
      await updateTicket(drawerTicket.id, { status: "closed" });
    } else if (action === "paid") {
      await updateTicket(drawerTicket.id, { route_reason: "paid_repair" });
    }
    // close drawer and refresh state
    setDrawerTicket(null);
    setLoadingDetail(false);
    // In a real app we might re-fetch the list, but Server Actions calling revalidatePath will trigger a server re-render and update initialTickets
  };

  const handleBulkAction = async (action: string) => {
    if (action === "reject") {
      await bulkUpdateTickets(selectedIds, { status: "closed" });
    }
    setSelectedIds([]);
  };

  return (
    <div className="flex h-full text-sm font-mono tracking-wide text-[#e5e5e5] relative overflow-hidden bg-[#010409]">
      
      {/* Main Workspace */}
      <div className={clsx("flex-1 flex flex-col transition-all duration-300", drawerTicket ? "mr-96" : "")}>
        
        {/* Top Header / Filters */}
        <div className="border-b border-[#30363d] p-4 bg-[#0d1117] flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="font-bold text-white tracking-widest uppercase">Tickets Workspace</div>
              <div className="flex items-center gap-2">
                <button onClick={() => setActiveTab("tier1")} className={clsx("px-4 py-1 text-xs font-bold transition-colors", activeTab === "tier1" ? "bg-[#58a6ff] text-[#0d1117]" : "text-[#8b949e] hover:text-white")}>Tier 1 Queue (Default)</button>
                <button onClick={() => setActiveTab("all")} className={clsx("px-4 py-1 text-xs font-bold transition-colors", activeTab === "all" ? "bg-[#58a6ff] text-[#0d1117]" : "text-[#8b949e] hover:text-white")}>All Tickets</button>
                {defaultStatus && <button onClick={() => setActiveTab("filtered")} className={clsx("px-4 py-1 text-xs font-bold transition-colors", activeTab === "filtered" ? "bg-[#58a6ff] text-[#0d1117]" : "text-[#8b949e] hover:text-white")}>Status: {defaultStatus.toUpperCase()}</button>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-3 py-1 bg-[#161b22] border border-[#30363d] hover:border-[#8b949e] transition-colors text-xs text-[#8b949e]"><Save className="w-3 h-3"/> Save View</button>
            </div>
          </div>
          
          {/* Filter Bar */}
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-2 bg-[#161b22] border border-[#30363d] px-3 py-1.5 flex-1 max-w-sm">
              <Search className="w-4 h-4 text-[#8b949e]" />
              <input type="text" placeholder="Search customer, serial, ticket..." className="bg-transparent border-none outline-none text-white w-full" />
            </div>
            <select className="bg-[#161b22] border border-[#30363d] px-3 py-1.5 text-[#c9d1d9] outline-none"><option>Status: All</option></select>
            <select className="bg-[#161b22] border border-[#30363d] px-3 py-1.5 text-[#c9d1d9] outline-none"><option>Route: All</option></select>
            <select className="bg-[#161b22] border border-[#30363d] px-3 py-1.5 text-[#c9d1d9] outline-none"><option>Vendor: All</option></select>
            <select className="bg-[#161b22] border border-[#30363d] px-3 py-1.5 text-[#c9d1d9] outline-none"><option>SLA: All</option></select>
            <button className="px-3 py-1.5 border border-[#30363d] text-[#8b949e] hover:text-white"><Filter className="w-4 h-4" /></button>
          </div>
        </div>

        {/* Bulk Actions Strip */}
        {selectedIds.length > 0 && (
          <div className="bg-[#58a6ff]/10 border-b border-[#58a6ff]/30 p-2 px-4 flex items-center justify-between animate-in fade-in slide-in-from-top-2">
            <div className="text-[#58a6ff] font-bold text-xs">{selectedIds.length} tickets selected</div>
            <div className="flex gap-2">
              <button onClick={() => handleBulkAction("assign")} className="px-3 py-1 text-xs bg-[#161b22] border border-[#30363d] hover:border-[#58a6ff] text-white flex items-center gap-2"><UserPlus className="w-3 h-3"/> Assign</button>
              <button onClick={() => handleBulkAction("reject")} className="px-3 py-1 text-xs bg-[#f85149] text-white font-bold flex items-center gap-2"><XCircle className="w-3 h-3"/> Reject All</button>
            </div>
          </div>
        )}

        {/* Main Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead className="sticky top-0 bg-[#161b22] border-b border-[#30363d] text-xs text-[#8b949e] shadow-sm z-10">
              <tr>
                <th className="p-3 font-normal w-10 text-center"><input type="checkbox" onChange={selectAll} checked={selectedIds.length === displayedTickets.length && displayedTickets.length > 0} className="accent-[#58a6ff] bg-transparent border-[#30363d]" /></th>
                <th className="p-3 font-normal">TICKET</th>
                <th className="p-3 font-normal">CUSTOMER</th>
                <th className="p-3 font-normal">SERIAL</th>
                <th className="p-3 font-normal">PRODUCT / VENDOR</th>
                <th className="p-3 font-normal">CATEGORY</th>
                <th className="p-3 font-normal">ROUTE / REASON</th>
                <th className="p-3 font-normal">WARRANTY</th>
                <th className="p-3 font-normal">SLA</th>
                <th className="p-3 font-normal">ASSIGNEE</th>
                <th className="p-3 font-normal text-right">AGE</th>
              </tr>
            </thead>
            <tbody>
              {displayedTickets.map(t => (
                <tr key={t.id} onClick={(e) => {
                  if ((e.target as HTMLElement).tagName !== "INPUT") openDrawer(t.id);
                }} className={clsx(
                  "border-b border-[#30363d]/50 hover:bg-[#161b22] cursor-pointer transition-colors group",
                  drawerTicket?.id === t.id ? "bg-[#1f242c]" : ""
                )}>
                  <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedIds.includes(t.id)} onChange={() => toggleSelect(t.id)} className="accent-[#58a6ff]" />
                  </td>
                  <td className="p-3 text-[#58a6ff] font-bold group-hover:underline">INC-{t.id.toString().slice(0,5)}</td>
                  <td className="p-3 text-[#c9d1d9] truncate max-w-[150px]">{t.customer_name || t.customer_email.split('@')[0]}</td>
                  <td className="p-3 text-[#8b949e] font-mono">{t.serial_number || "-"}</td>
                  <td className="p-3 text-[#c9d1d9] truncate max-w-[150px]">{t.vendor || "Unknown"}</td>
                  <td className="p-3 text-[#d29922] truncate max-w-[150px]">{t.category || "-"}</td>
                  <td className="p-3 text-[#8b949e] truncate max-w-[150px]">{t.route_reason || t.route || "Triage"}</td>
                  <td className="p-3">
                    <span className={clsx("px-2 py-0.5 text-[10px] rounded-full font-bold uppercase", t.warranty_status === "Active" ? "bg-[#3fb950]/10 text-[#3fb950] border border-[#3fb950]/30" : "bg-[#f85149]/10 text-[#f85149] border border-[#f85149]/30")}>
                      {t.warranty_status || "Unknown"}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className={clsx("w-2 h-2 rounded-full", getDotColor(t.sla_level))}></div>
                      <span className="text-[#8b949e] text-xs">P{t.sla_level === 2 ? 1 : t.sla_level === 1 ? 2 : 4}</span>
                    </div>
                  </td>
                  <td className="p-3 text-[#a0a0a0] truncate max-w-[100px]">-</td>
                  <td className="p-3 text-right text-[#8b949e]">{agoShort(t.created_at)}</td>
                </tr>
              ))}
              {displayedTickets.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-[#8b949e] border border-dashed border-[#30363d] m-4">No tickets match this view.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Drawer */}
      <div className={clsx(
        "absolute top-0 right-0 h-full w-96 bg-[#0d1117] border-l border-[#30363d] shadow-2xl flex flex-col transition-transform duration-300 z-20 transform",
        drawerTicket ? "translate-x-0" : "translate-x-full"
      )}>
        {loadingDetail && !drawerTicket && (
          <div className="flex-1 flex items-center justify-center text-[#58a6ff] animate-pulse">Loading trace...</div>
        )}

        {drawerTicket && (
          <>
            <div className="flex items-center justify-between p-4 border-b border-[#30363d] bg-[#161b22]">
              <div className="flex items-center gap-3">
                <div className={clsx("w-3 h-3 rounded-full", getDotColor(drawerTicket.sla_level))}></div>
                <h2 className="text-white font-bold tracking-widest text-lg">INC-{drawerTicket.id.toString().slice(0,5)}</h2>
              </div>
              <button onClick={() => setDrawerTicket(null)} className="text-[#8b949e] hover:text-white transition-colors p-1"><X className="w-5 h-5"/></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              
              {/* Decision Trace */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-[#8b949e] tracking-widest flex items-center gap-2"><Cpu className="w-4 h-4"/> AI DECISION TRACE</h3>
                <div className="bg-[#161b22] border border-[#30363d] p-3 text-xs font-mono space-y-2 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-[#bc8cff]"></div>
                  <div className="pl-2 space-y-1">
                    <div className="flex justify-between"><span className="text-[#8b949e]">Extraction:</span> <span className="text-[#58a6ff]">{drawerTicket.category || "Unknown"}</span></div>
                    <div className="flex justify-between"><span className="text-[#8b949e]">Confidence:</span> <span className={clsx("font-bold", (drawerTicket.confidence || 0) > 0.8 ? "text-[#3fb950]" : "text-[#d29922]")}>{((drawerTicket.confidence || 0)*100).toFixed(1)}%</span></div>
                    <div className="flex justify-between"><span className="text-[#8b949e]">Intent:</span> <span className="text-[#e5e5e5] truncate ml-4">{drawerTicket.intent || "Hardware replacement requested"}</span></div>
                  </div>
                </div>
              </div>

              {/* Message Context */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-[#8b949e] tracking-widest flex items-center gap-2"><MessageSquare className="w-4 h-4"/> CUSTOMER MESSAGE</h3>
                <div className="bg-[#161b22] border border-[#30363d] p-3 text-sm text-[#c9d1d9] leading-relaxed whitespace-pre-wrap italic border-l-4 border-l-[#30363d]">
                  "{drawerTicket.body_raw}"
                </div>
              </div>

              {/* Warranty & Serial */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-[#8b949e] tracking-widest flex items-center gap-2"><FileText className="w-4 h-4"/> DEVICE & WARRANTY</h3>
                <div className="bg-[#161b22] border border-[#30363d] p-3 space-y-3">
                  <div>
                    <label className="text-xs text-[#8b949e] block mb-1">Serial Number (Editable)</label>
                    <input type="text" value={serialOverride} onChange={e => setSerialOverride(e.target.value)} className="w-full bg-[#0d1117] border border-[#30363d] p-2 text-white font-mono focus:border-[#58a6ff] outline-none transition-colors" />
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#8b949e]">Status:</span>
                    <span className={clsx("font-bold uppercase", drawerTicket.warranty_status === "Active" ? "text-[#3fb950]" : "text-[#f85149]")}>{drawerTicket.warranty_status || "Unknown"}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#8b949e]">Prior RMAs:</span>
                    <span className={drawerTicket.prior_rma_count > 0 ? "text-[#d29922]" : "text-[#c9d1d9]"}>{drawerTicket.prior_rma_count}</span>
                  </div>
                  {drawerTicket.shipment && (
                    <div className="flex justify-between text-xs border-t border-[#30363d] pt-2">
                      <span className="text-[#8b949e]">Shipment:</span>
                      <span className="text-[#58a6ff]">{drawerTicket.shipment.tracking_number}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Deadlines & Notes */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-[#8b949e] tracking-widest">DEADLINES & NOTES</h3>
                <div className="bg-[#161b22] border border-[#30363d] p-3 space-y-3 text-xs">
                  {drawerTicket.deadlines?.map((d, i) => (
                    <div key={i} className="flex justify-between items-center text-[#f85149]">
                      <span>{d.kind} SLA:</span>
                      <span>{new Date(d.due_at).toLocaleTimeString()}</span>
                    </div>
                  ))}
                  {(drawerTicket.deadlines?.length === 0 || !drawerTicket.deadlines) && (
                    <div className="text-[#8b949e] italic">No active deadlines</div>
                  )}
                  <textarea placeholder="Add an internal note..." className="w-full bg-[#0d1117] border border-[#30363d] p-2 text-white mt-2 resize-y focus:border-[#58a6ff] outline-none" rows={2}></textarea>
                </div>
              </div>

            </div>

            {/* Actions */}
            <div className="border-t border-[#30363d] bg-[#161b22] p-4 flex flex-col gap-2">
              <button onClick={() => handleAction("approve")} className="w-full flex items-center justify-center gap-2 bg-[#3fb950]/10 border border-[#3fb950] text-[#3fb950] p-2 hover:bg-[#3fb950] hover:text-[#0d1117] transition-all font-bold tracking-widest text-xs shadow-[0_0_10px_rgba(63,185,80,0.2)]">
                <Check className="w-4 h-4"/> APPROVE RMA
              </button>
              <button onClick={() => handleAction("paid")} className="w-full flex items-center justify-center gap-2 bg-[#d29922]/10 border border-[#d29922] text-[#d29922] p-2 hover:bg-[#d29922] hover:text-[#0d1117] transition-all font-bold tracking-widest text-xs">
                <Wrench className="w-4 h-4"/> SEND TO PAID REPAIR
              </button>
              <div className="flex gap-2">
                <button className="flex-1 flex items-center justify-center gap-2 border border-[#30363d] text-[#8b949e] p-2 hover:bg-[#30363d] hover:text-white transition-all font-bold tracking-widest text-[10px] sm:text-xs">
                  <FileText className="w-3 h-3"/> ADD NOTE
                </button>
                <button onClick={() => handleAction("reject")} className="flex-1 flex items-center justify-center gap-2 border border-[#f85149] text-[#f85149] p-2 hover:bg-[#f85149] hover:text-white transition-all font-bold tracking-widest text-[10px] sm:text-xs">
                  <XCircle className="w-3 h-3"/> REJECT
                </button>
                <button className="flex-1 flex items-center justify-center gap-2 border border-[#58a6ff] text-[#58a6ff] p-2 hover:bg-[#58a6ff] hover:text-[#0d1117] transition-all font-bold tracking-widest text-[10px] sm:text-xs">
                  <UserPlus className="w-3 h-3"/> ASSIGN
                </button>
              </div>
            </div>
          </>
        )}
      </div>

    </div>
  );
}
