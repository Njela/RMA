"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PUBLIC_API } from "@/lib/api";
import { AlertCircle, CheckCircle2, ArrowRight, Package, Wrench, ClipboardList, Send } from "lucide-react";
import { clsx } from "clsx";
import Link from "next/link";

type Check = { found: boolean; in_warranty: boolean | null; warranty_expires_on: string | null };

export default function ClaimForm() {
  const router = useRouter();
  const idempotencyKey = useRef(crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serialHint, setSerialHint] = useState<{ tone: "ok" | "no"; text: string } | null>(null);

  async function checkSerial(value: string) {
    const serial = value.trim();
    if (serial.length < 6) return setSerialHint(null);
    try {
      const r = await fetch(`${PUBLIC_API}/api/serials/${encodeURIComponent(serial)}/warranty`);
      const c = (await r.json()) as Check;
      if (!c.found) return setSerialHint({ tone: "no", text: "We can't find that serial number. Check it, or submit anyway and our team will look." });
      setSerialHint(c.in_warranty
        ? { tone: "ok", text: `Serial found. Warranty valid until ${c.warranty_expires_on}.` }
        : { tone: "no", text: `Serial found, but warranty ended on ${c.warranty_expires_on}. We can still quote a paid repair.` });
    } catch { setSerialHint(null); }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setError(null);
    const f = new FormData(e.currentTarget);
    try {
      const r = await fetch(`${PUBLIC_API}/api/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey.current },
        body: JSON.stringify({
          customer_name: f.get("name"), customer_email: f.get("email"), description: f.get("description"),
          serial_number: String(f.get("serial") ?? "").trim() || null, preferred_resolution: f.get("resolution"),
        }),
      });
      if (r.status === 429) throw new Error("Too many attempts. Wait a minute and try again.");
      if (!r.ok) throw new Error("Please check the form: every field except the serial number is required, and the description needs at least 10 characters.");
      const { public_token } = await r.json();
      router.push(`/track/${public_token}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto mt-4 font-mono text-[#e5e5e5]">
      <div className="mb-8 border-b border-[#404040] pb-4">
        <h1 className="text-xl font-bold tracking-widest uppercase text-white mb-2">{">"} Report a faulty product</h1>
        <p className="text-[#a0a0a0]">Tell us what happened. If your product is in warranty and the claim is clear, you get a return label straight away.</p>
      </div>

      <form className="space-y-6" onSubmit={submit}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label htmlFor="name" className="block text-sm text-[#a0a0a0]">Your name</label>
            <input id="name" name="name" required minLength={2} className="w-full px-4 py-2 bg-[#1a1a1a] border border-[#404040] focus:border-white focus:outline-none transition-colors text-white" />
          </div>
          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm text-[#a0a0a0]">Email address</label>
            <input id="email" name="email" type="email" required className="w-full px-4 py-2 bg-[#1a1a1a] border border-[#404040] focus:border-white focus:outline-none transition-colors text-white" />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="serial" className="block text-sm text-[#a0a0a0]">Serial number <span className="text-[#606060]">(Optional)</span></label>
          <input id="serial" name="serial" className="w-full px-4 py-2 bg-[#1a1a1a] border border-[#404040] focus:border-white focus:outline-none transition-colors text-white placeholder:text-[#404040]" onBlur={(e) => checkSerial(e.target.value)} placeholder="Printed on the label under the device" />
          {serialHint && (
            <div className={clsx("flex items-start gap-2 text-sm mt-2", serialHint.tone === "ok" ? "text-emerald-500" : "text-amber-500")}>
              <span>{serialHint.text}</span>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="description" className="block text-sm text-[#a0a0a0]">What is wrong?</label>
          <textarea id="description" name="description" required minLength={10} maxLength={5000} className="w-full px-4 py-3 bg-[#1a1a1a] border border-[#404040] focus:border-white focus:outline-none transition-colors text-white min-h-[140px] resize-y" />
        </div>

        <div className="space-y-3 border border-[#404040] p-4">
          <label className="block text-sm text-[#a0a0a0] mb-2">What would you like?</label>
          <div className="flex flex-wrap gap-6">
            {["repair", "replace", "refund"].map((v, i) => (
              <label key={v} className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="resolution" value={v} defaultChecked={i === 0} className="text-blue-500 bg-[#1a1a1a] border-[#404040] focus:ring-0" />
                <span className="uppercase tracking-wide">{v}</span>
              </label>
            ))}
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-3 p-4 border border-[#f85149] bg-[#f85149]/10 text-[#f85149]" role="alert">
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        <div className="pt-4 flex justify-end">
          <button type="submit" disabled={busy} className="inline-flex items-center gap-2 px-6 py-2 border border-[#3fb950] text-[#3fb950] hover:bg-[#3fb950] hover:text-[#0d1117] transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest font-bold focus:outline-none shadow-[0_0_10px_rgba(63,185,80,0.2)] hover:shadow-[0_0_15px_rgba(63,185,80,0.6)]">
            {busy ? "Sending..." : <><Send className="w-4 h-4" /> [ SUBMIT CLAIM ]</>}
          </button>
        </div>
      </form>
    </div>
  );
}
