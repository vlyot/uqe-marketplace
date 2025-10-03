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
  const [items, setItems] = useState<AduriteItem[]>([]);
  const [rateThreshold, setRateThreshold] = useState(8.0);
  const [minRAP, setMinRAP] = useState("0");
  const [maxRAP, setMaxRAP] = useState(5_000_000); // Increase to 5M
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
      const parsed = rawItems.map((entry: any) => {
        const roliArr = rolimonItems[String(entry.limited_id)];
        const projected = Array.isArray(roliArr) ? (roliArr[7] !== -1) : false;
        
        const rap = Number(entry.rap) || 0;
        const usdPrice = Number(entry.price) || 0;
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
          <h1 className="text-2xl font-bold">uqe-market</h1>
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

      <div className="flex">
        <Home
          items={items}
          rateThreshold={rateThreshold}
          setRateThreshold={setRateThreshold}
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
