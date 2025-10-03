import React, { useState, useMemo, useEffect, useRef } from "react";

// Helper to fetch Roblox thumbnail for an assetId
function useRobloxThumbnails(assetIds: number[]) {
  const [thumbs, setThumbs] = useState<{ [id: number]: string }>({});

  useEffect(() => {
    if (assetIds.length === 0) return;
    const idsToFetch = assetIds.filter(id => !(id in thumbs));
    if (idsToFetch.length === 0) return;
  fetch(`http://localhost:3001/roblox/thumbnails?assetIds=${idsToFetch.join(",")}&size=420x420&format=Png`)
      .then(res => res.json())
      .then(json => {
        const next: { [id: number]: string } = {};
        for (const d of json.data || []) {
          next[d.targetId] = d.imageUrl;
        }
        setThumbs(t => ({ ...t, ...next }));
      });
    // eslint-disable-next-line
  }, [assetIds.join(",")]);
  return thumbs;
}

export interface AduriteItem {
  limited_id: number;
  limited_name: string;
  rap: number;
  price: number;            // USD
  projected?: boolean;
  sgdMin?: number;          // from Frankfurter conversion logic in App.tsx
  sgdMax?: number;
}

type SortKey = "rate" | "rap" | "value" | null;

export interface HomeProps {
  items: AduriteItem[];
  rateThreshold: number;
  setRateThreshold: React.Dispatch<React.SetStateAction<number>>;
  minRAP: number;
  setMinRAP: React.Dispatch<React.SetStateAction<number>>;
  maxRAP: number;
  setMaxRAP: React.Dispatch<React.SetStateAction<number>>;
  sortBy: SortKey;
  setSortBy: React.Dispatch<React.SetStateAction<SortKey>>;
  searchTerm: string;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  error: string | null;
  darkMode: boolean;
  reloadFlag: number;
  setReloadFlag: React.Dispatch<React.SetStateAction<number>>;
  runtime: number;
}

function formatValue(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toString();
}

