import React, { useState, useEffect } from 'react';
import { ShieldAlert, TrendingUp, Clock, Activity, CheckCircle2, AlertCircle } from 'lucide-react';
import { Input } from './components/ui/input';
import { Button } from './components/ui/button';
import { Label } from './components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './components/ui/dialog';

export default function App() {
  const [marketIndices, setMarketIndices] = useState<any[]>([]);
  const [advDec, setAdvDec] = useState({ adv: 0, dec: 0 });
  const [breakerActive, setBreakerActive] = useState(false);
  
  const [quantumSignals, setQuantumSignals] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [holdingsQuotes, setHoldingsQuotes] = useState<any[]>([]);

  // Dialog State
  const [selectedSignal, setSelectedSignal] = useState<any | null>(null);
  const [isBuyDialogOpen, setIsBuyDialogOpen] = useState(false);
  const [tradeDetails, setTradeDetails] = useState({ units: 0, hardStop: 0, buyPrice: 0 });

  // Connect to backend SSE and fetch initial pos
  useEffect(() => {
    // 1. Fetch initial positions from API
    fetch('/api/positions')
      .then(r => r.json())
      .then(data => setPositions(data))
      .catch(e => console.error(e));

    // 2. Setup Server-Sent Events
    const sse = new EventSource('/api/stream');

    sse.addEventListener('market_update', (e: any) => {
      const data = JSON.parse(e.data);
      setMarketIndices(data.indices || []);
      setAdvDec(data.advanceDecline || { adv: 0, dec: 0 });
      setBreakerActive(data.breakerActive || false);
    });

    sse.addEventListener('quantum_signals', (e: any) => {
      const data = JSON.parse(e.data);
      setQuantumSignals(prev => {
        // Tag new signals to flash
        const newIds = data.map((s:any) => s.id);
        const merged = [...data];
        return merged;
      });
    });

    sse.addEventListener('holdings_quotes', (e: any) => {
      const data = JSON.parse(e.data);
      setHoldingsQuotes(data);
    });

    sse.addEventListener('positions_update', (e: any) => {
      const data = JSON.parse(e.data);
      setPositions(data);
    });

    return () => sse.close();
  }, []);

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
        {/* 2. 买入候选区 (Candidate Buy Zone - Harmonic Oscillator Signals) */}
        <aside className="w-1/2 p-4 flex flex-col border-r border-slate-800/50 bg-slate-950/30">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300 flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></div>
              Quantum Oscillator Signals
            </h2>
            <span className="text-[10px] text-slate-500 font-mono">Scan Interval: 5m</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
            {quantumSignals.map(sig => (
              <div key={sig.id} className="bg-slate-900/80 border border-blue-900/30 p-4 rounded-lg hover:border-blue-700/50 transition-colors relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-600"></div>
                
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      {sig.name} <span className="text-slate-500 text-xs font-mono">({sig.code})</span>
                    </h3>
                    <p className="text-[10px] font-mono text-blue-400 mt-1 opacity-80 leading-relaxed">
                      {sig.logic}
                    </p>
                  </div>
                  <button 
                    onClick={() => triggerBuyDialog(sig)}
                    className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-1.5 px-4 rounded shadow-lg shadow-blue-900/30 transition-all active:scale-95 flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3 h-3" /> 我买了
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-4 text-xs font-mono">
                  <div className="bg-slate-950 p-2 rounded border border-slate-800">
                    <div className="text-slate-500 mb-1 text-[9px] uppercase">入场价 (Entry)</div>
                    <div className="text-red-400">{sig.entryPrice.toFixed(2)}</div>
                  </div>
                  <div className="bg-slate-950 p-2 rounded border border-slate-800">
                    <div className="text-slate-500 mb-1 text-[9px] uppercase">硬止损 (Hard Stop)</div>
                    <div className="text-slate-300">{sig.hardStop.toFixed(2)}</div>
                  </div>
                  <div className="bg-slate-950 p-2 rounded border border-slate-800">
                    <div className="text-slate-500 mb-1 text-[9px] uppercase">建议仓位 (Units)</div>
                    <div className="text-blue-400">{sig.suggestedUnits} 股</div>
                  </div>
                </div>
              </div>
            ))}
            {quantumSignals.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 text-slate-600 gap-2">
                <Activity className="w-8 h-8 opacity-20" />
                <span className="text-xs font-mono uppercase tracking-widest">Awaiting Quantum Perturbations...</span>
              </div>
            )}
          </div>
        </aside>

        {/* 3. 持仓监控区 (Holdings Monitor Zone) */}
        <main className="w-1/2 p-4 flex flex-col bg-black">
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
                  Click "我买了" on a candidate signal to start tracking.
                </span>
              </div>
            )}
          </div>
        </main>
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
