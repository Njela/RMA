import { notFound } from "next/navigation";
import { trackFetch } from "@/lib/api";
import { Package, Clock, CheckCircle2, Download, AlertCircle, Wrench, ClipboardList } from "lucide-react";
import { clsx } from "clsx";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Track({ params }: { params: { token: string } }) {
  const t = await trackFetch(params.token);
  if (!t) notFound();
  
  return (
    <div className="max-w-4xl mx-auto space-y-8 mt-4 font-mono text-[#e5e5e5]">
      <div className="border-b border-[#404040] pb-4">
        <h1 className="text-xl font-bold tracking-widest uppercase text-white mb-2">{">"} {t.status_label}</h1>
        <p className="text-[#a0a0a0]">Bookmark this page: it is the only way to follow your claim. Refresh to see updates.</p>
      </div>
        
      <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
        <div className="md:col-span-3">
          <section className="border border-[#404040] p-6 bg-[#1a1a1a]">
            <h2 className="text-[#a0a0a0] mb-6 tracking-widest">PROGRESS</h2>
            <div className="space-y-6 relative border-l border-[#404040] ml-3 pb-2">
              {t.timeline.map((s, i) => {
                const isLatest = i === t.timeline.length - 1;
                return (
                  <div key={i} className="relative pl-8">
                    <span className={clsx(
                      "absolute -left-[9px] top-1 w-4 h-4 rounded-full flex items-center justify-center border border-[#1a1a1a]",
                      isLatest ? "bg-blue-500" : "bg-[#404040]"
                    )}></span>
                    <div className="flex flex-col">
                      <strong className={clsx("text-base font-normal tracking-wide", isLatest ? "text-white" : "text-[#a0a0a0]")}>
                        {s.label}
                      </strong>
                      <span className="text-sm text-[#606060] mt-1">
                        {new Date(s.at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
        
        <div className="md:col-span-2">
          <section className="border border-[#404040] p-6 bg-[#1a1a1a] sticky top-6">
            <h2 className="text-[#a0a0a0] mb-6 tracking-widest">YOUR RETURN</h2>
            {t.rma_number ? (
              <dl className="space-y-6">
                <div>
                  <dt className="text-[#606060] mb-1 text-sm">RMA NUMBER</dt>
                  <dd className="text-white text-lg">{t.rma_number}</dd>
                </div>
                <div>
                  <dt className="text-[#8b949e] mb-2 text-sm">RETURN LABEL</dt>
                  <dd>
                    {t.label_url ? (
                      <a href={t.label_url} className="inline-flex items-center gap-2 px-4 py-2 border border-[#58a6ff] text-[#58a6ff] hover:bg-[#58a6ff] hover:text-[#0d1117] transition-all uppercase text-sm font-bold shadow-[0_0_10px_rgba(88,166,255,0.2)] hover:shadow-[0_0_15px_rgba(88,166,255,0.6)]">
                        <Download className="w-4 h-4" /> [ Download ]
                      </a>
                    ) : (
                      <span className="text-[#8b949e] italic">Not ready yet</span>
                    )}
                  </dd>
                </div>
              </dl>
            ) : (
              <div className="p-6 text-center border border-dashed border-[#404040]">
                <p className="text-[#a0a0a0] text-sm">
                  An RMA number will appear here as soon as your claim is approved.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
