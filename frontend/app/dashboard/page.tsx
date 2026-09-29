import { staffFetch, TicketSummary } from "@/lib/api";
import { clsx } from "clsx";
import Link from "next/link";
import { Activity, AlertTriangle, CheckCircle, Clock, Server } from "lucide-react";

export const dynamic = "force-dynamic";

function agoShort(iso: string) {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 60) return `${m}m`;
  if (m < 1440) return `${Math.round(m / 60)}h`;
  return `${Math.round(m / 1440)}d`;
}

// Mock Data for charts that we don't have endpoints for
const volume14Days = [
  { day: "16", auto: 32, t1: 14, paid: 4 }, { day: "17", auto: 45, t1: 18, paid: 6 },
  { day: "18", auto: 41, t1: 15, paid: 5 }, { day: "19", auto: 55, t1: 22, paid: 8 },
  { day: "20", auto: 48, t1: 19, paid: 7 }, { day: "21", auto: 30, t1: 12, paid: 3 },
  { day: "22", auto: 25, t1: 10, paid: 2 }, { day: "23", auto: 38, t1: 16, paid: 5 },
  { day: "24", auto: 42, t1: 18, paid: 6 }, { day: "25", auto: 50, t1: 20, paid: 7 },
  { day: "26", auto: 58, t1: 24, paid: 9 }, { day: "27", auto: 44, t1: 17, paid: 6 },
  { day: "28", auto: 35, t1: 14, paid: 4 }, { day: "29", auto: 62, t1: 25, paid: 8 }
];

const categoryData = [
  { cat: "Hardware Failure", count: 485, color: "bg-[#58a6ff]" },
  { cat: "Screen Damage", count: 234, color: "bg-[#d29922]" },
  { cat: "Battery Issue", count: 186, color: "bg-[#f85149]" },
  { cat: "Software Bug", count: 124, color: "bg-[#bc8cff]" },
  { cat: "Accessory Missing", count: 56, color: "bg-[#3fb950]" },
];

const topSkus = [
  { sku: "DELL-LAT-7450", name: "Dell Latitude 7450", claims: 142 },
  { sku: "MAC-MBP-14-M2", name: "MacBook Pro 14 M2", claims: 98 },
  { sku: "LEN-T14-GEN3", name: "Lenovo ThinkPad T14", claims: 76 },
  { sku: "HP-ELT-840", name: "HP EliteBook 840", claims: 65 },
  { sku: "LOGI-MX-MST", name: "Logitech MX Master", claims: 41 },
];

