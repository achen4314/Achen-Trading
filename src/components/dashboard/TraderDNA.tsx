import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { Activity } from 'lucide-react';

const data = [
  { subject: 'Win Rate', A: 85, fullMark: 100 },
  { subject: 'R:R Ratio', A: 70, fullMark: 100 },
  { subject: 'Momentum', A: 90, fullMark: 100 },
  { subject: 'Mean Revert', A: 60, fullMark: 100 },
  { subject: 'Hold Time', A: 40, fullMark: 100 },
  { subject: 'Conviction', A: 88, fullMark: 100 },
];

export function TraderDNA() {
  return (
    <div className="bg-slate-900/30 border border-slate-800 rounded-lg p-4 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <h3 className="text-xs font-bold uppercase flex items-center gap-2 text-slate-400">
          <Activity className="w-4 h-4 text-purple-500" /> System DNA
        </h3>
        <span className="text-[9px] font-mono text-purple-500/80 bg-purple-500/10 px-2 py-0.5 rounded">Multi-Factor Engine</span>
      </div>
      <div className="flex-1 w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
            <PolarGrid stroke="#334155" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 9 }} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
            <Radar name="Trader DNA" dataKey="A" stroke="#a855f7" strokeWidth={2} fill="#a855f7" fillOpacity={0.3} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