const Home: React.FC<HomeProps> = ({
  items,
  rateThreshold,
  setRateThreshold,
  minRAP,
  setMinRAP,
  maxRAP,
  setMaxRAP,
  sortBy,
  setSortBy,
  searchTerm,
  setSearchTerm,
  error,
  darkMode,
  reloadFlag,
  setReloadFlag,
  runtime,
}) => {
  const [selectedItem, setSelectedItem] = useState<AduriteItem | null>(null);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const base = !q ? items : items.filter(i => i.limited_name.toLowerCase().includes(q));
    const byFilter = base.filter((entry) => {
      const rap = entry.rap || 1;
      const rate = entry.price / (rap / 1000);
      return (
        entry.rap >= minRAP &&
        entry.rap <= maxRAP &&
        rate <= rateThreshold &&
        entry.price > 0
      );
    });
    return byFilter.sort((a, b) => {
      if (sortBy === "rap") return a.rap - b.rap;
      if (sortBy === "value") return a.rap - b.rap;
      const rateA = a.price / ((a.rap || 1) / 1000);
      const rateB = b.price / ((b.rap || 1) / 1000);
      return rateA - rateB;
    });
  }, [items, minRAP, maxRAP, rateThreshold, sortBy, searchTerm]);


  // Long scrollable list, smaller cards
  const CARD_HEIGHT = 220;
  // Dynamically fetch thumbnails for visible items
  const INITIAL_THUMBS = 20;
  const [thumbWindow, setThumbWindow] = useState({ start: 0, end: INITIAL_THUMBS });
  const assetIds = filtered.slice(thumbWindow.start, thumbWindow.end).map(e => e.limited_id);
  const thumbs = useRobloxThumbnails(assetIds);

  // Track refs for each card
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Use IntersectionObserver to update thumbWindow as user scrolls
  useEffect(() => {
    if (!filtered.length) return;
    const observer = new window.IntersectionObserver(
      (entries) => {
        const visibleIndexes = entries
          .filter(e => e.isIntersecting)
          .map(e => Number(e.target.getAttribute('data-index')))
          .filter(i => !isNaN(i));
        if (visibleIndexes.length) {
          const min = Math.max(0, Math.min(...visibleIndexes) - 5);
          const max = Math.min(filtered.length, Math.max(...visibleIndexes) + 15);
          setThumbWindow({ start: min, end: max });
        }
      },
      { root: null, rootMargin: '0px', threshold: 0.1 }
    );
    cardRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });
    return () => observer.disconnect();
  }, [filtered.length]);


  return (
    <>
      {/* Filters Sidebar */}
      <aside className={`w-64 h-screen ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"} border-r overflow-y-auto`}>
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-6">Filters</h2>
          
          {/* Sort Section */}
          <div className="mb-6">
            <h3 className="text-sm font-medium mb-3 uppercase tracking-wide text-gray-500">Sort By</h3>
            <div className="space-y-2">
              <button
                onClick={() => setSortBy("rate")}
                className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                  sortBy === "rate"
                    ? (darkMode ? "bg-blue-600 text-white" : "bg-blue-100 text-blue-800")
                    : (darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100")
                }`}
              >
                Rate (Best First)
              </button>
              <button
                onClick={() => setSortBy("rap")}
                className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                  sortBy === "rap"
                    ? (darkMode ? "bg-blue-600 text-white" : "bg-blue-100 text-blue-800")
                    : (darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100")
                }`}
              >
                RAP (Lowest First)
              </button>
              <button
                onClick={() => setSortBy("value")}
                className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                  sortBy === "value"
                    ? (darkMode ? "bg-blue-600 text-white" : "bg-blue-100 text-blue-800")
                    : (darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100")
                }`}
              >
                Value (Lowest First)
              </button>
              {sortBy && (
                <button
                  onClick={() => setSortBy(null)}
                  className={`w-full text-left px-3 py-2 rounded-md transition-colors text-sm ${
                    darkMode ? "text-gray-400 hover:bg-gray-700" : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  Reset Sort
                </button>
              )}
            </div>
          </div>

          {/* Rate Filter */}
          <div className="mb-6">
            <h3 className="text-sm font-medium mb-3 uppercase tracking-wide text-gray-500">Rate Threshold</h3>
            <div className="space-y-2">
              <label className="text-sm">Maximum Rate (≤ {rateThreshold})</label>
              <input
                type="number"
                value={rateThreshold}
                onChange={(e) => setRateThreshold(parseFloat(e.target.value))}
                className={`w-full px-3 py-2 rounded-md border ${
                  darkMode 
                    ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" 
                    : "bg-white border-gray-300 text-gray-900"
                } focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                step="0.1"
                min="0"
              />
            </div>
          </div>

          {/* RAP Range */}
          <div className="mb-6">
            <h3 className="text-sm font-medium mb-3 uppercase tracking-wide text-gray-500">RAP Range</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm block mb-1">Minimum RAP</label>
                <input
                  type="number"
                  value={minRAP}
                  onChange={(e) => setMinRAP(parseInt(e.target.value))}
                  className={`w-full px-3 py-2 rounded-md border ${
                    darkMode 
                      ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" 
                      : "bg-white border-gray-300 text-gray-900"
                  } focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                  min="0"
                />
              </div>
              <div>
                <label className="text-sm block mb-1">Maximum RAP</label>
                <input
                  type="number"
                  value={maxRAP}
                  onChange={(e) => setMaxRAP(parseInt(e.target.value))}
                  className={`w-full px-3 py-2 rounded-md border ${
                    darkMode 
                      ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" 
                      : "bg-white border-gray-300 text-gray-900"
                  } focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                  min="0"
                />
              </div>
            </div>
          </div>

          {/* Results Count */}
          <div className={`p-3 rounded-md ${darkMode ? "bg-gray-700" : "bg-gray-100"}`}>
            <p className="text-sm">
              <span className="font-medium">{filtered.length}</span> items found
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-h-screen">
        {/* Search Header */}
        <div className={`${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"} border-b px-6 py-4`}>
          <div className="flex items-center justify-between">
            <div className="flex-1 max-w-lg">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`w-full pl-10 pr-4 py-2 rounded-md border ${
                    darkMode 
                      ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" 
                      : "bg-white border-gray-300 text-gray-900"
                  } focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4 ml-6">
              <button
                onClick={() => setReloadFlag((f) => f + 1)}
                className={`px-4 py-2 rounded-md transition-colors ${
                  darkMode 
                    ? "bg-blue-600 hover:bg-blue-700 text-white" 
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                }`}
                title="Reload data"
              >
                Reload
              </button>
              
              <div className={`px-3 py-1 rounded-full text-sm ${
                darkMode ? "bg-gray-700 text-gray-300" : "bg-gray-200 text-gray-600"
              }`}>
                Runtime: {Math.floor(runtime / 60)}:{(runtime % 60).toString().padStart(2, "0")}
              </div>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mx-6 mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-md">
            {error}
          </div>
        )}

        {/* Products Grid */}
        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {filtered.map((entry, i) => {
              const rate = entry.price / ((entry.rap || 1) / 1000);
              return (
                <div
                  key={i}
                  ref={el => { cardRefs.current[i] = el; }}
                  data-index={i}
                  className={`group ${darkMode ? "bg-gray-800 hover:bg-gray-750" : "bg-white hover:bg-gray-50"} rounded-lg shadow-sm border ${
                    darkMode ? "border-gray-700" : "border-gray-200"
                  } overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-md`}
                  onClick={() => setSelectedItem(entry)}
                >
                  <div className="relative">
                    <img
                      src={thumbs[entry.limited_id] || "https://tr.rbxcdn.com/7c1b6e6e7e6e7e6e7e6e7e6e7e6e7e6e/180/180/Image/Png"}
                      alt={entry.limited_name}
                      className="w-full h-40 object-contain bg-gray-100"
                      onError={e => {
                        (e.target as HTMLImageElement).src = "https://tr.rbxcdn.com/7c1b6e6e7e6e7e6e7e6e7e6e7e6e7e6e/180/180/Image/Png";
                      }}
                    />
                    {entry.projected && (
                      <span className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                        Projected
                      </span>
                    )}
                  </div>
                  
                  <div className="p-4">
                    <h3 className="font-medium text-sm mb-2 leading-tight overflow-hidden">
                      <span className="block truncate">{entry.limited_name}</span>
                    </h3>
                    
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">RAP:</span>
                        <span className="font-medium">{formatValue(entry.rap)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Price:</span>
                        <span className="font-medium">${entry.price.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Rate:</span>
                        <span className={`font-medium ${rate <= 2 ? "text-green-600" : rate <= 3 ? "text-yellow-600" : "text-red-600"}`}>
                          {rate.toFixed(2)}
                        </span>
                      </div>
                      {entry.sgdMin && entry.sgdMax && (
                        <div className="flex justify-between text-xs text-gray-400 pt-1">
                          <span>SGD:</span>
                          <span>S${entry.sgdMin.toLocaleString()} – S${entry.sgdMax.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          {filtered.length === 0 && !error && (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2 2v-5m16 0h-2M4 13h2m13-8V9a4 4 0 00-4-4H9a4 4 0 00-4 4v4h1.5" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No items found</h3>
              <p className="mt-1 text-sm text-gray-500">Try adjusting your filters or search term.</p>
            </div>
          )}
        </div>
      </main>

      {/* Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className={`${darkMode ? "bg-gray-800" : "bg-white"} rounded-lg shadow-xl max-w-lg w-full max-h-screen overflow-y-auto`}>
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold">{selectedItem.limited_name}</h2>
              <button
                onClick={() => setSelectedItem(null)}
                className={`p-2 rounded-md transition-colors ${
                  darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Limited ID:</span>
                  <p className="font-medium">{selectedItem.limited_id}</p>
                </div>
                <div>
                  <span className="text-gray-500">RAP:</span>
                  <p className="font-medium">{selectedItem.rap.toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-gray-500">Value:</span>
                  <p className="font-medium">{formatValue(selectedItem.rap)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Cost:</span>
                  <p className="font-medium">${selectedItem.price.toFixed(2)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Rate:</span>
                  <p className="font-medium">{(selectedItem.price / ((selectedItem.rap || 1) / 1000)).toFixed(2)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Projected:</span>
                  <p className="font-medium">{selectedItem.projected ? "Yes" : "No"}</p>
                </div>
              </div>
              
              {selectedItem.sgdMin && selectedItem.sgdMax && (
                <div>
                  <span className="text-gray-500 text-sm">Est. SGD Range:</span>
                  <p className="font-medium">S${selectedItem.sgdMin.toLocaleString()} – S${selectedItem.sgdMax.toLocaleString()}</p>
                </div>
              )}
            </div>
            
            <div className="flex justify-end p-6 border-t border-gray-200">
              <button
                onClick={() => setSelectedItem(null)}
                className={`px-4 py-2 rounded-md transition-colors ${
                  darkMode 
                    ? "bg-gray-600 hover:bg-gray-700 text-white" 
                    : "bg-gray-100 hover:bg-gray-200 text-gray-800"
                }`}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Home;
