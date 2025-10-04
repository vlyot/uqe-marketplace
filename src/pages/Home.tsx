import React, { useState, useMemo, useEffect, useRef } from "react";

// Helper to fetch Roblox thumbnail for an assetId
function useRobloxThumbnails(assetIds: number[]) {
  const [thumbs, setThumbs] = useState<{ [id: number]: string }>({});

  useEffect(() => {
    if (assetIds.length === 0) return;
    const idsToFetch = assetIds.filter(id => !(id in thumbs));
    if (idsToFetch.length === 0) return;
  const proxyBase = import.meta.env.VITE_ADURITE_BASE || "";
  fetch(`${proxyBase}/roblox/thumbnails?assetIds=${idsToFetch.join(",")}&size=420x420&format=Png`)
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
  sgdEstimate: number;      // Primary SGD estimate
  sgdMin?: number;          // Min SGD range
  sgdMax?: number;          // Max SGD range
  rateMin?: number;         // Min rate based on SGD
  rateMax?: number;         // Max rate based on SGD
}

type SortKey = "rate" | "rap" | null;

export interface HomeProps {
  items: AduriteItem[];
  minRAP: string;
  setMinRAP: React.Dispatch<React.SetStateAction<string>>;
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
  rapOptions: { label: string; value: string }[];
}

function formatValue(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toString();
}

const Home: React.FC<HomeProps> = ({
  items,
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
  setReloadFlag,
  runtime,
  rapOptions,
}) => {
  const [selectedItem, setSelectedItem] = useState<AduriteItem | null>(null);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const base = !q ? items : items.filter(i => i.limited_name.toLowerCase().includes(q));

    const minRAPNum = parseInt(minRAP) || 0;
    // Debug log: show filter settings and RAPs
    if (typeof window !== 'undefined') {
      console.log('[DEBUG] Filter settings:', { minRAPNum, maxRAP, sortBy, searchTerm });
      console.log('[DEBUG] All RAPs:', base.map(e => e.rap));
    }

    const byFilter = base.filter((entry) => {
      // Only filter by RAP range and USD price
      return (
        entry.rap >= minRAPNum &&
        entry.rap <= maxRAP &&
        entry.price > 0 // Only require USD price > 0
      );
    });

    // Debug log: show filtered RAPs
    if (typeof window !== 'undefined') {
      console.log('[DEBUG] Filtered RAPs:', byFilter.map(e => e.rap));
    }

    return byFilter.sort((a, b) => {
      // Apply user-selected sorting
      if (sortBy === "rap") {
        return a.rap - b.rap;
      }
      if (sortBy === "rate") {
        const rateA = (a.rateMin || 0);
        const rateB = (b.rateMin || 0);
        return rateA - rateB;
      }

      return 0;
    });
  }, [items, minRAP, maxRAP,sortBy, searchTerm]);


  // Long scrollable list, smaller cards
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



          {/* RAP Range */}
          <div className="mb-6">
            <h3 className="text-sm font-medium mb-3 uppercase tracking-wide text-gray-500">RAP Range</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm block mb-1">Minimum RAP</label>
                <select
                  value={minRAP}
                  onChange={(e) => setMinRAP(e.target.value)}
                  className={`w-full px-3 py-2 rounded-md border ${
                    darkMode 
                      ? "bg-gray-700 border-gray-600 text-white" 
                      : "bg-white border-gray-300 text-gray-900"
                  } focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                >
                  {rapOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm block mb-1">Maximum RAP/Value</label>
                <input
                  type="number"
                  value={maxRAP}
                  onChange={(e) => setMaxRAP(parseInt(e.target.value))}
                  className={`w-full px-3 py-2 rounded-md border ${
                    darkMode 
                      ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" 
                      : "bg-white border-gray-300 text-gray-900"
                  } focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                  min="1000000"
                  max="5000000"
                  placeholder="1M - 5M"
                />
              </div>
            </div>
          </div>

          {/* Results Count */}
          <div className={`p-3 rounded-md ${darkMode ? "bg-gray-700" : "bg-gray-100"}`}>
            <p className="text-sm">
              <span className="font-medium">{filtered.length}</span> items uploaded
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
        
          {/* Free Tier Notice */}
          <div className="mx-6 mt-4 p-4 bg-yellow-100 border border-yellow-400 text-yellow-800 rounded-md">
            <strong>Notice:</strong> If you do not see any items, please wait up to 5 minutes. This website is using a free hosting tier for the backend proxy, so it might be slow to load. Thank you for your patience! please feel free to do something else while waiting
          </div>

        {/* Products Grid */}
        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {filtered.map((entry, i) => {
              const displayValue = entry.rap;
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
                        <span className="font-medium">{formatValue(displayValue)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Est. Price:</span>
                        <span className="font-medium">
                          S${(entry.sgdMin || 0).toLocaleString()} - S${(entry.sgdMax || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Rate:</span>
                        <span className={`font-medium ${(entry.rateMin || 0) <= 2 ? "text-green-600" : (entry.rateMin || 0) <= 3 ? "text-yellow-600" : "text-red-600"}`}>
                          {entry.rateMin?.toFixed(2)} - {entry.rateMax?.toFixed(2)}
                        </span>
                      </div>
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
          <div className={`${darkMode ? "bg-gray-800" : "bg-white"} rounded-lg shadow-xl max-w-2xl w-full max-h-screen overflow-y-auto`}>
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
            
            <div className="p-6">
              {/* Item Image */}
              <div className="mb-6 flex justify-center">
                <img
                  src={thumbs[selectedItem.limited_id] || "https://tr.rbxcdn.com/7c1b6e6e7e6e7e6e7e6e7e6e7e6e7e6e/180/180/Image/Png"}
                  alt={selectedItem.limited_name}
                  className="w-32 h-32 object-contain bg-gray-100 rounded-lg"
                  onError={e => {
                    (e.target as HTMLImageElement).src = "https://tr.rbxcdn.com/7c1b6e6e7e6e7e6e7e6e7e6e7e6e7e6e/180/180/Image/Png";
                  }}
                />
              </div>

              {/* Item Details */}
              <div className="space-y-4 mb-6">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Limited ID:</span>
                    <p className="font-medium">{selectedItem.limited_id}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">RAP:</span>
                    <p className="font-medium">{formatValue(selectedItem.rap)}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Est. Price Range:</span>
                    <p className="font-medium">S${(selectedItem.sgdMin || 0).toLocaleString()} - S${(selectedItem.sgdMax || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Rate Range:</span>
                    <p className="font-medium">
                      {selectedItem.rateMin?.toFixed(2)} - {selectedItem.rateMax?.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Projected:</span>
                    <p className="font-medium">{selectedItem.projected ? "Yes" : "No"}</p>
                  </div>
                </div>
              </div>

              {/* Pricing Disclaimer */}
              <div className={`p-3 rounded-md mb-4 ${darkMode ? "bg-yellow-900 border-yellow-700" : "bg-yellow-50 border-yellow-200"} border`}>
                <div className="flex">
                  <svg className="w-5 h-5 text-yellow-600 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <h4 className={`text-sm font-medium ${darkMode ? "text-yellow-200" : "text-yellow-800"}`}>Price Estimate Disclaimer</h4>
                    <p className={`text-sm mt-1 ${darkMode ? "text-yellow-300" : "text-yellow-700"}`}>
                      The price range shown is a mere estimate. The real price and rate should be lower than the maximum prices stated. 
                      The maximum prices are only shown as an extreme estimate, just in case. Contact me for quotes and to confirm real price.
                      Prices fluctuate frequently and may change at any time. 
                    </p>
                  </div>
                </div>
              </div>

              {/* Discord CTA */}
              <div className={`p-4 rounded-lg ${darkMode ? "bg-blue-800 border-blue-600" : "bg-blue-100 border-blue-300"} border`}>
                <h3 className={`font-semibold mb-2 ${darkMode ? "text-blue-200" : "text-blue-700"}`}>Interested in this item?</h3>
                <p className={`text-sm mb-3 ${darkMode ? "text-white" : "text-white"}`}>
                  Join our Discord server to contact me for purchasing this item!
                </p>
                <a
                  href="https://discord.gg/KfhjS73e7s"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
                >
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.317 4.369a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37.07.07 0 0 0 3.598 4.4c-3.123 4.668-3.97 9.226-3.549 13.724a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
                  </svg>
                  Join Discord Server
                </a>
              </div>
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