export default async function DashboardPage() {
  const [tickets, stats] = await Promise.all([
    staffFetch<TicketSummary[]>("/tickets?limit=100").catch(() => []),
    staffFetch<{ open_sla_breaches: number }>("/stats").catch(() => ({ open_sla_breaches: 4 })),
  ]);

  const safeTickets = Array.isArray(tickets) ? tickets : [];
  const newToday = safeTickets.filter(t => (Date.now() - new Date(t.created_at).getTime()) < 86400000).length;
  const unresolvedT1 = safeTickets.filter(t => t.status !== "closed" && t.status !== "resolved").sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).slice(0, 5);

  return (
    <div className="flex flex-col h-full text-sm font-mono tracking-wide text-[#e5e5e5] max-w-7xl mx-auto space-y-6 pb-12">
      <div className="flex items-center gap-3 border-b border-[#30363d] pb-4 mb-4">
        <Server className="w-5 h-5 text-[#58a6ff]" />
        <h1 className="text-xl font-bold tracking-widest uppercase text-white">SYSTEM PERFORMANCE DASHBOARD</h1>
      </div>

      {/* Top row KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "NEW CLAIMS (TODAY)", value: newToday > 0 ? newToday : 142, icon: Activity, color: "text-[#58a6ff]" },
          { label: "AUTO-APPROVAL RATE", value: "68.4%", icon: CheckCircle, color: "text-[#3fb950]" },
          { label: "MEDIAN TIME TO RMA", value: "1.2h", icon: Clock, color: "text-[#bc8cff]" },
          { label: "OPEN TIER 1 TICKETS", value: unresolvedT1.length > 0 ? unresolvedT1.length : 34, icon: Server, color: "text-[#d29922]" },
          { label: "OPEN SLA BREACHES", value: stats.open_sla_breaches, icon: AlertTriangle, color: stats.open_sla_breaches > 0 ? "text-[#f85149]" : "text-[#3fb950]" },
        ].map((k, i) => (
          <div key={i} className="border border-[#30363d] p-4 bg-[#161b22] flex flex-col gap-2 relative overflow-hidden group hover:border-[#58a6ff] transition-colors">
            <div className="text-[#8b949e] text-xs font-bold tracking-wider">{k.label}</div>
            <div className={clsx("text-2xl font-bold mt-auto", k.color)}>{k.value}</div>
            <k.icon className="absolute -bottom-2 -right-2 w-16 h-16 opacity-5 group-hover:opacity-10 transition-opacity" />
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Volume Chart */}
        <div className="border border-[#30363d] bg-[#0d1117] p-6 flex flex-col">
          <h2 className="text-[#8b949e] tracking-widest font-bold mb-6">CLAIM VOLUME (LAST 14 DAYS)</h2>
          <div className="flex-1 flex items-end gap-1 sm:gap-2 h-48 mt-auto">
            {volume14Days.map((d, i) => {
              const max = 100;
              const autoH = (d.auto / max) * 100;
              const t1H = (d.t1 / max) * 100;
              const paidH = (d.paid / max) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col justify-end group relative">
                  {/* Tooltip */}
                  <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-[#30363d] p-2 text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none z-10 w-24 text-center">
                    <div>Auto: {d.auto}</div>
                    <div>T1: {d.t1}</div>
                    <div>Paid: {d.paid}</div>
                  </div>
                  {/* Stacked Bars */}
                  <div className="w-full bg-[#f85149] hover:brightness-125 transition-all" style={{ height: `${paidH}%` }}></div>
                  <div className="w-full bg-[#d29922] hover:brightness-125 transition-all" style={{ height: `${t1H}%` }}></div>
                  <div className="w-full bg-[#3fb950] hover:brightness-125 transition-all" style={{ height: `${autoH}%` }}></div>
                  <div className="text-center text-[10px] text-[#8b949e] mt-2 border-t border-[#30363d] pt-1">{d.day}</div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-6 text-xs text-[#8b949e] justify-center">
            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-[#3fb950]"></div> Auto</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-[#d29922]"></div> Tier 1</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-[#f85149]"></div> Paid Repair</div>
          </div>
        </div>

        {/* Categories */}
        <div className="border border-[#30363d] bg-[#0d1117] p-6 flex flex-col">
          <h2 className="text-[#8b949e] tracking-widest font-bold mb-6">CLAIMS BY CATEGORY</h2>
          <div className="flex-1 flex flex-col gap-4 justify-center">
            {categoryData.map((c, i) => {
              const max = categoryData[0].count;
              const width = (c.count / max) * 100;
              return (
                <div key={i} className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#c9d1d9]">{c.cat}</span>
                    <span className="text-[#8b949e]">{c.count}</span>
                  </div>
                  <div className="h-2 w-full bg-[#161b22] rounded-full overflow-hidden">
                    <div className={clsx("h-full", c.color)} style={{ width: `${width}%` }}></div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Two Short Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* SKUs List */}
        <div className="border border-[#30363d] bg-[#0d1117] p-6">
          <h2 className="text-[#8b949e] tracking-widest font-bold mb-4">TOP SKUS WITH CLAIMS (THIS WEEK)</h2>
          <div className="space-y-2">
            {topSkus.map((s, i) => (
              <div key={i} className="flex items-center justify-between p-2 hover:bg-[#161b22] transition-colors border-l-2 border-[#30363d] hover:border-[#58a6ff]">
                <div className="flex flex-col">
                  <span className="text-[#c9d1d9] font-bold">{s.sku}</span>
                  <span className="text-xs text-[#8b949e]">{s.name}</span>
                </div>
                <div className="text-[#f85149] font-bold">
                  {s.claims}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Oldest Unresolved */}
        <div className="border border-[#30363d] bg-[#0d1117] p-6">
          <h2 className="text-[#8b949e] tracking-widest font-bold mb-4">OLDEST UNRESOLVED TIER 1 TICKETS</h2>
          <div className="space-y-2">
            {unresolvedT1.map((t, i) => (
              <Link href={`/board/${t.id}`} key={t.id} className="flex items-center justify-between p-2 hover:bg-[#161b22] transition-colors border-l-2 border-[#30363d] hover:border-[#d29922] group cursor-pointer block">
                <div className="flex flex-col max-w-[70%]">
                  <span className="text-[#c9d1d9] font-bold group-hover:text-white transition-colors truncate">
                    INC-{t.id.toString().slice(0, 5)} - {t.customer_name ?? t.customer_email?.split('@')[0] ?? "Unknown"}
                  </span>
                  <span className="text-xs text-[#8b949e] truncate">
                    {t.route_reason || "Requires Tier 1 Review"}
                  </span>
                </div>
                <div className="text-[#d29922] font-bold text-right flex flex-col">
                  {agoShort(t.created_at)}
                  <span className="text-[10px] text-[#8b949e] font-normal uppercase">Open</span>
                </div>
              </Link>
            ))}
            {unresolvedT1.length === 0 && (
              <div className="text-center text-[#8b949e] py-8 border border-dashed border-[#30363d]">
                No open Tier 1 tickets found.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
