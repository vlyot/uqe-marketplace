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

  const totalValue = filtered.reduce((sum, it) => sum + (it.price || 0), 0);
  const totalRAP = filtered.reduce((sum, it) => sum + (it.rap || 0), 0);

  return (
    <>
      {/* Controls */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <button className="btn btn-outline-light me-2" onClick={() => setSortBy("rap")}>
            RAP
          </button>
          <button className="btn btn-outline-light me-2" onClick={() => setSortBy("value")}>
            Value
          </button>
          <button className="btn btn-outline-light me-2" onClick={() => setSortBy("rate")}>
            Rate
          </button>
          <button className="btn btn-outline-secondary" onClick={() => setSortBy(null)}>
            Reset
          </button>
        </div>
        <div className="d-flex align-items-center w-50 justify-content-end">
          <input
            className="form-control bg-dark text-light w-50 me-2"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button
            className="btn btn-outline-info me-2"
            onClick={() => setReloadFlag((f) => f + 1)}
            title="Reload data"
          >
            Reload
          </button>
          <span className="badge bg-secondary">
            Runtime: {Math.floor(runtime / 60)}:{(runtime % 60).toString().padStart(2, "0")}
          </span>
        </div>
      </div>

      {/* RAP and Rate filters */}
      <div className="d-flex align-items-center mb-3">
        <label className="me-2">Rate ≤</label>
        <input
          type="number"
          value={rateThreshold}
          onChange={(e) => setRateThreshold(parseFloat(e.target.value))}
          className="form-control bg-dark text-light me-3 w-25"
          step="0.1"
        />
        <label className="me-2">RAP Range:</label>
        <input
          type="number"
          value={minRAP}
          onChange={(e) => setMinRAP(parseInt(e.target.value))}
          className="form-control bg-dark text-light me-2 w-25"
        />
        <span className="me-2">to</span>
        <input
          type="number"
          value={maxRAP}
          onChange={(e) => setMaxRAP(parseInt(e.target.value))}
          className="form-control bg-dark text-light w-25"
        />
      </div>

      {/* Error display */}
      {error && <div className="alert alert-danger">{error}</div>}



      {/* Card Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
          marginTop: '2rem',
        }}
      >
        {filtered.map((entry, i) => {
          const rate = entry.price / ((entry.rap || 1) / 1000);
          return (
            <div
              key={i}
              ref={el => cardRefs.current[i] = el}
              data-index={i}
              className="card bg-dark text-light"
              style={{ borderRadius: 10, boxShadow: '0 2px 8px #0004', cursor: 'pointer', padding: 10, position: 'relative', minHeight: 180 }}
              onClick={() => setSelectedItem(entry)}
            >
              <img
                src={thumbs[entry.limited_id] || "https://tr.rbxcdn.com/7c1b6e6e7e6e7e6e7e6e7e6e7e6e7e6e/180/180/Image/Png"}
                alt={entry.limited_name}
                style={{ width: '100%', height: 90, objectFit: 'contain', borderRadius: 6, background: '#222' }}
                onError={e => {
                  (e.target as HTMLImageElement).src = "https://tr.rbxcdn.com/7c1b6e6e7e6e7e6e7e6e7e6e7e6e7e6e/180/180/Image/Png";
                }}
              />
              <div style={{ marginTop: 8, fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.limited_name}</div>
              <div style={{ color: '#ff4d4f', fontWeight: 600, fontSize: 13, marginTop: 2 }}>RAP {formatValue(entry.rap)}</div>
              <div style={{ color: '#ff4d4f', fontWeight: 600, fontSize: 13 }}>Price ${entry.price.toLocaleString()}</div>
              <div style={{ marginTop: 2, color: '#aaa', fontSize: 12 }}>Rate {rate.toFixed(2)}</div>
              {entry.sgdMin && entry.sgdMax && (
                <div style={{ color: '#aaa', fontSize: 11 }}>SGD S${entry.sgdMin.toLocaleString()} – S${entry.sgdMax.toLocaleString()}</div>
              )}
              {entry.projected && (
                <span style={{ position: 'absolute', top: 8, right: 8, background: '#d9534f', color: '#fff', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>Projected</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {selectedItem && (
        <div className="modal show fade d-block" tabIndex={-1} style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className={`modal-content ${darkMode ? "bg-dark text-light" : ""}`}>
              <div className="modal-header">
                <h5 className="modal-title">{selectedItem.limited_name} Details</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setSelectedItem(null)}></button>
              </div>
              <div className="modal-body">
                <p><strong>Limited ID:</strong> {selectedItem.limited_id}</p>
                <p><strong>RAP:</strong> {selectedItem.rap.toLocaleString()}</p>
                <p><strong>Value:</strong> {formatValue(selectedItem.rap)}</p>
                <p><strong>Cost:</strong> ${selectedItem.price.toFixed(2)}</p>
                <p><strong>Rate:</strong> {(selectedItem.price / ((selectedItem.rap || 1) / 1000)).toFixed(2)}</p>
                <p><strong>Est. SGD Range:</strong> 
                  {selectedItem.sgdMin && selectedItem.sgdMax
                    ? ` S$${selectedItem.sgdMin.toLocaleString()} – S$${selectedItem.sgdMax.toLocaleString()}`
                    : " —"}
                </p>
                <p><strong>Projected:</strong> {selectedItem.projected ? "Yes" : "No"}</p>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setSelectedItem(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Home;
