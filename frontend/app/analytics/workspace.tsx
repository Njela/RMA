"use client";
import { clsx } from "clsx";
import { Download, BarChart2, PieChart, Activity, ShieldAlert, Cpu } from "lucide-react";

export default function AnalyticsWorkspace() {
  return (
    <div className="flex flex-col h-full text-sm font-mono tracking-wide text-[#e5e5e5] max-w-7xl mx-auto space-y-6 pb-12 overflow-y-auto">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#30363d] pb-4 bg-[#010409] sticky top-0 z-10 pt-4">
        <div className="flex items-center gap-3">
          <BarChart2 className="w-5 h-5 text-[#bc8cff]" />
          <h1 className="text-xl font-bold tracking-widest uppercase text-white">SYSTEM ANALYTICS & INSIGHTS</h1>
        </div>
        
        <div className="flex gap-4">
          <div className="bg-[#161b22] border border-[#30363d] px-3 py-1.5 text-xs text-[#8b949e]">
            Date Range: Last 30 Days
          </div>
          <button className="flex items-center gap-2 px-4 py-1.5 bg-[#161b22] border border-[#30363d] text-[#e5e5e5] hover:border-[#bc8cff] transition-all font-bold text-xs">
            <Download className="w-3 h-3"/> EXPORT CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Automation Funnel */}
        <div className="bg-[#0d1117] border border-[#30363d] p-6 flex flex-col gap-4">
          <h2 className="text-xs font-bold text-[#8b949e] tracking-widest border-b border-[#30363d] pb-2 flex items-center gap-2"><PieChart className="w-4 h-4"/> AUTOMATION FUNNEL</h2>
          <div className="flex h-12 bg-[#161b22] rounded-sm overflow-hidden border border-[#30363d]">
            <div className="bg-[#3fb950] h-full flex items-center justify-center text-[10px] font-bold text-[#0d1117]" style={{ width: "42%" }}>AUTO (42%)</div>
            <div className="bg-[#58a6ff] h-full flex items-center justify-center text-[10px] font-bold text-[#0d1117]" style={{ width: "45%" }}>TIER 1 (45%)</div>
            <div className="bg-[#d29922] h-full flex items-center justify-center text-[10px] font-bold text-[#0d1117]" style={{ width: "13%" }}>PAID (13%)</div>
          </div>
          <div className="text-xs text-[#8b949e]">
            Of 1,492 received tickets, 42% were handled automatically without human intervention.
          </div>
        </div>

        {/* LLM Quality */}
        <div className="bg-[#0d1117] border border-[#30363d] p-6 flex flex-col gap-4">
          <h2 className="text-xs font-bold text-[#8b949e] tracking-widest border-b border-[#30363d] pb-2 flex items-center gap-2"><Cpu className="w-4 h-4"/> LLM QUALITY & COST</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-[#8b949e] text-xs">Avg Confidence</div>
              <div className="text-xl font-bold text-[#3fb950]">94.8%</div>
            </div>
            <div>
              <div className="text-[#8b949e] text-xs">Avg Latency</div>
              <div className="text-xl font-bold text-[#e5e5e5]">1.2s</div>
            </div>
            <div>
              <div className="text-[#8b949e] text-xs">Est. Cost / Mo</div>
              <div className="text-xl font-bold text-[#e5e5e5]">$42.50</div>
            </div>
            <div>
              <div className="text-[#8b949e] text-xs">Human Override Rate</div>
              <div className="text-xl font-bold text-[#f85149]">3.2%</div>
            </div>
          </div>
        </div>

        {/* Reason Codes */}
        <div className="bg-[#0d1117] border border-[#30363d] p-6 flex flex-col gap-4">
          <h2 className="text-xs font-bold text-[#8b949e] tracking-widest border-b border-[#30363d] pb-2 flex items-center gap-2"><Activity className="w-4 h-4"/> TOP REASON CODES (TIER 1)</h2>
          <div className="space-y-3">
            {[
              { reason: "Missing Serial Number", count: 245, pct: 40 },
              { reason: "Policy Exception Request", count: 182, pct: 30 },
              { reason: "Damage Not Covered", count: 85, pct: 15 },
              { reason: "Unknown Category", count: 42, pct: 8 }
            ].map((r, i) => (
              <div key={i} className="flex flex-col gap-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#c9d1d9]">{r.reason}</span>
                  <span className="text-[#8b949e]">{r.count}</span>
                </div>
                <div className="h-1.5 bg-[#161b22] rounded-full overflow-hidden">
                  <div className="h-full bg-[#58a6ff]" style={{ width: `${r.pct}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Product Quality & Alerts */}
        <div className="bg-[#0d1117] border border-[#30363d] p-6 flex flex-col gap-4">
          <h2 className="text-xs font-bold text-[#f85149] tracking-widest border-b border-[#30363d] pb-2 flex items-center gap-2"><ShieldAlert className="w-4 h-4"/> HARDWARE FAILURE ALERTS</h2>
          
          <div className="bg-[#f85149]/10 border border-[#f85149]/30 p-3 flex flex-col gap-2">
            <div className="text-[#f85149] font-bold text-xs">SPIKE DETECTED</div>
            <div className="text-sm text-[#e5e5e5]">6 DOA claims for <span className="font-bold">LEN-T14-GEN3</span> (Batch #8492) this week.</div>
          </div>

          <div className="space-y-2 mt-2">
            <div className="text-xs text-[#8b949e] mb-2">Top Failure Rates by SKU</div>
            {[
              { sku: "MAC-MBP-14-M2", rate: "2.4%" },
              { sku: "DELL-LAT-7450", rate: "1.8%" },
              { sku: "LEN-T14-GEN3", rate: "1.5%" }
            ].map((s, i) => (
              <div key={i} className="flex justify-between text-xs border-b border-[#30363d] pb-1">
                <span className="text-[#c9d1d9]">{s.sku}</span>
                <span className="text-[#d29922] font-bold">{s.rate}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
