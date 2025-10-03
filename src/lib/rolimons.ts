// src/lib/rolimons.ts
import { getJSON } from './http';

// Use local proxy for Rolimons API
const PROXY_BASE = import.meta.env.VITE_ADURITE_BASE || "";
const ROLIMONS_URL = `${PROXY_BASE}/rolimons/items/v1/itemdetails`;

export async function fetchRolimonItemdetails(): Promise<Record<string, any>> {
  return getJSON<Record<string, any>>(ROLIMONS_URL);
}

// Compact array helper
function fromArray<T = any>(arr: any[] | undefined, i: number, fallback: T): T {
  if (!Array.isArray(arr)) return fallback;
  const v = arr[i];
  return (v === undefined || v === null) ? fallback : (v as T);
}

export function extractRolimonForId(map: Record<string, any>, id: string | number) {
  const key = String(id);
  const entry = map?.items?.[key]; // array per your existing logic

  // Your rule: projected if index 7 !== -1
  const projected = fromArray<number>(entry, 7, -1) !== -1;

  // Try to grab a RAP candidate from compact array (index 1 is often RAP/value)
  const rap = fromArray<number | null>(entry, 1, null);
  const name = fromArray<string | undefined>(entry, 0, undefined);

  return { rap: typeof rap === 'number' ? rap : null, value: null, projected, name };
}
