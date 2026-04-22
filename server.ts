import express from "express";
import { createServer as createViteServer } from "vite";
import { createServer } from "http";
import { Server } from "socket.io";
import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";
import iconv from "iconv-lite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: "*" },
  });

  const PORT = 3000;

  app.use(express.json());

  // API to fetch real stock data via proxy
  app.get("/api/quotes", async (req, res) => {
    try {
      const symbols = req.query.symbols || 's_sh000001,s_sz399001';
      const response = await axios.get(`http://hq.sinajs.cn/list=${symbols}`, {
        headers: {
          'Referer': 'http://finance.sina.com.cn',
          'User-Agent': 'Mozilla/5.0'
        },
        responseType: 'arraybuffer' // to handle GBK encoding
      });
      
      let data = iconv.decode(Buffer.from(response.data), 'gbk');
      res.send(data);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch quotes" });
    }
  });

  // Real-time stream using socket.io with ACTUAL data from Sina API
  let activeSymbols = new Set(['sh600519', 'sz000858', 'sz300750', 'sh601318', 'sz002594']);

  io.on("connection", (socket) => {
    socket.on("subscribe", (code: string) => {
      activeSymbols.add(code);
    });
  });

  setInterval(async () => {
    try {
      const symbolsStr = Array.from(activeSymbols).join(',');
      const response = await axios.get(`http://hq.sinajs.cn/list=${symbolsStr}`, {
        headers: {
          'Referer': 'http://finance.sina.com.cn',
          'User-Agent': 'Mozilla/5.0'
        },
        responseType: 'arraybuffer'
      });
      
      const rawData = iconv.decode(Buffer.from(response.data), 'gbk');
      const lines = rawData.split('\n');
      
      const parsedQuotes = [];
      
      for (const line of lines) {
        if (!line) continue;
        // var hq_str_sh600519="贵州茅台,27.25,27.25,27.25,..."
        const match = line.match(/var hq_str_(s[hz]\d{6})="(.*)";/);
        if (match) {
          const code = match[1];
          const parts = match[2].split(',');
          // Indices (s_sh) have fewer fields, normal stocks have 30+ fields
          if (parts.length > 30) {
            const name = parts[0];
            const currentPrice = parseFloat(parts[3]);
            const prevClose = parseFloat(parts[2]);
            const change = currentPrice - prevClose;
            const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;
            
            parsedQuotes.push({
              code,
              name,
              price: currentPrice,
              change: parseFloat(change.toFixed(2)),
              changePercent: parseFloat(changePercent.toFixed(2)),
              atr: 2.5 // Simulated for now
            });
          }
        }
      }

      if (parsedQuotes.length > 0) {
        io.emit('quotes', parsedQuotes);
      }
    } catch (e) {
      console.error("Error polling SINA API:", e.message);
    }
  }, 2000); // Fetch real market data every 2 seconds

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
