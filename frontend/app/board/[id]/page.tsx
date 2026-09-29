import { notFound } from "next/navigation";
import Link from "next/link";
import { staffFetch, TicketDetail } from "@/lib/api";
import { clsx } from "clsx";
import { AlertTriangle, CheckCircle, CornerUpLeft } from "lucide-react";

export const dynamic = "force-dynamic";

function getDotColor(level: number) {
  if (level === 2) return "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]";
  if (level === 1) return "bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]";
  return "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]";
}

function getPriorityText(level: number) {
  if (level === 2) return "P1";
  if (level === 1) return "P2";
  return "P4";
}

export default async function TicketPage({ params }: { params: { id: string } }) {
  let t: TicketDetail;
  try {
    t = await staffFetch<TicketDetail>(`/tickets/${params.id}`);
  } catch (e) {
    notFound();
  }

  const isRma = !!t.route_reason;

  return (
    <div className="flex flex-col h-full text-sm font-mono tracking-wide text-[#e5e5e5] max-w-5xl mx-auto border border-[#30363d] rounded-sm p-4 sm:p-6 bg-[#0d1117] shadow-xl">
      {/* Top Section */}
      <div className="flex flex-col gap-4 border-b border-[#30363d] pb-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/board" className="text-[#8b949e] hover:text-[#58a6ff] transition-colors flex items-center gap-1"><CornerUpLeft className="w-4 h-4" /> Back</Link>
            <span className="text-[#c9d1d9] font-bold">INC-{t.id.toString().slice(0, 5)}</span>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className={clsx("w-3 h-3 rounded-full", getDotColor(t.sla_level))}></div>
              <span className="font-bold text-white">{getPriorityText(t.sla_level)}</span>
            </div>
            <div className="text-[#8b949e]">SLA 18m remaining</div>
            <div className="text-[#30363d]">|</div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-lg text-[#c9d1d9] font-semibold">{(t.route_reason || t.body_raw || "").slice(0, 40)}{(t.route_reason || t.body_raw || "").length > 40 ? "..." : ""}</div>
          <div className="flex gap-4 text-[#8b949e]">
            <form action={async () => {
              "use server";
              await fetch(`${process.env.API_URL ?? "http://localhost:8000"}/api/staff/tickets/${t.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", "X-API-Key": process.env.STAFF_API_KEY ?? "dev-staff-key" },
                body: JSON.stringify({ sla_level: t.sla_level === 2 ? 2 : t.sla_level + 1 })
              });
              const { revalidatePath } = await import("next/cache");
              revalidatePath(`/board/${t.id}`);
            }}>
              <button type="submit" className="flex items-center gap-1 hover:text-[#f85149] transition-colors focus:outline-none hover:drop-shadow-[0_0_5px_rgba(248,81,73,0.5)]">
                <AlertTriangle className="w-4 h-4" /> [ Escalate ]
              </button>
            </form>

            <form action={async () => {
              "use server";
              await fetch(`${process.env.API_URL ?? "http://localhost:8000"}/api/staff/tickets/${t.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", "X-API-Key": process.env.STAFF_API_KEY ?? "dev-staff-key" },
                body: JSON.stringify({ status: "closed" })
              });
              const { revalidatePath } = await import("next/cache");
              revalidatePath(`/board/${t.id}`);
            }}>
              <button type="submit" className="flex items-center gap-1 hover:text-[#3fb950] transition-colors focus:outline-none hover:drop-shadow-[0_0_5px_rgba(63,185,80,0.5)]">
                <CheckCircle className="w-4 h-4" /> [ Close ]
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Unified Status Pipeline */}
      <div className="mb-6 flex flex-col items-center justify-center font-bold tracking-wider text-[#8b949e] border-b border-[#30363d] pb-6">
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-4 text-xs sm:text-sm">
            <div className="flex flex-col items-center gap-2">
              <span className={clsx(t.status === 'new' ? 'text-[#3fb950]' : 'text-[#c9d1d9]')}>[NEW]</span>
              {t.status === 'new' && <div className="w-2 h-2 rounded-full bg-[#3fb950] shadow-[0_0_8px_rgba(63,185,80,0.8)]"></div>}
            </div>
            <span className="mb-4">→</span>
            <div className="flex flex-col items-center gap-2">
              <span className={clsx(t.status === 'human_review' || (!isRma && t.status !== 'closed' && t.status !== 'new') ? 'text-[#58a6ff]' : '')}>[TRIAGE]</span>
              {(t.status === 'human_review' || (!isRma && t.status !== 'closed' && t.status !== 'new')) && <div className="w-2 h-2 rounded-full bg-[#58a6ff] shadow-[0_0_8px_rgba(88,166,255,0.8)]"></div>}
            </div>
            <span className="mb-4">→</span>
            <div className="flex flex-col items-center gap-2">
              <span className={clsx(isRma && !t.rma_number ? 'text-[#58a6ff]' : '')}>[WARRANTY]</span>
              {(isRma && !t.rma_number) && <div className="w-2 h-2 rounded-full bg-[#58a6ff] shadow-[0_0_8px_rgba(88,166,255,0.8)]"></div>}
            </div>
            <span className="mb-4">→</span>
            <div className="flex flex-col items-center gap-2">
              <span className={clsx(isRma && t.rma_number && t.status !== 'closed' && t.status !== 'inspection' ? 'text-[#d29922]' : '')}>[RMA]</span>
              {(isRma && t.rma_number && t.status !== 'closed' && t.status !== 'inspection') && <div className="w-2 h-2 rounded-full bg-[#d29922] shadow-[0_0_8px_rgba(210,153,34,0.8)]"></div>}
            </div>
            <span className="mb-4">→</span>
            <div className="flex flex-col items-center gap-2">
              <span className={clsx(t.status === 'inspection' ? 'text-[#bc8cff]' : '')}>[INSPECTION]</span>
              {t.status === 'inspection' && <div className="w-2 h-2 rounded-full bg-[#bc8cff] shadow-[0_0_8px_rgba(188,140,255,0.8)]"></div>}
            </div>
            <span className="mb-4">→</span>
            <div className="flex flex-col items-center gap-2">
              <span className={clsx(t.status === 'closed' || t.status === 'resolved' ? 'text-[#3fb950]' : '')}>[RESOLUTION]</span>
              {(t.status === 'closed' || t.status === 'resolved') && <div className="w-2 h-2 rounded-full bg-[#3fb950] shadow-[0_0_8px_rgba(63,185,80,0.8)]"></div>}
            </div>
          </div>
        </div>
      </div>

      {/* Three Columns */}
      <div className="flex flex-col md:flex-row gap-6 relative flex-1">
        
        {/* Col 1: Customer */}
        <div className="flex-1 flex flex-col gap-6 relative pr-6">
          <div className="text-[#58a6ff] font-semibold tracking-widest mb-2">CUSTOMER</div>
          
          <div>
            <div className="text-[#c9d1d9]">{t.customer_name ?? t.customer_email.split('@')[0]}</div>
            <div className="text-[#8b949e]">{t.customer_email}</div>
          </div>
          
          <div>
            <div className="text-[#8b949e]">Device</div>
            <div className="text-[#c9d1d9]">Unknown Product</div>
            <div className="text-[#8b949e]">Serial: <span className="text-[#e3b341]">{t.serial_number || "None"}</span></div>
          </div>
          
          <div>
            <div className="text-[#8b949e]">Warranty</div>
            <div className={t.warranty_status === "valid" ? "text-[#3fb950]" : "text-[#f85149]"}>
              {t.warranty_status === "valid" ? "✓ Valid" : t.warranty_status === "expired" ? "✗ Expired" : "? Unknown"}
            </div>
          </div>
          
          <div>
            <div className="text-[#8b949e]">Customer tier</div>
            <div className="text-[#bc8cff]">Enterprise</div>
          </div>

          <div className="absolute top-0 right-0 h-full w-px bg-[#30363d] hidden md:block"></div>
        </div>

        {/* Col 2: Conversation */}
        <div className="flex-[1.5] flex flex-col gap-6 relative pr-6">
          <div className="text-[#58a6ff] font-semibold tracking-widest mb-2">CONVERSATION / ACTIVITY</div>
          
          <div className="flex flex-col gap-2">
            <div className="text-[#8b949e]">Customer</div>
            <div className="pl-4 border-l-2 border-[#ff7b72] text-[#c9d1d9]">
              "{t.body_raw}"
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-[#8b949e]">Agent</div>
            <div className="pl-4 border-l-2 border-[#58a6ff] text-[#c9d1d9]">
              "We are reviewing your claim now..."
            </div>
          </div>

          <hr className="border-[#30363d]" />

          <div>
            <div className="text-[#bc8cff] font-semibold tracking-widest mb-4">AI TRIAGE</div>
            <div className="grid grid-cols-2 gap-y-2 max-w-[200px] text-[#c9d1d9]">
              <div>{t.route_reason || "Hardware Failure"}</div><div className="text-right text-[#3fb950]">96%</div>
              <div>RMA Required</div><div className="text-right text-[#3fb950]">{isRma ? "94%" : "12%"}</div>
              <div>Priority {getPriorityText(t.sla_level)}</div><div className="text-right text-[#3fb950]">87%</div>
            </div>
          </div>

          <div className="mt-auto flex justify-center text-[#8b949e]">
            <div className="w-8 h-8 rounded-full border border-[#30363d] flex items-center justify-center hover:text-white hover:border-[#58a6ff] transition-colors cursor-pointer">↓</div>
          </div>

          <div className="absolute top-0 right-0 h-full w-px bg-[#30363d] hidden md:block"></div>
        </div>

        {/* Col 3: Case + RMA */}
        <div className="flex-1 flex flex-col gap-6">
          <div className="text-[#58a6ff] font-semibold tracking-widest mb-2">CASE + RMA</div>
          
          <div>
            <div className="text-[#8b949e]">CASE STATUS</div>
            <div className="text-[#c9d1d9]">• {t.status.replace("_", " ")}</div>
          </div>
          
          <hr className="border-[#30363d]" />

          {isRma ? (
            <>
              <div>
                <div className="text-[#e3b341]">RMA-{t.id.toString().slice(0,6)}</div>
                <div className="text-[#c9d1d9]">• Pending Review</div>
              </div>
              
              <div>
                <div className="text-[#3fb950]">Warranty ✓</div>
                <div className="text-[#8b949e] mt-2">Return reason</div>
                <div className="text-[#c9d1d9]">{t.route_reason}</div>
              </div>

              <hr className="border-[#30363d]" />

              <div>
                <div className="text-[#8b949e] tracking-widest mb-2">RMA PROGRESS</div>
                <div className="flex flex-col gap-2 font-medium">
                  <div className="text-[#3fb950]">✓ Requested</div>
                  <div className="text-[#8b949e]">o Approved</div>
                  <div className="text-[#8b949e]">o Inspection</div>
                  <div className="text-[#8b949e]">o Replacement</div>
                </div>
              </div>
            </>
          ) : (
            <div>
              <div className="text-[#a0a0a0] italic">No RMA generated for this ticket.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
