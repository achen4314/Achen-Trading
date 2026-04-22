import React from 'react';
import { Layers } from 'lucide-react';

export function ConvictionHeatmap({ quotes }: { quotes: any[] }) {
  // Sort quotes by convection (proxy: changePercent magnitude)
  const sorted = [...quotes].sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));

  return (
    <div className="bg-slate-900/30 border border-slate-800 rounded-lg p-4 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <h3 className="text-xs font-bold uppercase flex items-center gap-2 text-slate-400">
          <Layers className="w-4 h-4 text-orange-500" /> Conviction Heatmap
        </h3>
        <span className="text-[9px] font-mono text-orange-500/80 bg-orange-500/10 px-2 py-0.5 rounded">Pixel Grid</span>
      </div>
      
      <div className="flex-1 w-full grid grid-cols-4 gap-1 auto-rows-fr">
         {sorted.map(q => {
           let bgClass = "bg-slate-800";
           let opacityClass = "opacity-50";
           const absC = Math.abs(q.changePercent);
           
           if (absC > 3) opacityClass = "opacity-100 font-bold";
           else if (absC > 1) opacityClass = "opacity-80";
           else opacityClass = "opacity-40";

           if (q.changePercent > 0) bgClass = "bg-red-500";
           else if (q.changePercent < 0) bgClass = "bg-green-500";

           return (
             <div 
                key={q.code} 
                className={`${bgClass} ${opacityClass} rounded flex flex-col justify-center items-center transition-all hover:scale-105 cursor-crosshair overflow-hidden p-1`}
                title={`${q.name}: ${q.changePercent}%`}
             >
               <span className="text-[10px] text-white/90 truncate w-full text-center">{q.name.substring(0,2)}</span>
               <span className="text-[8px] font-mono text-white/70">{q.changePercent > 0 ? '+' : ''}{q.changePercent.toFixed(1)}</span>
             </div>
           )
         })}
      </div>
    </div>
  );
}
