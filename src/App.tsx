import { useEffect, useState, useCallback } from "react";
import Home from "./pages/Home";

interface AduriteItem {
  limited_id: number;
  limited_name: string;
  rap: number;
  price: number;            // USD
  projected?: boolean;
  sgdEstimate: number;      // Primary SGD estimate
  sgdMin?: number;          // Min SGD range
  sgdMax?: number;          // Max SGD range
  rateMin?: number;         // Min rate based on SGD
  rateMax?: number;         // Max rate based on SGD
}

// Use proxy base from environment
const PROXY_BASE = import.meta.env.VITE_ADURITE_BASE || "";
const ROLIMONS_URL = `${PROXY_BASE}/rolimons/items/v1/itemdetails`;
// Use proxy for Adurite API if provided
const ADURITE_URL = "https://adurite.com/api/market/roblox";

// Cache system
interface CacheData {
  data: AduriteItem[];
  timestamp: number;
  usdToSgd: number;
}

const CACHE_DURATION = 3 * 60 * 1000; // 3 minutes
let dataCache: CacheData | null = null;

function App() {
  const [showFAQ, setShowFAQ] = useState(false);
  const [items, setItems] = useState<AduriteItem[]>([]);
  const [minRAP, setMinRAP] = useState("0");
  const [maxRAP, setMaxRAP] = useState(5000000); // Increase to 5M
  const [sortBy, setSortBy] = useState<"rate" | "rap" | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(true);
  const [runtime, setRuntime] = useState(0);

  // For reload button
  const [reloadFlag, setReloadFlag] = useState(0);

  // Frankfurter: https://api.frankfurter.app/latest?amount={}&from={}&to={}
  async function getUsdToSgd(): Promise<number> {
    const url = `https://api.frankfurter.app/latest?amount=1&from=USD&to=SGD`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Frankfurter failed: ${res.status}`);
    const data = await res.json();
    const rate = data?.rates?.SGD;
    if (typeof rate !== "number") throw new Error("SGD rate missing");
    return rate;
  }

  function computeSgdEstimates(usd: number, usdToSgd: number) {
    // Primary SGD estimate (1.25x multiplier)
    const estimate = Math.round(usd * 1.25 * usdToSgd);
    // Range: 1.1x–1.7x, then convert to SGD
    const min = Math.round(usd * 1.1 * usdToSgd);
    const max = Math.round(usd * 1.7 * usdToSgd);
    return { estimate, min, max };
  }

  function computeRateRange(rapOrValue: number, sgdMin: number, sgdMax: number) {
    // Rate = SGD price / (RAP or Value / 1000)
    const baseValue = (rapOrValue || 1) / 1000;
    const rateMin = Number((sgdMin / baseValue).toFixed(2));
    const rateMax = Number((sgdMax / baseValue).toFixed(2));
    return { rateMin, rateMax };
  }

  const fetchData = useCallback(async () => {
    try {
      setError(null);

      // Check cache first
      const now = Date.now();
      if (dataCache && (now - dataCache.timestamp) < CACHE_DURATION) {
        setItems(dataCache.data);
        return;
      }

      // Fetch in parallel: Adurite, Rolimons (via proxy), and USD→SGD
      const [aduriteRes, rolimonRaw, usdToSgd] = await Promise.all([
        fetch(ADURITE_URL, { cache: "no-store" }).then((res) => res.json()),
        fetch(ROLIMONS_URL, { cache: "no-store" }).then((res) => {
          if (!res.ok) throw new Error(`Rolimons proxy failed: ${res.status}`);
          return res.json();
        }),
        getUsdToSgd(),
      ]);


      // Rolimons compact array format: items[id] = [name, abbreviation, rap, value1, value2, ...]
      const rolimonItems = rolimonRaw?.items || {};

      // Adurite shape: { items: { items: { "<key>": { limited_id, limited_name, rap, price, ... } } } }
      const rawItems: any[] = Object.values(aduriteRes?.items?.items ?? {});

      // Debug: print high RAP items and their price string
      if (typeof window !== 'undefined') {
        const highRAP = rawItems.filter(e => Number(e.rap) > 200000);
        console.log('[DEBUG] High RAP raw items:', highRAP.map(e => ({ name: e.limited_name, rap: e.rap, price: e.price })));
      }

      const parsed = rawItems.map((entry: any) => {
        const roliArr = rolimonItems[String(entry.limited_id)];
        const projected = Array.isArray(roliArr) ? (roliArr[7] !== -1) : false;

        // Remove commas from price string before parsing
        let priceStr = String(entry.price ?? '0').replace(/,/g, '');
        const rap = Number(entry.rap) || 0;
        const usdPrice = Number(priceStr) || 0;
        const { estimate, min, max } = computeSgdEstimates(usdPrice, usdToSgd);
        const { rateMin, rateMax } = computeRateRange(rap, min, max);

        return {
          limited_id: Number(entry.limited_id),
          limited_name: String(entry.limited_name ?? "Unknown"),
          rap,
          price: usdPrice,
          projected,
          sgdEstimate: estimate,
          sgdMin: min,
          sgdMax: max,
          rateMin,
          rateMax,
        } as AduriteItem;
      });

      // Keep the cheapest per limited_id (same as your Map logic)
      const best = new Map<number, AduriteItem>();
      for (const it of parsed) {
        const existing = best.get(it.limited_id);
        if (!existing || it.price < existing.price) best.set(it.limited_id, it);
      }

      const finalItems = Array.from(best.values());

      // Cache the data
      dataCache = {
        data: finalItems,
        timestamp: now,
        usdToSgd
      };

      setItems(finalItems);
    } catch (err: any) {
      console.error("Failed to fetch data:", err);
      setError("Could not fetch data from one or more sources.");
    }
  }, []);

  // Data fetching effect (on mount + when reloadFlag changes)
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60_000);
    return () => clearInterval(interval);
  }, [fetchData, reloadFlag]);

  // Runtime timer
  useEffect(() => {
    setRuntime(0);
    const timer = setInterval(() => setRuntime((r) => r + 1), 1000);
    return () => clearInterval(timer);
  }, [reloadFlag]);

  // RAP dropdown options
  const rapOptions = [
    { label: "0", value: "0" },
    { label: "1K", value: "1000" },
    { label: "5K", value: "5000" },
    { label: "10K", value: "10000" },
    { label: "20K", value: "20000" },
    { label: "50K", value: "50000" },
    { label: "100K", value: "100000" },
    { label: "200K", value: "200000" },
    { label: "300K", value: "300000" },
  ];

  return (
    <div className={`min-h-screen ${darkMode ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"}`}>
      {/* Header */}
      <header className={`${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"} border-b px-6 py-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">uqe-market</h1>
            <button
              className={`ml-2 px-3 py-1 rounded-md text-base font-medium transition-colors border ${darkMode ? "bg-gray-700 border-gray-600 text-white hover:bg-gray-600" : "bg-gray-100 border-gray-300 text-gray-900 hover:bg-gray-200"}`}
              onClick={() => setShowFAQ(true)}
              title="Frequently Asked Questions"
            >
              FAQ
            </button>
            <a
              href="https://discord.com/invite/KfhjS73e7s"
              target="_blank"
              rel="noopener noreferrer"
              className={`ml-2 px-3 py-1 rounded-md text-base font-medium transition-colors border flex items-center gap-2 ${darkMode ? "bg-indigo-700 border-indigo-500 text-white hover:bg-indigo-800" : "bg-indigo-100 border-indigo-300 text-indigo-800 hover:bg-indigo-200"}`}
              title="Join Discord Server"
            >
              <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M20.317 4.369a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37.07.07 0 0 0 3.598 4.4c-3.123 4.668-3.97 9.226-3.549 13.724a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
              Discord
            </a>
            <p>item decals tend to break from scrolling too fast or other factors, no way to fix this sorry</p>
          </div>
          <button
            className={`px-4 py-2 rounded-md transition-colors ${
              darkMode 
                ? "bg-gray-700 hover:bg-gray-600 text-white" 
                : "bg-gray-200 hover:bg-gray-300 text-gray-800"
            }`}
            onClick={() => setDarkMode(!darkMode)}
          >
            {darkMode ? "Light Mode" : "Dark Mode"}
          </button>
        </div>
      </header>
      {/* FAQ Modal */}
      {showFAQ && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className={`w-full max-w-2xl rounded-lg shadow-lg ${darkMode ? "bg-gray-800 text-white" : "bg-white text-gray-900"}`} style={{padding: '2.5rem 2.5rem 2rem 2.5rem', position: 'relative'}}>
            <button
              onClick={() => setShowFAQ(false)}
              className={`absolute top-4 right-4 p-2 rounded-md ${darkMode ? "hover:bg-gray-700" : "hover:bg-gray-200"}`}
              aria-label="Close FAQ"
            >
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
            <h2 className="text-3xl font-bold mb-6">Frequently Asked Questions</h2>
            <div className="space-y-8 text-lg">
              <div>
                <div className={`${darkMode ? 'text-blue-300' : 'text-blue-700'} font-bold mb-1 text-xl`}>Why are some items priced higher than other items of similar value?</div>
                <div className={`${darkMode ? 'text-gray-200' : 'text-gray-700'} font-normal pl-2 mt-1`}>Item prices can vary due to the number of items in stock, their rarity, and how difficult they are to obtain. Rarer or harder-to-get items are often valued higher, even if their RAP is similar to others.</div>
              </div>
              <div>
                <div className={`${darkMode ? 'text-blue-300' : 'text-blue-700'} font-bold mb-1 text-xl`}>What do the estimated prices and rates mean, and why are they so high?</div>
                <div className={`${darkMode ? 'text-gray-200' : 'text-gray-700'} font-normal pl-2 mt-1`}>The price estimates are intentionally skewed towards the higher end to provide a safe range. The real price is usually towards the lower end of the estimate. For exact pricing or more information, please contact me directly. Prices fluctuate frequently and may change at any time. </div>
              </div>
              <div>
                <div className={`${darkMode ? 'text-blue-300' : 'text-blue-700'} font-bold mb-1 text-xl`}>Why are projected items even being shown?</div>
                <div className={`${darkMode ? 'text-gray-200' : 'text-gray-700'} font-normal pl-2 mt-1`}>All items listed are detected by a custom bot that tracks every one of my items across all accounts, ensuring nothing is missed.</div>
              </div>
              <div>
                <div className={`${darkMode ? 'text-blue-300' : 'text-blue-700'} font-bold mb-1 text-xl`}>How can I find out the fixed price of an item?</div>
                <div className={`${darkMode ? 'text-gray-200' : 'text-gray-700'} font-normal pl-2 mt-1`}>Join the Discord server and DM <b>@uqe2</b> for a quote or to purchase. I'm happy to help with any questions!</div>
              </div>
            </div>
          </div>
        </div>
      )}
      

      <div className="flex">
        <Home
          items={items}
          minRAP={minRAP}
          setMinRAP={setMinRAP}
          maxRAP={maxRAP}
          setMaxRAP={setMaxRAP}
          sortBy={sortBy}
          setSortBy={setSortBy}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          error={error}
          darkMode={darkMode}
          reloadFlag={reloadFlag}
          setReloadFlag={setReloadFlag}
          runtime={runtime}
          rapOptions={rapOptions}
        />
      </div>
    </div>
  );
}

export default App;
