// src/lib/adurite.ts
import { getJSON } from './http';
import type { AduriteListing } from '../types/market';

// Updated to use direct API calls instead of relying on the Worker proxy
const ROLIMONS_URL = "https://api.rolimons.com/items/v1/itemdetails";
const ADURITE_URL = "https://adurite.com/api/market/roblox";

export async function fetchRolimonItemdetails(): Promise<Record<string, any>> {
  return getJSON<Record<string, any>>(ROLIMONS_URL);
}

export async function fetchAduriteListings(): Promise<AduriteListing[]> {
  const raw = await getJSON<any>(ADURITE_URL);
  const values: any[] = Object.values(raw?.items?.items ?? {});

  const list: AduriteListing[] = values.map((e: any) => ({
    id: Number(e.limited_id),
    name: String(e.limited_name ?? "Unknown"),
    // In your app "price" is USD
    usdPrice: Number(e.price) || 0,
    robloxAssetId: Number(e.limited_id),
    thumbnailUrl: undefined,
  }));

  // Keep cheapest per limited_id (your Map logic)
  const best = new Map<number, AduriteListing>();
  for (const it of list) {
    const cur = best.get(Number(it.id));
    if (!cur || it.usdPrice < cur.usdPrice) best.set(Number(it.id), it);
  }
  return Array.from(best.values());
}
