import React from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { TrendingUp } from 'lucide-react';

export function PnLChart({ data }: { data: any[] }) {
  const latestValue = data.length > 0 ? data[data.length - 1].value : 0;
  const isPositive = latestValue >= 0;

  return (
    <div className="bg-slate-900/30 border border-slate-800 rounded-lg p-4 flex flex-col h-full bg-gradient-to-b from-transparent to-black/20">
      <div className="flex items-center justify-between mb-2 shrink-0">
        <h3 className="text-xs font-bold uppercase flex items-center gap-2 text-slate-400">
          <TrendingUp className="w-4 h-4 text-emerald-500" /> Cumulative PnL
        </h3>
        <span className={`text-sm font-mono font-bold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
          {isPositive ? '+' : ''}{latestValue.toFixed(2)}
        </span>
      </div>
      <div className="flex-1 w-full text-[10px]">
        {data.length < 2 ? (
           <div className="h-full flex items-center justify-center text-slate-600 font-mono animate-pulse">Collecting ticks...</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={isPositive ? '#10b981' : '#f43f5e'} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={isPositive ? '#10b981' : '#f43f5e'} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <Tooltip 
                 contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '4px', fontSize: '10px' }}
              />
              <YAxis hide domain={['auto', 'auto']} />
              <Area 
                type="monotone" 
                dataKey="value" 
                stroke={isPositive ? '#10b981' : '#f43f5e'} 
                fillOpacity={1} 
                fill="url(#colorValue)" 
                strokeWidth={2}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
