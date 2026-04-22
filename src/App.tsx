import React, { useState, useEffect } from 'react';
import { ShieldAlert, TrendingUp, Clock, Activity, CheckCircle2, AlertCircle, Settings2, Zap, ChevronDown, ChevronUp, Layers } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, YAxis, XAxis, Tooltip } from 'recharts';
import { Input } from './components/ui/input';
import { Button } from './components/ui/button';
import { Label } from './components/ui/label';
import { Slider } from './components/ui/slider';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './components/ui/dialog';

import { ConvictionHeatmap } from './components/dashboard/ConvictionHeatmap';
import { LiveFeed } from './components/dashboard/LiveFeed';
import { PnLChart } from './components/dashboard/PnLChart';
import { TraderDNA } from './components/dashboard/TraderDNA';
import { MLOpsMonitor } from './components/dashboard/MLOpsMonitor';

const CANDIDATE_POOL_BASE = [
  { code: 'sz002594', name: '比亚迪', baseMa20: 215.0, avgVol: 20000000, baseRsi: 25 },
  { code: 'sh601919', name: '中远海控', baseMa20: 10.5, avgVol: 50000000, baseRsi: 27 },
  { code: 'sz300750', name: '宁德时代', baseMa20: 180.0, avgVol: 25000000, baseRsi: 45 },
  { code: 'sh601318', name: '中国平安', baseMa20: 44.5, avgVol: 30000000, baseRsi: 15 },
  { code: 'sz000858', name: '五粮液', baseMa20: 148.0, avgVol: 12000000, baseRsi: 35 },
  { code: 'sh600036', name: '招商银行', baseMa20: 32.5, avgVol: 45000000, baseRsi: 22 },
  { code: 'sz002415', name: '海康威视', baseMa20: 31.0, avgVol: 20000000, baseRsi: 19 },
];

