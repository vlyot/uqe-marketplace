import { useEffect, useState, useCallback } from "react";
import Home from "./pages/Home";

interface AduriteItem {
  limited_id: number;
  limited_name: string;
  rap: number;
  price: number;            // USD
  projected?: boolean;
  sgdMin?: number;          // computed with Frankfurter
  sgdMax?: number;          // computed with Frankfurter
}

// Use local proxy for Rolimons API
const ROLIMONS_URL = "http://localhost:3001/rolimons/items/v1/itemdetails";
const ADURITE_URL = "https://adurite.com/api/market/roblox";

function App() {
  const [items, setItems] = useState<AduriteItem[]>([]);
  const [rateThreshold, setRateThreshold] = useState(4.5);
  const [minRAP, setMinRAP] = useState(0);
  const [maxRAP, setMaxRAP] = useState(1_000_000);
  const [sortBy, setSortBy] = useState<"rate" | "rap" | "value" | null>(null);
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

  function computeSgdRange(usd: number, usdToSgd: number) {
    // Apply 1.2x–2.0x, then convert to SGD
    const min = Math.round(usd * 1.2 * usdToSgd);
    const max = Math.round(usd * 2.0 * usdToSgd);
    return { min, max };
  }

  const fetchData = useCallback(async () => {
    try {
      setError(null);

      // Fetch in parallel: Adurite, Rolimons (via proxy), and USD→SGD
      const [aduriteRes, rolimonRaw, usdToSgd] = await Promise.all([
        fetch(ADURITE_URL, { cache: "no-store" }).then((res) => res.json()),
        fetch(ROLIMONS_URL, { cache: "no-store" }).then((res) => {
          if (!res.ok) throw new Error(`Rolimons proxy failed: ${res.status}`);
          return res.json();
        }),
        getUsdToSgd(),
      ]);

      // Rolimons compact array format: items[id] = [...]
      // Your rule: projected if entry[7] !== -1
      const rolimonItems = rolimonRaw?.items || {};

      // Adurite shape: { items: { items: { "<key>": { limited_id, limited_name, rap, price, ... } } } }
      const rawItems: any[] = Object.values(aduriteRes?.items?.items ?? {});
      const parsed = rawItems.map((entry: any) => {
        const roliArr = rolimonItems[String(entry.limited_id)];
        const projected =
          Array.isArray(roliArr) ? (roliArr[7] !== -1) : false;

        const usdPrice = Number(entry.price) || 0;
        const { min, max } = computeSgdRange(usdPrice, usdToSgd);

        return {
          limited_id: Number(entry.limited_id),
          limited_name: String(entry.limited_name ?? "Unknown"),
          rap: Number(entry.rap) || 0, // keeping your original RAP source (Adurite)
          price: usdPrice,
          projected,
          sgdMin: min,
          sgdMax: max,
        } as AduriteItem;
      });

      // Keep the cheapest per limited_id (same as your Map logic)
      const best = new Map<number, AduriteItem>();
      for (const it of parsed) {
        const existing = best.get(it.limited_id);
        if (!existing || it.price < existing.price) best.set(it.limited_id, it);
      }

      setItems(Array.from(best.values()));
    } catch (err: any) {
      console.error("Failed to fetch data:", err);
      setError("Could not fetch data from one or more sources.");
    }
  }, [ADURITE_URL, ROLIMONS_URL]);

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

  return (
    <div className={`min-h-screen ${darkMode ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"}`}>
      {/* Header */}
      <header className={`${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"} border-b px-6 py-4`}>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">AduriteTracker</h1>
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
        />
      </div>
    </div>
  );
}

export default App;
