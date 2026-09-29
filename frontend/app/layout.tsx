import type { Metadata } from "next";
import Link from "next/link";
import { 
  Search, Plus, LayoutDashboard, Ticket, PackageOpen, AlertTriangle, Activity, BarChart3, Terminal
} from "lucide-react";
import "./globals.css";

export const metadata: Metadata = { title: "Service Operations", description: "Terminal UI Ticket Triage" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <script src="https://cdn.tailwindcss.com"></script>
        <style dangerouslySetInnerHTML={{__html: `
          body { background-color: #0d1117; color: #c9d1d9; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
          .t-border { border-color: #30363d; }
          .t-glow:hover { box-shadow: inset 2px 0 0 0 #58a6ff; background-color: #161b22; }
          ::-webkit-scrollbar { width: 8px; height: 8px; }
          ::-webkit-scrollbar-track { background: #0d1117; }
          ::-webkit-scrollbar-thumb { background: #30363d; border-radius: 4px; }
          ::-webkit-scrollbar-thumb:hover { background: #58a6ff; }
        `}} />
      </head>
      <body className="h-screen w-full overflow-hidden flex flex-col p-4 md:p-6 lg:p-8 selection:bg-[#1f6feb] selection:text-white">
        <div className="flex-1 flex flex-col border border-[#30363d] rounded-xl overflow-hidden bg-[#0d1117] shadow-2xl shadow-blue-900/10 max-w-[1400px] mx-auto w-full relative">
          
          {/* Top Bar */}
          <header className="flex items-center justify-between px-6 py-4 border-b border-[#30363d] shrink-0 bg-[#010409]">
            <div className="flex items-center gap-3">
              <Terminal className="w-5 h-5 text-[#3fb950]" />
              <span className="font-bold tracking-wider text-sm text-[#58a6ff] uppercase drop-shadow-[0_0_8px_rgba(88,166,255,0.4)]">
                SERVICE OPERATIONS
              </span>
            </div>
            
            <div className="flex items-center gap-6">
              <button className="flex items-center gap-2 text-sm text-[#8b949e] hover:text-[#58a6ff] transition-colors focus:outline-none focus:text-[#58a6ff]">
                <Search className="w-4 h-4" /> [ Search ]
              </button>
              <Link href="/" className="flex items-center gap-2 text-sm text-[#8b949e] hover:text-[#3fb950] transition-colors focus:outline-none focus:text-[#3fb950]">
                <Plus className="w-4 h-4" /> [ Create ]
              </Link>
            </div>
          </header>

          <div className="flex-1 flex overflow-hidden">
            {/* Sidebar */}
            <aside className="w-48 sm:w-56 border-r border-[#30363d] flex flex-col py-4 shrink-0 overflow-y-auto bg-[#010409]">
              <nav className="flex flex-col gap-1 w-full text-sm">
                <Link href="/board" className="flex items-center gap-3 px-6 py-2.5 text-[#8b949e] hover:text-[#c9d1d9] t-glow transition-all group">
                  <Terminal className="w-4 h-4 group-hover:text-[#58a6ff]" /> Operations
                </Link>
                <Link href="/dashboard" className="flex items-center gap-3 px-6 py-2.5 text-[#8b949e] hover:text-[#c9d1d9] t-glow transition-all group">
                  <LayoutDashboard className="w-4 h-4 group-hover:text-[#58a6ff]" /> Dashboard
                </Link>
                <Link href="/tickets" className="flex items-center gap-3 px-6 py-2.5 text-[#8b949e] hover:text-[#c9d1d9] t-glow transition-all group">
                  <Ticket className="w-4 h-4 group-hover:text-[#bc8cff]" /> Tickets
                </Link>
                <Link href="/rma" className="flex items-center gap-3 px-6 py-2.5 text-[#8b949e] hover:text-[#c9d1d9] t-glow transition-all group">
                  <PackageOpen className="w-4 h-4 group-hover:text-[#d29922]" /> RMA
                </Link>
                <Link href="/escalations" className="flex items-center gap-3 px-6 py-2.5 text-[#8b949e] hover:text-[#c9d1d9] t-glow transition-all group">
                  <AlertTriangle className="w-4 h-4 group-hover:text-[#f85149]" /> Escalations
                </Link>
                <Link href="/sla" className="flex items-center gap-3 px-6 py-2.5 text-[#8b949e] hover:text-[#c9d1d9] t-glow transition-all group">
                  <Activity className="w-4 h-4 group-hover:text-[#3fb950]" /> SLA Monitor
                </Link>
                <div className="my-2 border-b border-[#30363d] mx-4"></div>
                <Link href="/analytics" className="flex items-center gap-3 px-6 py-2.5 text-[#8b949e] hover:text-[#c9d1d9] t-glow transition-all group">
                  <BarChart3 className="w-4 h-4 group-hover:text-[#ff7b72]" /> Analytics
                </Link>
              </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto bg-[#0d1117] p-6 lg:p-8">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}


