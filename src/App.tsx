import React, { useState, useEffect } from 'react';
import { ShieldAlert, TrendingUp, Clock, Activity, CheckCircle2, AlertCircle, Settings2, Zap } from 'lucide-react';
import { Input } from './components/ui/input';
import { Button } from './components/ui/button';
import { Label } from './components/ui/label';
import { Slider } from './components/ui/slider';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './components/ui/dialog';

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

  // Calculate live position status
  const analyzedPositions = positions.map(pos => {
    const q = holdingsQuotes.find(hq => hq.code === pos.code);
    if (!q) return { ...pos, status: 'WAIT', livePrice: pos.buyPrice, pnl: 0 };
    
    // Simple logic:
    // Red = < Hard Stop
    // Yellow = < Base Price but > Hard Stop
    // Green = > Base Price
    
    let status = 'HOLD'; // Green
    if (q.price <= pos.hardStop) status = 'SELL_NOW'; // Red
    else if (q.price < pos.buyPrice) status = 'WARNING'; // Yellow

    const pnl = q.price - pos.buyPrice;
    const pnlPct = (pnl / pos.buyPrice) * 100;

    return { ...pos, livePrice: q.price, pnl, pnlPct, status };
  });

  return (
    <div className="flex h-screen w-full flex-col bg-black text-slate-50 font-sans overflow-hidden pattern-grid-lg">
      {/* 1. 大盘温度条 (Market Temperature Bar) */}
      <header className="flex items-center justify-between bg-slate-900/80 border-b border-slate-800 p-4 h-16 shrink-0 backdrop-blur-md z-10">
        <div className="flex items-center space-x-6">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-500 animate-pulse" />
            <span className="font-bold tracking-widest text-sm uppercase text-slate-300">Quantum_Qant <span className="text-blue-500">v5</span></span>
          </div>
          
          <div className="h-6 w-px bg-slate-700/50"></div>

          <div className="flex items-center gap-6 font-mono text-sm">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 uppercase tracking-widest">上证 (SSE)</span>
              <span className={`${shIndex.changePercent >= 0 ? 'text-red-500' : 'text-green-500'} font-bold flex items-center gap-2`}>
                {shIndex.price.toFixed(2)} 
                <span className="text-xs">({shIndex.changePercent > 0 ? '+' : ''}{shIndex.changePercent.toFixed(2)}%)</span>
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 uppercase tracking-widest">深证 (SZSE)</span>
              <span className={`${szIndex.changePercent >= 0 ? 'text-red-500' : 'text-green-500'} font-bold flex items-center gap-2`}>
                {szIndex.price.toFixed(2)} 
                <span className="text-xs">({szIndex.changePercent > 0 ? '+' : ''}{szIndex.changePercent.toFixed(2)}%)</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
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
          
          {breakerActive && (
            <div className="bg-red-900/50 text-red-400 border border-red-500/50 px-3 py-1 text-xs font-bold rounded animate-pulse display-flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" /> 熔断警告 / BREAKER
            </div>
          )}

          <div className="text-slate-600 font-mono text-sm pl-4 border-l border-slate-800">
            {timeNow}
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* COL 1. Market Pulse & Parameters */}
        <aside className="w-[30%] p-4 flex flex-col border-r border-slate-800/50 bg-slate-900/10">
          <div className="flex items-center justify-between mb-4 shrink-0">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-500" /> Market Pulse
            </h2>
          </div>
          
          <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin mb-4 border border-slate-800 rounded bg-black/50">
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
                ) : liveQuotes.map(q => (
                  <tr key={q.code} className="border-b border-slate-800/30 hover:bg-slate-800/40">
                    <td className="p-2 flex flex-col">
                      <span className="text-slate-200">{q.name}</span>
                    </td>
                    <td className="p-2 text-right font-bold text-slate-300">{q.price.toFixed(2)}</td>
                    <td className={`p-2 text-right ${q.changePercent >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                      {q.changePercent >= 0 ? '+' : ''}{q.changePercent.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="shrink-0 space-y-4 bg-slate-900/30 p-4 rounded-lg border border-slate-800">
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
                    onClick={() => triggerBuyDialog(sig)}
                    className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-1.5 px-4 rounded transition-all active:scale-95 flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3 h-3" /> Execute
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
                    onClick={() => triggerBuyDialog(sig)}
                    className="bg-emerald-600/20 text-emerald-400 border border-emerald-600/30 hover:bg-emerald-600 hover:text-white text-xs font-bold py-1.5 px-3 rounded transition-all active:scale-95 flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3 h-3" /> Execute
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
        </main>

        {/* COL 3. 持仓监控区 (Holdings Monitor Zone) */}
        <aside className="w-[35%] p-4 flex flex-col bg-black">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-slate-500" />
              Active Positions Tracker
            </h2>
            <span className="text-[10px] text-slate-500 font-mono">Sync: 30s Live</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
            {analyzedPositions.map(pos => {
              // Styling based on status
              const isRed = pos.status === 'SELL_NOW';
              const isYellow = pos.status === 'WARNING';
              const isGreen = pos.status === 'HOLD';

              let borderColor = 'border-slate-800';
              let bgColor = 'bg-slate-900/50';
              let statusLabel = 'HOLD';
              let statusIcon = <Clock className="w-3 h-3" />;
              
              if (isRed) {
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

              return (
                <div key={pos.id} className={`border ${borderColor} ${bgColor} p-4 rounded-lg transition-colors flex items-center justify-between group relative overflow-hidden`}>
                  {isRed && <div className="absolute inset-0 bg-red-500/5 animate-pulse pointer-events-none"></div>}
                  
                  <div className="flex-1 z-10">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-white text-base">{pos.name}</span>
                      <span className="text-slate-500 text-xs font-mono">{pos.code}</span>
                    </div>
                    <div className="flex gap-4 text-xs font-mono text-slate-400">
                      <span>成本: {pos.buyPrice.toFixed(2)}</span>
                      <span>止损: <span className={isRed ? 'text-red-400 font-bold' : ''}>{pos.hardStop.toFixed(2)}</span></span>
                      <span>持有: {pos.units}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end z-10 w-32 border-r border-slate-800 pr-4 mr-4">
                    <div className="text-slate-500 text-[9px] uppercase mb-1">当前现价</div>
                    <div className={`font-mono text-lg font-bold ${pos.pnl >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {pos.livePrice.toFixed(2)}
                    </div>
                    <div className={`font-mono text-xs ${pos.pnl >= 0 ? 'text-red-500/80' : 'text-green-500/80'}`}>
                      {pos.pnl >= 0 ? '+' : ''}{pos.pnlPct.toFixed(2)}%
                    </div>
                  </div>

                  <div className="flex flex-col items-end z-10 w-28 gap-2">
                    <div className={`text-[10px] font-bold flex items-center gap-1 uppercase tracking-wider ${isRed ? 'text-red-400' : isYellow ? 'text-yellow-400' : 'text-green-400'}`}>
                      {statusIcon} {statusLabel}
                    </div>
                    {isRed && (
                      <button 
                         onClick={() => handleSell(pos.id)}
                         className="bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white border border-red-500/30 text-xs px-3 py-1 rounded transition-colors w-full"
                      >
                        标记卖出
                      </button>
                    )}
                    {!isRed && (
                      <button 
                         onClick={() => handleSell(pos.id)}
                         className="text-slate-600 hover:text-red-400 text-xs px-3 py-1 transition-colors w-full text-right"
                      >
                        清仓脱离
                      </button>
                    )}
                  </div>
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
