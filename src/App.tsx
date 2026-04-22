import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from './components/ui/table';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { AlertCircle, TrendingUp, TrendingDown, Clock, PieChart, ShieldAlert, CheckCircle2, Zap, Settings2 } from 'lucide-react';
import { io } from 'socket.io-client';
import { Slider } from './components/ui/slider';

// A mock candidate stock pool representing the broader market scan
const CANDIDATE_POOL = [
  { code: 'sz002594', name: '比亚迪', rsi: 25, maRatio: 1.05, volRatio: 1.8 },
  { code: 'sh601919', name: '中远海控', rsi: 28, maRatio: 1.02, volRatio: 2.1 },
  { code: 'sz300750', name: '宁德时代', rsi: 45, maRatio: 0.98, volRatio: 1.1 },
  { code: 'sh601318', name: '中国平安', rsi: 15, maRatio: 1.01, volRatio: 3.5 },
  { code: 'sz000858', name: '五粮液', rsi: 35, maRatio: 1.08, volRatio: 1.4 },
  { code: 'sh600036', name: '招商银行', rsi: 22, maRatio: 1.03, volRatio: 2.0 },
  { code: 'sz002415', name: '海康威视', rsi: 19, maRatio: 1.06, volRatio: 2.5 },
];

export default function App() {
  const [marketTemp, setMarketTemp] = useState(65);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [myHoldings, setMyHoldings] = useState<any[]>([
    { id: 1, code: 'sh600519', name: '贵州茅台', buyPrice: 1680.0, units: 100, trailingStop: 1650 },
    { id: 2, code: 'sz300750', name: '宁德时代', buyPrice: 190.5, units: 500, trailingStop: 185 },
  ]);
  const [newTrade, setNewTrade] = useState({ code: '', name: '', buyPrice: '', units: '', atr: '' });
  
  // Strategy filtering parameters
  const [strategyParams, setStrategyParams] = useState({
    rsiThreshold: 30, // Buy if RSI <= 30
    maPeriod: 20, // MA standard period
    volumeTrigger: 1.5 // Buy if Volume >= 1.5x average
  });

  // Simulated historical for win-rate
  const winRateData = [
    { name: 'Jan', rate: 45, equity: 100 },
    { name: 'Feb', rate: 48, equity: 105 },
    { name: 'Mar', rate: 52, equity: 112 },
    { name: 'Apr', rate: 60, equity: 125 },
  ];

  // System suggestions
  const [suggestions, setSuggestions] = useState<any[]>([]);

  // Update suggestions whenever params change
  useEffect(() => {
    const timeNow = new Date().toLocaleTimeString('en-US', { hour12: false });
    const filtered = CANDIDATE_POOL.filter(stock => 
      stock.rsi <= strategyParams.rsiThreshold &&
      stock.maRatio > 1.0 && // Requires price > MA
      stock.volRatio >= strategyParams.volumeTrigger
    );

    setSuggestions(
      filtered.map((stock, i) => ({
        id: Date.now() + i,
        type: 'BUY',
        time: timeNow,
        code: stock.code,
        name: stock.name,
        logic: `RSI(${stock.rsi})超卖 + 放量(${stock.volRatio}x) + MA${strategyParams.maPeriod}支撑`,
        risk: (1 + Math.random() * 2).toFixed(1) + '%'
      }))
    );
  }, [strategyParams.rsiThreshold, strategyParams.maPeriod, strategyParams.volumeTrigger]);

  const [socket, setSocket] = useState<any>(null);

  useEffect(() => {
    // Only connect if we're not running in SSR/build
    if (typeof window !== 'undefined') {
      const s = io();
      setSocket(s);
      s.on('quotes', (data: any) => {
        setQuotes(data);
      });
      return () => {
        s.disconnect();
      };
    }
  }, []);

  // Update logic on holdings based on real-time quotes
  const holdingsWithAdvice = myHoldings.map(h => {
    const q = quotes.find(q => q.code === h.code);
    if (!q) return { ...h, currentPrice: h.buyPrice, pnlPercent: 0, advice: 'WAIT' };
    
    const pnl = q.price - h.buyPrice;
    const pnlPercent = (pnl / h.buyPrice) * 100;
    
    let advice = 'HOLD';
    let newStop = h.trailingStop;
    
    // Trailing stop logic
    if (pnlPercent > 5) {
      const potentialStop = q.price - (q.atr || q.price * 0.03); // use hardcoded 3% if no ATR
      if (potentialStop > h.trailingStop) {
        newStop = potentialStop;
        advice = 'RAISE_STOP';
      }
    }
    
    if (q.price <= h.trailingStop) {
      advice = 'SELL_STOP_LOSS';
    }

    return { ...h, currentPrice: q.price, pnlPercent, advice, newStop };
  });

  const handleAddTrade = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTrade.code || !newTrade.buyPrice || !newTrade.units) return;
    
    const tradeUnits = parseInt(newTrade.units);
    const existingIdx = myHoldings.findIndex(h => h.code === newTrade.code);

    if (tradeUnits < 0) {
      // Selling logic
      if (existingIdx !== -1) {
        const h = myHoldings[existingIdx];
        const newUnits = h.units + tradeUnits;
        if (newUnits <= 0) {
          // Remove holding entirely
          setMyHoldings(myHoldings.filter((_, i) => i !== existingIdx));
        } else {
          // Reduce holding
          const updated = [...myHoldings];
          updated[existingIdx] = { ...h, units: newUnits };
          setMyHoldings(updated);
        }
      }
    } else {
      // Buying logic
      if (existingIdx !== -1) {
        // Average down/up existing position
        alert("Holding already exists, adding to it is not fully implemented in demo, creating standalone slot.");
      }
      
      setMyHoldings([...myHoldings, {
        id: Date.now(),
        code: newTrade.code,
        name: newTrade.name || newTrade.code,
        buyPrice: parseFloat(newTrade.buyPrice),
        units: tradeUnits,
        trailingStop: parseFloat(newTrade.buyPrice) * 0.95 // Default 5% stop
      }]);
    }
    
    if (socket) {
      socket.emit("subscribe", newTrade.code);
    }
    
    setNewTrade({ code: '', name: '', buyPrice: '', units: '', atr: '' });
  };

  // Generate SELL signals for holdings that have hit their stop loss
  const sellSignals = holdingsWithAdvice
    .filter(h => h.advice === 'SELL_STOP_LOSS')
    .map(h => ({
      id: `sell-${h.id}`,
      type: 'SELL',
      time: '实时 (Live)',
      code: h.code,
      name: h.name,
      logic: `触发止损: 现价 ${h.currentPrice.toFixed(2)} 已跌破保护线 ${h.newStop.toFixed(2)}`,
      risk: 'HIGH - 建议立刻平仓'
    }));

  const allSignals = [...sellSignals, ...suggestions];

  return (
    <div className="flex h-screen w-full flex-col p-4 space-y-4 bg-slate-950 text-slate-50 font-sans overflow-hidden">
      <header className="flex items-center justify-between glass-card p-4 h-16 shrink-0">
        <div className="flex items-center space-x-4">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center shadow-lg shadow-blue-500/20">
            <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full"></div>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            A-Quant <span className="font-thin text-slate-400">v4.2 PRO</span>
          </h1>
        </div>
        
        <div className="flex space-x-6 text-sm">
          <div className="flex flex-col items-end">
            <span className="text-slate-400 text-xs">上证指数 (SSE)</span>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-profit">3,074.32 +0.42%</span>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-slate-400 text-xs">沪深300 (CSI300)</span>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-loss">3,521.18 -0.15%</span>
            </div>
          </div>
          <div className="h-full border-r border-slate-700"></div>
          <div className="flex flex-col justify-center gap-1">
            <span className="text-slate-200 font-mono text-xs text-right">09:30:14</span>
            <span className="status-pill bg-emerald-500/10 text-emerald-500 text-center">
              交易中 (Live)
            </span>
          </div>
        </div>
      </header>

      <main className="flex flex-1 gap-4 overflow-hidden mb-2">
        
        {/* Left Column: Market & Signals */}
        <aside className="w-80 flex flex-col space-y-4 shrink-0 h-full overflow-y-auto pr-2" style={{ scrollbarWidth: 'none' }}>
          {/* Market Temperature Panel */}
          <div className="glass-card flex flex-col p-4 shrink-0">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">市场温度计</h2>
            <div className="relative h-32 w-full flex flex-col items-center justify-center">
              <div className={`text-4xl font-black ${marketTemp > 60 ? 'text-loss' : marketTemp < 40 ? 'text-profit' : 'text-amber-500'}`}>
                {marketTemp}°
              </div>
              <div className="text-xs text-slate-500 mt-1">情绪状态：{marketTemp > 60 ? '过热' : marketTemp < 40 ? '冰点' : '活跃'}</div>
              <div className="mt-4 w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500 transition-all duration-1000"
                  style={{ width: marketTemp + '%' }}
                ></div>
              </div>
            </div>
            <div className="mt-6 space-y-3">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">连板天数最高</span>
                <span className="text-white">4天</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">涨跌比</span>
                <span><span className="text-profit">2,840</span> / <span className="text-loss">1,912</span></span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">昨日换手</span>
                <span className="text-white font-mono">8,402亿</span>
              </div>
            </div>
          </div>

          {/* Interactive Strategy Engine Filter */}
          <div className="glass-card flex flex-col p-4 bg-slate-900/50 shrink-0">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-blue-500" />
              Engine Parameters
            </h3>
            
            <div className="space-y-5">
              {/* RSI Parameter */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">RSI Threshold (Under)</span>
                  <span className="text-white font-mono">{strategyParams.rsiThreshold}</span>
                </div>
                <Slider 
                  value={[strategyParams.rsiThreshold]} 
                  max={50} min={10} step={1}
                  onValueChange={(val) => setStrategyParams({...strategyParams, rsiThreshold: val[0]})}
                  className="w-full"
                />
              </div>

              {/* Volume Multiplier */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Volume Multiplier (x)</span>
                  <span className="text-white font-mono">{strategyParams.volumeTrigger.toFixed(1)}x</span>
                </div>
                <Slider 
                  value={[strategyParams.volumeTrigger]} 
                  max={4.0} min={1.0} step={0.1}
                  onValueChange={(val) => setStrategyParams({...strategyParams, volumeTrigger: val[0]})}
                  className="w-full"
                />
              </div>

              {/* MA Period */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Moving Average Period</span>
                  <span className="text-white font-mono">MA{strategyParams.maPeriod}</span>
                </div>
                <Slider 
                  value={[strategyParams.maPeriod]} 
                  max={60} min={5} step={5}
                  onValueChange={(val) => setStrategyParams({...strategyParams, maPeriod: val[0]})}
                  className="w-full"
                />
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800 text-[10px] text-slate-500 text-center">
              Candidate Pool Updates Instantly
            </div>
          </div>

          {/* System Signals */}
          <div className="glass-card flex flex-col p-0 overflow-hidden shrink-0 max-h-[400px]">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/30">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                实时决策引擎
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {allSignals.map(s => {
                  const isSell = s.type === 'SELL';
                  return (
                  <div key={s.id} className={`flex items-start gap-4 p-3 border-l-4 ${isSell ? 'border-loss bg-rose-500/5' : 'border-profit bg-emerald-500/5'} rounded-r-lg mb-3`}>
                    <div className="flex flex-col">
                      <span className="text-xs font-mono text-slate-500">{s.time}</span>
                      <span className={`font-bold ${isSell ? 'text-loss' : 'text-profit'}`}>{s.type === 'BUY' ? '买入建议 (BUY)' : '止损平仓 (SELL)'}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <span className="font-bold text-slate-50">{s.name} ({s.code})</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">系统评级：风险 {s.risk}</p>
                      <p className={`text-[10px] font-mono mt-1 opacity-80 ${isSell ? 'text-rose-400' : 'text-emerald-400'}`}>{s.logic}</p>
                    </div>
                    <div className="text-right flex items-center h-full">
                      <button 
                        className={`${isSell ? 'bg-rose-600/20 text-rose-400 border-rose-500/30 hover:bg-rose-600/40' : 'bg-blue-600/20 text-blue-400 border-blue-500/30 hover:bg-blue-600/40'} border px-3 py-1 rounded text-xs transition-colors`}
                        onClick={() => {
                          let fillUnits = '';
                          if (isSell) {
                            const holding = myHoldings.find(h => h.code === s.code);
                            fillUnits = holding ? `-${holding.units}` : '';
                          }
                          
                          setNewTrade(prev => ({ 
                            ...prev, 
                            code: s.code, 
                            name: s.name,
                            units: fillUnits
                          }))
                        }}
                      >
                        Auto-fill
                      </button>
                    </div>
                  </div>
                )})}
                {allSignals.length === 0 && (
                  <div className="p-6 text-center text-[10px] text-slate-600 uppercase tracking-widest font-bold">
                    [ No Signals ]
                  </div>
                )}
              </div>
          </div>
          
          {/* Active Quotes List */}
          <div className="glass-card flex flex-col p-4 shrink-0">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Market Pulse</h3>
            <Table>
              <TableBody>
                {quotes.slice(0, 5).map(q => (
                  <TableRow key={q.code} className="border-slate-800/50 hover:bg-slate-800/30">
                    <TableCell className="py-2 text-xs font-medium text-slate-200">{q.name}</TableCell>
                    <TableCell className="py-2 text-right font-mono text-xs text-slate-300">
                      {q.price.toFixed(2)}
                    </TableCell>
                    <TableCell className={`py-2 text-right font-mono text-xs ${q.change >= 0 ? 'text-profit' : 'text-loss'}`}>
                      {q.change >= 0 ? '+' : ''}{q.changePercent}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </aside>

        {/* Middle Column: Current Positions & Advice */}
        <div className="flex-1 flex flex-col space-y-4 overflow-hidden">
          <div className="glass-card h-full flex flex-col p-0 overflow-hidden">
            <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-500" />
                Active Portfolio & Dynamic Advice
              </h3>
            </div>
            <div className="p-4 flex-1">
              <div className="space-y-4 overflow-y-auto">
                {holdingsWithAdvice.map(h => (
                  <div key={h.id} className="p-4 rounded-lg glass-card flex items-center justify-between transition-all hover:bg-slate-800/30 mb-3 shrink-0">
                    <div className="flex-1">
                      <div className="font-bold text-white">{h.name}</div>
                      <div className="text-slate-500 text-[10px] font-mono">{h.code}</div>
                      <div className="mt-1 text-xs text-slate-400 font-mono">Buy: {h.buyPrice.toFixed(2)} &nbsp;&bull;&nbsp; Units: {h.units}</div>
                    </div>
                    
                    <div className="w-1/4 text-right">
                      <div className="font-mono text-white text-sm">{h.currentPrice.toFixed(2)}</div>
                      <div className={`font-mono text-xs ${h.pnlPercent >= 0 ? 'text-profit' : 'text-loss'}`}>
                        {h.pnlPercent >= 0 ? '+' : ''}{h.pnlPercent.toFixed(2)}%
                      </div>
                    </div>

                    <div className="w-1/4 text-center">
                      <div className="text-slate-400 font-mono text-xs">{h.newStop.toFixed(2)}</div>
                      <div className="text-[10px] text-slate-500 uppercase">Protection Line</div>
                    </div>

                    <div className="w-1/4 text-right">
                      {h.advice === 'SELL_STOP_LOSS' ? (
                        <span className="text-rose-400 text-xs font-bold flex items-center justify-end gap-1"><ShieldAlert className="w-3 h-3" /> 止损平仓</span>
                      ) : h.advice === 'RAISE_STOP' ? (
                        <span className="text-emerald-400 text-xs font-bold flex items-center justify-end gap-1"><TrendingUp className="w-3 h-3" /> 动态止盈</span>
                      ) : (
                        <span className="text-blue-400 text-xs font-bold flex items-center justify-end gap-1"><Clock className="w-3 h-3" /> 持股待涨</span>
                      )}
                    </div>
                  </div>
                ))}
                
                {holdingsWithAdvice.length === 0 && (
                  <div className="text-center py-12 text-slate-500">
                    <p>No active positions.</p>
                    <p className="text-sm mt-2">Use the right panel to record a trade or wait for system signals.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Add Trade & Logs */}
        <aside className="w-1/4 flex flex-col space-y-4 shrink-0 min-w-72">
          <div className="glass-card p-4 shrink-0">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Record Execution</h3>
            <form onSubmit={handleAddTrade} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase text-slate-500 font-bold">Code</Label>
                  <Input 
                    className="font-mono text-sm h-8 bg-slate-900 border-slate-700 text-slate-200" 
                    placeholder="sh600519" 
                    value={newTrade.code}
                    onChange={e => setNewTrade({...newTrade, code: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase text-slate-500 font-bold">Name</Label>
                  <Input 
                    className="text-sm h-8 bg-slate-900 border-slate-700 text-slate-200" 
                    placeholder="贵州茅台"
                    value={newTrade.name}
                    onChange={e => setNewTrade({...newTrade, name: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase text-slate-500 font-bold">Fill Price</Label>
                  <Input 
                    className="font-mono text-sm h-8 bg-slate-900 border-slate-700 text-slate-200" 
                    type="number" step="0.01" 
                    value={newTrade.buyPrice}
                    onChange={e => setNewTrade({...newTrade, buyPrice: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase text-slate-500 font-bold">Units / Shrs</Label>
                  <Input 
                    className="font-mono text-sm h-8 bg-slate-900 border-slate-700 text-slate-200" 
                    type="number" 
                    value={newTrade.units}
                    onChange={e => setNewTrade({...newTrade, units: e.target.value})}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full text-xs h-9 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/20 border-0">Sync to System</Button>
            </form>
          </div>

          {/* System Logs */}
          <div className="glass-card flex-1 flex flex-col overflow-hidden">
            <div className="p-3 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between shrink-0">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">System Terminal</h3>
            </div>
            <div className="bg-black/80 text-[#0f0] font-mono text-[10px] p-4 flex-1 overflow-y-auto leading-relaxed">
              <div>&gt; [16:00:01] Data scrubbing initiated...</div>
              <div>&gt; [16:01:45] ATR calculation [PASS]</div>
              <div>&gt; [16:05:00] Identifying momentum anomalies...</div>
              <div>&gt; [16:05:12] Found 3 ST stocks in pool. Filtering...</div>
              <div>&gt; [16:06:01] sz002594 RS rating &gt; 90. Triggering deeper scan.</div>
              <div>&gt; [16:06:45] Signal Generated: sz002594 (BUY)</div>
              <div>&gt; [SYSTEM] Awaiting market open...</div>
              <div className="animate-pulse mt-2">_</div>
            </div>
          </div>
        </aside>

      </main>
      <footer className="h-8 flex items-center justify-between px-4 text-[10px] text-slate-500 border-t border-slate-800/50 mt-auto shrink-0">
        <div className="flex space-x-4 uppercase font-semibold tracking-tighter">
          <span>PostgreSQL: Connected</span>
          <span className="text-emerald-500">Tushare API: Active</span>
          <span>Task: Daily_Data_Refresh (Wait)</span>
        </div>
        <div>
          &copy; 2026 AI-Quant Systems Group. Powered by Vectorized Python 3.11
        </div>
      </footer>
    </div>
  );
}
