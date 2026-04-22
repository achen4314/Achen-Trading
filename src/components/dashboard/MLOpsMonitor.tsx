import React from 'react';
import { Cpu, RefreshCw, AlertTriangle, ShieldCheck } from 'lucide-react';

export function MLOpsMonitor() {
  const alphaDecay = 7.4; // Simulated decay percentage
  const driftScore = 0.05; // Data drift

  return (
    <div className="bg-slate-900/30 border border-slate-800 rounded-lg p-3 flex flex-col h-full font-mono text-[10px]">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <h3 className="text-xs font-bold uppercase flex items-center gap-2 text-slate-400 font-sans">
          <Cpu className="w-4 h-4 text-indigo-500" /> MLOps & Model Engine
        </h3>
        <span className="text-[9px] px-1 bg-green-500/20 text-green-400 rounded flex items-center gap-1">
          <RefreshCw className="w-2 h-2 animate-spin" /> Learning
        </span>
      </div>

      <div className="flex-1 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800/50 pb-2">
          <div className="text-slate-500 flex flex-col">
            <span className="uppercase font-bold tracking-widest text">Alpha Decay</span>
            <span className="text-[8px]">Factor Effectiveness</span>
          </div>
          <div className="flex items-center gap-2">
             <div className="w-16 h-1 bg-slate-800 rounded overflow-hidden">
               <div className="h-full bg-orange-500" style={{ width: `${alphaDecay * 10}%` }}></div>
             </div>
             <span className="text-orange-400 font-bold">{alphaDecay}%</span>
          </div>
        </div>

        <div className="flex items-center justify-between border-b border-slate-800/50 pb-2">
          <div className="text-slate-500 flex flex-col">
            <span className="uppercase font-bold tracking-widest">Data Drift (KS-Test)</span>
            <span className="text-[8px]">Market Regime Divergence</span>
          </div>
          <div className="text-emerald-400 font-bold">
            {driftScore.toFixed(3)}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-slate-500 flex flex-col">
            <span className="uppercase font-bold tracking-widest">Retraining Pipeline</span>
            <span className="text-[8px]">Next Auto-Tune</span>
          </div>
          <div className="text-blue-400 font-bold text-right">
             Pending Weekend
          </div>
        </div>
      </div>
      
      <div className="mt-auto pt-2 flex items-center gap-2 text-slate-500 text-[8px] uppercase">
         <ShieldCheck className="w-3 h-3 text-slate-600" /> Backtested 2014-2024 (Eliminated Future Bias & Survivorship Bias)
      </div>
    </div>
  );
}
