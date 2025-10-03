// src/lib/fx.ts
export async function getUsdToSgd(): Promise<number> {
  const base = import.meta.env.VITE_FX_API || 'https://api.exchangerate.host/latest';
  const url = `${base}?base=USD&symbols=SGD`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch FX rate');
  const data = await res.json();
  const rate = data?.rates?.SGD;
  if (typeof rate !== 'number') throw new Error('SGD rate missing');
  return rate;
}

export function computeSgdRange(usd: number, usdToSgd: number) {
  const min = Math.round(usd * 1.2 * usdToSgd);
  const max = Math.round(usd * 2.0 * usdToSgd);
  return { min, max };
}