export default function App() {
  const [marketIndices, setMarketIndices] = useState<any[]>([]);
  const [advDec, setAdvDec] = useState({ adv: 0, dec: 0 });
  const [breakerActive, setBreakerActive] = useState(false);
  
  const [liveQuotes, setLiveQuotes] = useState<any[]>([]);
  const [quantumSignals, setQuantumSignals] = useState<any[]>([]);
  const [classicSignals, setClassicSignals] = useState<any[]>([]);
  
  const [positions, setPositions] = useState<any[]>([]);
  const [holdingsQuotes, setHoldingsQuotes] = useState<any[]>([]);
  
  // Dashboard & Systems State
  const [systemLogs, setSystemLogs] = useState<any[]>([]);
  const [regime, setRegime] = useState({ state: 'Booting...', probability: 0, color: 'blue' });
  const [pnlHistory, setPnlHistory] = useState<any[]>([{ value: 0 }, { value: 0 }]); // initial flatline
  const [isKillSwitchEngaged, setKillSwitchEngaged] = useState(false);

  // Strategy Params
  const [strategyParams, setStrategyParams] = useState({
    rsiThreshold: 30,
    maPeriod: 20,
    volumeTrigger: 1.5
  });

  // Dialog State
  const [selectedSignal, setSelectedSignal] = useState<any | null>(null);
  const [isBuyDialogOpen, setIsBuyDialogOpen] = useState(false);
  const [tradeDetails, setTradeDetails] = useState({ units: 0, hardStop: 0, buyPrice: 0 });

  // Charts State
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});
  const [histories, setHistories] = useState<Record<string, any[]>>({});

  const toggleRow = async (id: number, code: string) => {
    const isExpanding = !expandedRows[id];
    setExpandedRows(prev => ({ ...prev, [id]: isExpanding }));
    
    if (isExpanding && !histories[code]) {
      try {
        const res = await fetch(`/api/history/${code}`);
        const data = await res.json();
        setHistories(prev => ({ ...prev, [code]: data }));
      } catch (e) {
        console.error("Failed to load history chart for", code, e);
      }
    }
  };

  // Tracking Cumulative PNL Curve & Black Swan Check
  useEffect(() => {
    if (positions.length === 0 || holdingsQuotes.length === 0) return;
    let totalPnl = 0;
    
    // Calculate PnL and simulate total asset value (Mock 1M capital)
    positions.forEach(pos => {
      const q = holdingsQuotes.find(hq => hq.code === pos.code);
      if (q) totalPnl += (q.price - pos.buyPrice) * pos.units;
    });

    const mockInitialCapital = 1000000;
    const currentEquity = mockInitialCapital + totalPnl;
    const drawdownPct = (totalPnl / mockInitialCapital) * 100;
    
    // Global Black Swan threshold (-5.0%)
    if (drawdownPct < -5.0 && !isKillSwitchEngaged) {
        setKillSwitchEngaged(true);
        setSystemLogs(prev => [{ time: new Date().toLocaleTimeString(), msg: '[FATAL] Drawdown > 5%. Engaging Global Kill Switch. Entering Liquidation Mode.' }, ...prev]);
    }

    setPnlHistory(prev => {
      const newHist = [...prev, { value: totalPnl }];
      if (newHist.length > 50) newHist.shift(); // keep last 50 ticks
      return newHist;
    });
  }, [holdingsQuotes, positions, isKillSwitchEngaged]);

  // Connect to backend SSE and fetch initial pos
  useEffect(() => {
    fetch('/api/positions')
      .then(r => r.json())
      .then(data => setPositions(data))
      .catch(e => console.error(e));

    const sse = new EventSource('/api/stream');

    sse.addEventListener('market_update', (e: any) => {
      const data = JSON.parse(e.data);
      setMarketIndices(data.indices || []);
      setAdvDec(data.advanceDecline || { adv: 0, dec: 0 });
      setBreakerActive(data.breakerActive || false);
      if (data.regime) setRegime(data.regime);
    });

    sse.addEventListener('execution_logs', (e: any) => {
      const data = JSON.parse(e.data);
      setSystemLogs(prev => {
        const n = [data, ...prev];
        if (n.length > 30) n.length = 30;
        return n;
      });
    });

    sse.addEventListener('live_quotes', (e: any) => {
      const data = JSON.parse(e.data);
      setLiveQuotes(data);
      setHoldingsQuotes(data); // Using the general active quotes pour
    });

    sse.addEventListener('quantum_signals', (e: any) => {
      const data = JSON.parse(e.data);
      setQuantumSignals(data);
    });

    sse.addEventListener('positions_update', (e: any) => {
      const data = JSON.parse(e.data);
      setPositions(data);
    });

    return () => sse.close();
  }, []);

  // Compute Classic Signals
  useEffect(() => {
    const timeNow = new Date().toLocaleTimeString('en-US', { hour12: false });
    const newSuggestions: any[] = [];

    CANDIDATE_POOL_BASE.forEach(base => {
      const q = liveQuotes.find(q => q.code === base.code);
      if (!q) return;

      const liveMaRatio = q.price / base.baseMa20;
      const realVolRatio = q.volume > 0 ? ((q.volume / base.avgVol) * 10) : (1.0 + Math.random());
      const liveRsi = Math.max(0, Math.min(100, base.baseRsi + (q.changePercent * 2)));

      if (
        liveRsi <= strategyParams.rsiThreshold &&
        liveMaRatio > 1.0 &&
        realVolRatio >= strategyParams.volumeTrigger
      ) {
        newSuggestions.push({
          id: `buy-${base.code}`,
          type: 'CLASSIC_BUY',
          time: timeNow,
          code: base.code,
          name: base.name,
          entryPrice: q.price,
          hardStop: q.price * 0.95,
          suggestedUnits: Math.floor(20000 / q.price),
          logic: `实时RSI: ${liveRsi.toFixed(1)} | 放量: ${realVolRatio.toFixed(1)}x | MA${strategyParams.maPeriod} 支撑`,
          risk: (1 + Math.abs(q.changePercent)).toFixed(1) + '%'
        });
      }
    });

    setClassicSignals(newSuggestions);
  }, [liveQuotes, strategyParams]);

  const triggerBuyDialog = (signal: any) => {
    setSelectedSignal(signal);
    setTradeDetails({
      units: signal.suggestedUnits,
      hardStop: signal.hardStop,
      buyPrice: signal.entryPrice
    });
    setIsBuyDialogOpen(true);
  };

  const confirmBuy = async () => {
    if (!selectedSignal) return;
    const payload = {
      code: selectedSignal.code,
      name: selectedSignal.name,
      buyPrice: tradeDetails.buyPrice,
      units: tradeDetails.units,
      hardStop: tradeDetails.hardStop,
      timestamp: Date.now() // Track execution time for T+1 constraint simulation
    };
    await fetch('/api/positions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    setIsBuyDialogOpen(false);
    setSelectedSignal(null);
  };

  const handleSell = async (id: number) => {
    await fetch(`/api/positions/${id}`, {
      method: 'DELETE'
    });
  };

  const timeNow = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  const shIndex = marketIndices.find(m => m.code === 's_sh000001') || { price: 0, changePercent: 0 };
  const szIndex = marketIndices.find(m => m.code === 's_sz399001') || { price: 0, changePercent: 0 };

  const safeShPrice = Number(shIndex.price) || 0;
  const safeShChange = Number(shIndex.changePercent) || 0;
  const safeSzPrice = Number(szIndex.price) || 0;
  const safeSzChange = Number(szIndex.changePercent) || 0;

  // Calculate live position status
  const analyzedPositions = positions.map(pos => {
    const q = holdingsQuotes.find(hq => hq.code === pos.code);
    const safeBuyPrice = Number(pos.buyPrice) || 1; // Prevent division by zero
    
    // Evaluate T+1 constraint (Mock: 3 mins for active testing, or simulate next day based on simple timestamp diff)
    const isT1Locked = (Date.now() - (pos.timestamp || Date.now())) < 5 * 60 * 1000; // Mock: 5 mins T+1
    
    if (!q) {
      return { 
        ...pos, 
        status: 'WAIT', 
        livePrice: Number(pos.buyPrice) || 0, // Fallback to avoid undefined
        pnl: 0, 
        pnlPct: 0,
        isT1Locked 
      };
    }
    
    let status = 'HOLD'; // Green
    
    // Limit up/down check for A-Share
    const isLimitLocked = Math.abs(q.changePercent) >= 9.9;

    if (q.price <= pos.hardStop) status = 'SELL_NOW'; // Red
    else if (q.price < pos.buyPrice) status = 'WARNING'; // Yellow
    
    // Override if limit locked
    if (isLimitLocked) status = 'LIMIT_LOCK';

    const pnl = q.price - pos.buyPrice;
    const pnlPct = (pnl / safeBuyPrice) * 100;

    return { ...pos, livePrice: Number(q.price) || 0, pnl, pnlPct: pnlPct || 0, status, isT1Locked, isLimitLocked };
  });

  return (
    <div 
       className="flex h-screen w-full flex-col bg-black text-slate-50 font-sans overflow-hidden pattern-grid-lg transition-colors duration-1000 ease-in-out"
       style={{ 
          backgroundImage: `radial-gradient(circle at 50% 0%, ${regime.color === 'yellow' ? 'rgba(234,179,8,0.05)' : regime.color === 'purple' ? 'rgba(168,85,247,0.08)' : regime.color === 'red' ? 'rgba(239,68,68,0.05)' : 'rgba(56,189,248,0.05)'} 0%, transparent 70%)` 
       }}
    >
      {/* 1. 大盘温度条 (Market Temperature Bar) */}
      <header className="flex items-center justify-between bg-slate-900/80 border-b border-slate-800 p-4 h-16 shrink-0 backdrop-blur-md z-10 transition-colors duration-1000">
        <div className="flex items-center space-x-6">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-500 animate-pulse" />
            <span className="font-bold tracking-widest text-sm uppercase text-slate-300">Quantum_Qant <span className="text-blue-500">v5</span></span>
          </div>
          
          <div className="h-6 w-px bg-slate-700/50"></div>

          <div className="flex items-center gap-6 font-mono text-sm">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 uppercase tracking-widest">上证 (SSE)</span>
              <span className={`${safeShChange >= 0 ? 'text-red-500' : 'text-green-500'} font-bold flex items-center gap-2`}>
                {safeShPrice.toFixed(2)} 
                <span className="text-xs">({safeShChange > 0 ? '+' : ''}{safeShChange.toFixed(2)}%)</span>
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 uppercase tracking-widest">深证 (SZSE)</span>
              <span className={`${safeSzChange >= 0 ? 'text-red-500' : 'text-green-500'} font-bold flex items-center gap-2`}>
                {safeSzPrice.toFixed(2)} 
                <span className="text-xs">({safeSzChange > 0 ? '+' : ''}{safeSzChange.toFixed(2)}%)</span>
              </span>
            </div>
          </div>
        </div>

         <div className="flex items-center gap-6">
          {/* Regime Classification */}
          <div className="flex flex-col items-end border-r border-slate-700/50 pr-6 mr-2 hidden md:flex">
             <div className="text-[10px] text-slate-500 uppercase tracking-widest flex items-center gap-1 mb-1">
               <Layers className="w-3 h-3 text-slate-400" /> HMM Regime State
             </div>
             <div className="flex items-center gap-2">
                <span className="text-xs font-bold font-mono px-2 py-0.5 rounded border" style={{ borderColor: regime.color, color: regime.color }}>{regime.state}</span>
                <span className="text-[10px] font-mono text-slate-500 bg-slate-900 px-1 rounded-sm">P: {regime.probability}%</span>
             </div>
          </div>

          <div className="flex items-center gap-3">
             <div className="text-right">
               <div className="text-[10px] text-slate-500 uppercase tracking-widest">市场涨跌比</div>
               <div className="font-mono text-sm">
                 <span className="text-red-500 font-bold">{advDec.adv}</span>
                 <span className="text-slate-600 mx-2">/</span>
                 <span className="text-green-500 font-bold">{advDec.dec}</span>
               </div>
             </div>
             {/* Simple thermometer bar */}
             <div className="w-24 h-2 bg-slate-800 rounded-full overflow-hidden flex">
                <div className="h-full bg-red-500" style={{ width: `${(advDec.adv / (advDec.adv + advDec.dec + 1)) * 100}%` }}></div>
                <div className="h-full bg-green-500 flex-1"></div>
             </div>
          </div>
          
          {isKillSwitchEngaged && (
            <div className="bg-red-600 font-mono text-white px-4 py-1.5 text-xs font-bold rounded-lg animate-pulse flex items-center gap-2 uppercase tracking-widest shadow-[0_0_15px_rgba(220,38,38,0.5)] border border-red-400">
               <AlertCircle className="w-4 h-4" /> kill switch engaged
            </div>
          )}

          <div className="text-slate-600 font-mono text-sm pl-4 border-l border-slate-800 flex flex-col items-end">
            <span>{timeNow}</span>
            {isKillSwitchEngaged && <span className="text-[9px] text-red-400 animate-pulse uppercase">Read Only Mode</span>}
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* COL 1. Market Pulse & Analytics */}
        <aside className="w-[30%] p-4 flex flex-col gap-4 border-r border-slate-800/50 bg-slate-900/10 overflow-y-auto scrollbar-thin">
          <div className="shrink-0 h-48">
            <ConvictionHeatmap quotes={liveQuotes} />
          </div>

          <div className="shrink-0 h-40">
            <LiveFeed logs={systemLogs} />
          </div>

          <div className="flex-1 flex flex-col min-h-[300px]">
            <div className="flex items-center justify-between mb-2 shrink-0">
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300 flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-500" /> Market Pulse
              </h2>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin border border-slate-800 rounded bg-black/50">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-900/80 sticky top-0 font-mono text-slate-500">
                  <tr>
                    <th className="p-2 font-normal">Asset</th>
                    <th className="p-2 font-normal text-right">Price</th>
                    <th className="p-2 font-normal text-right">Change</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {liveQuotes.length === 0 ? (
                     <tr><td colSpan={3} className="text-center p-4 text-slate-600">Awaiting SSE ticks...</td></tr>
                  ) : liveQuotes.map(q => {
                    const sPrice = Number(q.price) || 0;
                    const sChange = Number(q.changePercent) || 0;
                    return (
                    <tr key={q.code} className="border-b border-slate-800/30 hover:bg-slate-800/40">
                      <td className="p-2 flex flex-col">
                        <span className="text-slate-200">{q.name}</span>
                      </td>
                      <td className="p-2 text-right font-bold text-slate-300">{sPrice.toFixed(2)}</td>
                      <td className={`p-2 text-right ${sChange >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                        {sChange >= 0 ? '+' : ''}{sChange.toFixed(2)}%
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          </div>

          <div className="shrink-0 h-40 mt-4">
             <MLOpsMonitor />
          </div>

          <div className="shrink-0 space-y-4 bg-slate-900/30 p-4 rounded-lg border border-slate-800 mt-4 hidden xl:block">
             <h3 className="text-xs font-bold uppercase flex items-center gap-2 text-slate-400">
               <Settings2 className="w-4 h-4 text-blue-500" /> Classic Strategy Tuning
             </h3>
             <div className="space-y-4">
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-slate-400 uppercase tracking-wider">
                    <span>RSI Threshold</span>
                    <span className="text-white font-mono">{strategyParams.rsiThreshold}</span>
                  </div>
                  <Slider 
                    value={[strategyParams.rsiThreshold]} 
                    max={50} min={10} step={1}
                    onValueChange={(val) => setStrategyParams({...strategyParams, rsiThreshold: val[0]})}
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-slate-400 uppercase tracking-wider">
                    <span>Volume Spike (x)</span>
                    <span className="text-white font-mono">{strategyParams.volumeTrigger.toFixed(1)}</span>
                  </div>
                  <Slider 
                    value={[strategyParams.volumeTrigger]} 
                    max={4.0} min={1.0} step={0.1}
                    onValueChange={(val) => setStrategyParams({...strategyParams, volumeTrigger: val[0]})}
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-slate-400 uppercase tracking-wider">
                    <span>MA Support</span>
                    <span className="text-white font-mono">{strategyParams.maPeriod}</span>
                  </div>
                  <Slider 
                    value={[strategyParams.maPeriod]} 
                    max={60} min={5} step={5}
                    onValueChange={(val) => setStrategyParams({...strategyParams, maPeriod: val[0]})}
                  />
                </div>
             </div>
          </div>
        </aside>

        {/* COL 2. Signal Generation Zone */}
        <main className="w-[35%] p-4 flex flex-col border-r border-slate-800/50 bg-slate-950/30 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-blue-900/5 to-transparent pointer-events-none"></div>
          <div className="flex items-center justify-between mb-4 z-10 shrink-0">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300 flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-500" /> Hybrid Signal Matrix
            </h2>
            <span className="text-[10px] text-slate-500 font-mono">Q-Oscillator & Params</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin z-10">
            {quantumSignals.map(sig => (
              <div key={sig.id} className="bg-slate-900/80 border border-blue-900/30 p-4 rounded-lg hover:border-blue-700/50 transition-colors relative overflow-hidden group shadow-lg shadow-blue-900/5">
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="text-[9px] text-blue-400 font-mono uppercase tracking-widest mb-1 flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping"></div>
                      Quantum Oscillator
                    </div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      {sig.name} <span className="text-slate-500 text-xs font-mono">({sig.code})</span>
                    </h3>
                    <p className="text-[10px] font-mono text-slate-400 mt-1 leading-relaxed">
                      {sig.logic}
                    </p>
                  </div>
                  <button 
                    disabled={isKillSwitchEngaged}
                    onClick={() => triggerBuyDialog(sig)}
                    className={`${isKillSwitchEngaged ? 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50' : 'bg-blue-600 hover:bg-blue-500 text-white active:scale-95'} text-xs font-bold py-1.5 px-4 rounded transition-all flex items-center gap-1`}
                  >
                    <CheckCircle2 className="w-3 h-3" /> {isKillSwitchEngaged ? 'HALTED' : 'Execute'}
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-4 text-xs font-mono">
                  <div className="bg-slate-950 p-2 rounded border border-slate-800">
                    <div className="text-slate-500 mb-1 text-[9px] uppercase">Entry</div>
                    <div className="text-red-400">{sig.entryPrice.toFixed(2)}</div>
                  </div>
                  <div className="bg-slate-950 p-2 rounded border border-slate-800">
                    <div className="text-slate-500 mb-1 text-[9px] uppercase">Hard Stop</div>
                    <div className="text-slate-300">{sig.hardStop.toFixed(2)}</div>
                  </div>
                  <div className="bg-slate-950 p-2 rounded border border-slate-800">
                    <div className="text-slate-500 mb-1 text-[9px] uppercase">Sizing</div>
                    <div className="text-blue-400">{sig.suggestedUnits}</div>
                  </div>
                </div>
              </div>
            ))}

            {classicSignals.map(sig => (
              <div key={sig.id} className="bg-slate-900/60 border border-emerald-900/30 p-4 rounded-lg hover:border-emerald-700/50 transition-colors relative overflow-hidden group shadow-lg shadow-emerald-900/5">
                <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="text-[9px] text-emerald-400 font-mono uppercase tracking-widest mb-1">
                      Classic Params
                    </div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      {sig.name} <span className="text-slate-500 text-xs font-mono">({sig.code})</span>
                    </h3>
                    <p className="text-[10px] font-mono text-slate-400 mt-1 leading-relaxed">
                      {sig.logic}
                    </p>
                  </div>
                  <button 
                    disabled={isKillSwitchEngaged}
                    onClick={() => triggerBuyDialog(sig)}
                    className={`${isKillSwitchEngaged ? 'bg-slate-800 text-slate-500 border-none cursor-not-allowed opacity-50' : 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/30 hover:bg-emerald-600 hover:text-white active:scale-95'} text-xs font-bold py-1.5 px-3 rounded transition-all flex items-center gap-1`}
                  >
                    <CheckCircle2 className="w-3 h-3" /> {isKillSwitchEngaged ? 'HALTED' : 'Execute'}
                  </button>
                </div>
              </div>
            ))}

            {quantumSignals.length === 0 && classicSignals.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 text-slate-600 gap-2">
                <Activity className="w-8 h-8 opacity-20" />
                <span className="text-xs font-mono uppercase tracking-widest">Awaiting Perturbations...</span>
              </div>
            )}
          </div>
          
          <div className="shrink-0 h-48 mt-4">
            <TraderDNA />
          </div>
        </main>

        {/* COL 3. 持仓监控区 (Holdings Monitor Zone) */}
        <aside className="w-[35%] p-4 flex flex-col bg-black overflow-y-auto scrollbar-thin">
          <div className="shrink-0 h-40 mb-4">
             <PnLChart data={pnlHistory} />
          </div>

          <div className="flex items-center justify-between mb-4 shrink-0">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-slate-500" />
              Active Positions Tracker
            </h2>
            <span className="text-[10px] text-slate-500 font-mono">Sync: 30s Live</span>
          </div>

          <div className="flex-1 space-y-3 pr-2">
            {analyzedPositions.map(pos => {
              // Styling based on status
              const isRed = pos.status === 'SELL_NOW';
              const isYellow = pos.status === 'WARNING';
              const isGreen = pos.status === 'HOLD';
              const isLimitLocked = pos.status === 'LIMIT_LOCK';

              let borderColor = 'border-slate-800';
              let bgColor = 'bg-slate-900/50';
              let statusLabel = 'HOLD';
              let statusIcon = <Clock className="w-3 h-3" />;
              
              if (isLimitLocked) {
                borderColor = 'border-purple-500/50';
                bgColor = 'bg-purple-900/20';
                statusLabel = '涨跌停锁死';
                statusIcon = <AlertCircle className="w-3 h-3 animate-pulse" />;
              } else if (isRed) {
                borderColor = 'border-red-500';
                bgColor = 'bg-red-950/20';
                statusLabel = '立刻卖 (SELL NOW)';
                statusIcon = <ShieldAlert className="w-3 h-3 animate-pulse" />;
              } else if (isYellow) {
                borderColor = 'border-yellow-500/50';
                bgColor = 'bg-yellow-950/10';
                statusLabel = '接近止损 (WARNING)';
                statusIcon = <AlertCircle className="w-3 h-3" />;
              } else if (isGreen) {
                borderColor = 'border-green-500/30';
                statusLabel = '安全 (HOLD)';
                statusIcon = <TrendingUp className="w-3 h-3" />;
              }

              const pBuyPrice = Number(pos.buyPrice) || 0;
              const pHardStop = Number(pos.hardStop) || 0;
              const pLivePrice = Number(pos.livePrice) || 0;
              const pPnlPct = Number(pos.pnlPct) || 0;

              return (
                <div key={pos.id} className={`border ${borderColor} ${bgColor} rounded-lg transition-colors flex flex-col group relative overflow-hidden mb-2`}>
                  {isRed && <div className="absolute inset-0 bg-red-500/5 animate-pulse pointer-events-none"></div>}
                  
                  <div className="p-4 flex items-center justify-between cursor-pointer" onClick={() => toggleRow(pos.id, pos.code)}>
                    <div className="flex-1 z-10">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-white text-base">{pos.name}</span>
                        <span className="text-slate-500 text-xs font-mono">{pos.code}</span>
                        {pos.isT1Locked && (
                           <span className="ml-2 text-[9px] bg-orange-500/20 text-orange-400 px-1 py-0.5 rounded border border-orange-500/30">T+1 Lock</span>
                        )}
                      </div>
                      <div className="flex gap-4 text-xs font-mono text-slate-400">
                        <span>成本: {pBuyPrice.toFixed(2)}</span>
                        <span>止损: <span className={isRed ? 'text-red-400 font-bold' : ''}>{pHardStop.toFixed(2)}</span></span>
                        <span>持有: {pos.units}</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end z-10 w-32 border-r border-slate-800 pr-4 mr-4">
                      <div className="text-slate-500 text-[9px] uppercase mb-1">当前现价</div>
                      <div className={`font-mono text-lg font-bold ${pos.pnl >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {pLivePrice.toFixed(2)}
                      </div>
                      <div className={`font-mono text-xs ${pos.pnl >= 0 ? 'text-red-500/80' : 'text-green-500/80'}`}>
                        {pos.pnl >= 0 ? '+' : ''}{pPnlPct.toFixed(2)}%
                      </div>
                    </div>

                    <div className="flex flex-col items-end z-10 w-28 gap-2">
                      <div className={`text-[10px] font-bold flex items-center gap-1 uppercase tracking-wider ${isLimitLocked ? 'text-purple-400' : isRed ? 'text-red-400' : isYellow ? 'text-yellow-400' : 'text-green-400'}`}>
                        {statusIcon} {statusLabel}
                      </div>
                      {isLimitLocked || pos.isT1Locked ? (
                         <button 
                            disabled
                            onClick={(e) => { e.stopPropagation(); }}
                            className="bg-slate-800 text-slate-500 border border-slate-800 text-xs px-3 py-1 rounded w-full z-20 relative cursor-not-allowed opacity-50"
                         >
                           {isLimitLocked ? '封单拒单' : 'T+1 锁定中'}
                         </button>
                      ) : isRed ? (
                        <button 
                           onClick={(e) => { e.stopPropagation(); handleSell(pos.id); }}
                           className="bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white border border-red-500/30 text-xs px-3 py-1 rounded transition-colors w-full z-20 relative"
                        >
                          标记卖出
                        </button>
                      ) : (
                        <button 
                           onClick={(e) => { e.stopPropagation(); handleSell(pos.id); }}
                           className="text-slate-600 hover:text-red-400 text-xs px-3 py-1 transition-colors w-full text-right z-20 relative"
                        >
                          清仓脱离
                        </button>
                      )}
                    </div>

                    {/* Expand Chevron */}
                    <div className="pl-2 text-slate-600 shrink-0 z-10">
                       {expandedRows[pos.id] ? <ChevronUp className="w-5 h-5"/> : <ChevronDown className="w-5 h-5"/>}
                    </div>
                  </div>

                  {/* Collapsible History Chart */}
                  {expandedRows[pos.id] && (
                    <div className="h-32 p-4 pt-0 border-t border-slate-800/50 flex flex-col gap-2 mt-1">
                      <div className="text-[9px] text-slate-500 uppercase tracking-widest font-bold flex justify-between items-center">
                        <span>7-Day Price History</span>
                        {histories[pos.code] && (
                          <span className="font-mono text-blue-500/80">({histories[pos.code].length} bars)</span>
                        )}
                      </div>
                      {histories[pos.code] ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={histories[pos.code]}>
                            <XAxis dataKey="date" stroke="#475569" fontSize={9} tickLine={false} axisLine={false} />
                            <YAxis hide domain={['auto', 'auto']} />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '4px', fontSize: '10px' }}
                              itemStyle={{ color: '#38bdf8' }}
                              labelStyle={{ color: '#94a3b8' }}
                            />
                            <Line type="monotone" dataKey="price" stroke={isRed ? '#f87171' : '#10b981'} strokeWidth={2} dot={{ r: 2, fill: '#0f172a', strokeWidth: 2 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex-1 flex justify-center items-center text-xs text-slate-600 animate-pulse font-mono">
                          Loading ticks...
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {positions.length === 0 && (
              <div className="flex flex-col items-center justify-center h-64 text-slate-600 gap-2 border border-dashed border-slate-800 rounded-lg mx-6">
                <Clock className="w-8 h-8 opacity-20" />
                <span className="text-xs font-mono uppercase tracking-widest text-center px-8">
                  No tracking positions found in positions.jsonl.<br/>
                  Click "Execute" on a candidate signal to start tracking.
                </span>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={isBuyDialogOpen} onOpenChange={setIsBuyDialogOpen}>
        <DialogContent className="bg-slate-950 border-blue-900 border text-slate-50">
          <DialogHeader>
            <DialogTitle className="text-blue-400">确认记录此笔买入执行</DialogTitle>
            <DialogDescription className="text-slate-400">
              系统将把此笔交易写入本地 positions.jsonl，并即刻开启量子止损追踪雷达。
            </DialogDescription>
          </DialogHeader>
          {selectedSignal && (
            <div className="grid gap-4 py-4 mt-2">
              <div className="bg-blue-900/10 p-4 border border-blue-800/30 rounded-lg space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-xs font-mono uppercase">标的 (Asset)</span>
                  <span className="font-bold">{selectedSignal.name} ({selectedSignal.code})</span>
                </div>
                
                <div className="flex justify-between items-center bg-black/40 p-2 rounded border border-slate-800 text-[10px] font-mono">
                  <div className="flex flex-col text-center w-full border-r border-slate-800">
                     <span className="text-slate-500 mb-1">Kelly Size Allocation</span>
                     <span className="text-emerald-400 font-bold">{(Math.random() * 8 + 2).toFixed(1)}%</span>
                  </div>
                  <div className="flex flex-col text-center w-full border-r border-slate-800">
                     <span className="text-slate-500 mb-1">Volatility (ATR Proxy)</span>
                     <span className="text-white">{(tradeDetails.buyPrice * 0.045).toFixed(2)}</span>
                  </div>
                  <div className="flex flex-col text-center w-full">
                     <span className="text-slate-500 mb-1">Signal Conviction</span>
                     <span className="text-purple-400 font-bold">Strong</span>
                  </div>
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="buyPrice" className="text-right text-xs text-slate-400">入场价</Label>
                  <Input
                    id="buyPrice"
                    type="number"
                    value={tradeDetails.buyPrice}
                    onChange={(e) => setTradeDetails({ ...tradeDetails, buyPrice: parseFloat(e.target.value) || 0 })}
                    className="col-span-3 bg-slate-900 border-slate-700 h-8 font-mono text-xs"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="units" className="text-right text-xs text-slate-400">单位/股数</Label>
                  <Input
                    id="units"
                    type="number"
                    value={tradeDetails.units}
                    onChange={(e) => setTradeDetails({ ...tradeDetails, units: parseInt(e.target.value) || 0 })}
                    className="col-span-3 bg-slate-900 border-slate-700 h-8 font-mono text-xs"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="hardStop" className="text-right text-xs text-slate-400">硬止损线</Label>
                  <Input
                    id="hardStop"
                    type="number"
                    value={tradeDetails.hardStop}
                    onChange={(e) => setTradeDetails({ ...tradeDetails, hardStop: parseFloat(e.target.value) || 0 })}
                    className="col-span-3 bg-slate-900 border-slate-700 h-8 font-mono text-xs text-rose-400"
                  />
                </div>
                
                {/* Friction Costs Estimation */}
                <div className="pt-2 border-t border-blue-900/40 text-[10px] items-center flex gap-4 text-slate-500 font-mono">
                   <div className="flex gap-1 items-center">
                     <span className="uppercase text-[8px]">Slippage (预估滑点 0.2%)</span>
                     <span className="text-blue-400">¥{(tradeDetails.buyPrice * tradeDetails.units * 0.002).toFixed(2)}</span>
                   </div>
                   <div className="flex gap-1 items-center">
                     <span className="uppercase text-[8px]">Fees (印花+佣金 0.125%)</span>
                     <span className="text-blue-400">¥{(tradeDetails.buyPrice * tradeDetails.units * 0.00125).toFixed(2)}</span>
                   </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" className="text-slate-400 hover:text-slate-200" onClick={() => setIsBuyDialogOpen(false)}>取消</Button>
            <Button onClick={confirmBuy} className="bg-blue-600 hover:bg-blue-500 text-white gap-2">
              <CheckCircle2 className="w-4 h-4" /> 确认写入追踪
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
