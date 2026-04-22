import express from "express";
import { createServer as createViteServer } from "vite";
import { createServer } from "http";
import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";
import iconv from "iconv-lite";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const POSITIONS_FILE = path.join(__dirname, "positions.jsonl");

// Initialize positions file
if (!fs.existsSync(POSITIONS_FILE)) {
  fs.writeFileSync(POSITIONS_FILE, "");
}

function readPositions() {
  try {
    const data = fs.readFileSync(POSITIONS_FILE, "utf8");
    return data.split("\n").filter(Boolean).map(line => JSON.parse(line));
  } catch (e) {
    return [];
  }
}

function writePositions(positions: any[]) {
  const data = positions.map((p: any) => JSON.stringify(p)).join("\n");
  fs.writeFileSync(POSITIONS_FILE, data);
}

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const PORT = 3000;

  app.use(express.json());

  // === REST APIs for Holdings ===
  app.get("/api/positions", (req, res) => {
    res.json(readPositions());
  });

  app.post("/api/positions", (req, res) => {
    const positions = readPositions();
    const newPos = { ...req.body, id: Date.now() };
    positions.push(newPos);
    writePositions(positions);
    res.json(newPos);
    broadcast('positions_update', positions);
  });

  app.delete("/api/positions/:id", (req, res) => {
    let positions = readPositions();
    positions = positions.filter((p: any) => p.id !== parseInt(req.params.id));
    writePositions(positions);
    res.json({ success: true });
    broadcast('positions_update', positions);
  });

  // === Server-Sent Events (SSE) Setup ===
  let clients: any[] = [];
  app.get("/api/stream", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    
    clients.push(res);
    req.on("close", () => {
      clients = clients.filter(c => c !== res);
    });
  });

  function broadcast(event: string, data: any) {
    clients.forEach(c => c.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
  }

  // === Sina Market Data Fetcher ===
  const CANDIDATES = [
    'sh600519', 'sz000858', 'sz300750', 'sh601318', 
    'sz002594', 'sh601919', 'sh600036', 'sz002415'
  ];

  async function fetchQuotes(symbols: string[]) {
    if (symbols.length === 0) return [];
    try {
      const symbolsStr = symbols.join(',');
      const response = await axios.get(`http://hq.sinajs.cn/list=${symbolsStr}`, {
        headers: { 'Referer': 'http://finance.sina.com.cn', 'User-Agent': 'Mozilla/5.0' },
        responseType: 'arraybuffer'
      });
      
      const rawData = iconv.decode(Buffer.from(response.data), 'gbk');
      const lines = rawData.split('\n');
      const quotes: any[] = [];
      
      for (const line of lines) {
        if (!line) continue;
        const match = line.match(/var hq_str_(s[hz]\d{6})="(.*)";/);
        if (match) {
          const code = match[1];
          const parts = match[2].split(',');
          // Indices (s_sh/s_sz) format vs Regular stocks
          if (code.startsWith('s_sh') || code.startsWith('s_sz')) {
            quotes.push({
              code,
              name: parts[0],
              price: parseFloat(parts[1]),
              change: parseFloat(parts[2]),
              changePercent: parseFloat(parts[3]),
              volume: parseFloat(parts[4]), // Advancing/Declining info is usually part of deeper index data, so we use volume as mock market temp
            });
          } else if (parts.length > 30) {
            const currentPrice = parseFloat(parts[3]);
            const prevClose = parseFloat(parts[2]);
            const change = currentPrice - prevClose;
            const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;
            quotes.push({
              code,
              name: parts[0],
              price: currentPrice,
              change: parseFloat(change.toFixed(2)),
              changePercent: parseFloat(changePercent.toFixed(2))
            });
          }
        }
      }
      return quotes;
    } catch (e) {
      console.error("Sina API Error:", e.message);
      return [];
    }
  }

  // === Routine: 2s Fast Market Updates for UI Pulse ===
  setInterval(async () => {
    const positions = readPositions();
    const posCodes = positions.map((p:any) => p.code);
    const symbolsToFetch = [...new Set([...CANDIDATES, 's_sh000001', 's_sz399001', ...posCodes])];
    
    const quotes = await fetchQuotes(symbolsToFetch);
    const market = quotes.filter(q => q.code.startsWith('s_'));
    const stocks = quotes.filter(q => !q.code.startsWith('s_'));
    
    // Simulate advance/decline based on index change for Market Temp
    const mainIndex = market.find(m => m.code === 's_sh000001');
    let advCount = 2000, decCount = 2000;
    if (mainIndex) {
      advCount = Math.floor(2500 + (mainIndex.changePercent * 500));
      decCount = 5000 - advCount;
    }

    broadcast('market_update', {
      indices: market,
      advanceDecline: { adv: advCount, dec: decCount },
      breakerActive: false
    });

    broadcast('live_quotes', stocks);
  }, 2000);

  // === Routine: 10s Quantum Harmonic Oscillator Scan ===
  // We use 10 seconds for demo visualization
  setInterval(async () => {
    const quotes = await fetchQuotes(CANDIDATES);
    const signals: any[] = [];
    
    quotes.forEach(q => {
      // Quantum Harmonic Oscillator Model
      // Price is treated as energy system. Quanta = 2% of price.
      const quanta = q.price * 0.02;
      if (quanta <= 0) return;
      
      const n = Math.floor(q.price / quanta); // Quantum state n
      
      // Operators probability influence:
      // â†|n⟩ = √(n+1)|n+1⟩ (Creation/Growth)
      // â|n⟩ = √n|n-1⟩     (Annihilation/Decay)
      
      // Bias the probability wave based on real momentum (changePercent)
      const momentumBias = q.changePercent > 0 ? 1.0 + (q.changePercent * 0.1) : 1.0 - (Math.abs(q.changePercent) * 0.1);
      
      const probUp = Math.sqrt(n + 1) * momentumBias;
      const probDown = Math.sqrt(n) * (1 / momentumBias);
      const Energy = quanta * (n + 0.5); // E_n = hBarOmega(n + 1/2)

      // Signal Trigger: If transition probability for |n+1> heavily outweighs |n-1>
      if (probUp > probDown * 1.01) {
        signals.push({
          id: Date.now() + q.code,
          code: q.code,
          name: q.name,
          entryPrice: q.price,
          hardStop: q.price * 0.95, // 5% Hard Stop
          suggestedUnits: Math.floor(50000 / q.price), // Example: $50k sizing
          logic: `State |${n}⟩. ProbDensity â†|n⟩ = ${(probUp/probDown).toFixed(2)}x. Energy Eₙ=${Energy.toFixed(2)}.`,
          isNew: true
        });
      }
    });

    broadcast('quantum_signals', signals);
  }, 10000);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
