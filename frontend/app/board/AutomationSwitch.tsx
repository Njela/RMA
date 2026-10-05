"use client";
import { useState } from "react";
import { clsx } from "clsx";
import { Cpu } from "lucide-react";

export default function AutomationSwitch() {
  const [level, setLevel] = useState<"off" | "suggest" | "auto">("auto");
  const [pendingLevel, setPendingLevel] = useState<"off" | "suggest" | "auto" | null>(null);

  const handleSelect = (newLevel: "off" | "suggest" | "auto") => {
    if (newLevel === level) return;
    // The user wants a "confirmation step. This is your kill switch, so it should be one click away."
    setPendingLevel(newLevel);
  };

  const confirm = () => {
    if (pendingLevel) {
      setLevel(pendingLevel);
      setPendingLevel(null);
    }
  };

  const cancel = () => {
    setPendingLevel(null);
  };

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-4 bg-[#161b22] border border-[#30363d] p-1 rounded-sm">
        <div className="text-xs text-[#8b949e] font-bold px-2 flex items-center gap-2"><Cpu className="w-4 h-4"/> AUTOPILOT</div>
        <div className="flex bg-[#0d1117] border border-[#30363d]">
          <button 
            onClick={() => handleSelect("off")}
            className={clsx("px-4 py-1 text-xs font-bold transition-all", 
              level === "off" ? "bg-[#f85149] text-white shadow-[0_0_10px_rgba(248,81,73,0.4)]" : "text-[#8b949e] hover:bg-[#f85149]/20 hover:text-white"
            )}>
            OFF
          </button>
          <button 
            onClick={() => handleSelect("suggest")}
            className={clsx("px-4 py-1 text-xs font-bold transition-all border-x border-[#30363d]", 
              level === "suggest" ? "bg-[#d29922] text-[#0d1117] shadow-[0_0_10px_rgba(210,153,34,0.4)]" : "text-[#8b949e] hover:bg-[#d29922]/20 hover:text-white"
            )}>
            SUGGEST
          </button>
          <button 
            onClick={() => handleSelect("auto")}
            className={clsx("px-4 py-1 text-xs font-bold transition-all", 
              level === "auto" ? "bg-[#3fb950] text-[#0d1117] shadow-[0_0_10px_rgba(63,185,80,0.4)]" : "text-[#8b949e] hover:bg-[#3fb950]/20 hover:text-white"
            )}>
            AUTO
          </button>
        </div>
      </div>

      {pendingLevel && (
        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4">
          <span className="text-xs text-[#c9d1d9]">Confirm switch to <span className="font-bold uppercase text-white">{pendingLevel}</span>?</span>
          <button onClick={confirm} className="px-2 py-1 bg-[#3fb950] text-[#0d1117] text-xs font-bold rounded-sm">Confirm</button>
          <button onClick={cancel} className="px-2 py-1 bg-[#30363d] text-[#e5e5e5] text-xs font-bold rounded-sm hover:bg-[#404040]">Cancel</button>
        </div>
      )}
    </div>
  );
}
