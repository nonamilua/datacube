import type { Solve } from '../timer/timer';

export interface StoredSolve extends Solve { id: string; penalty: 'OK' | '+2' | 'DNF' }
export interface SolvePage { items: StoredSolve[]; total: number }
const queueKey = 'namicubes pending solves';

function solveId(): string {
  // randomUUID requires HTTPS; getRandomValues also works over local Wi-Fi HTTP.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function pendingSolves(): StoredSolve[] {
  const saved = localStorage.getItem(queueKey);
  return saved ? JSON.parse(saved) as StoredSolve[] : [];
}

export function queueSolve(solve: Solve): void {
  const pending = pendingSolves();
  pending.push({ ...solve, id: solveId(), penalty: 'OK' });
  localStorage.setItem(queueKey, JSON.stringify(pending));
}

export async function savePendingSolves(): Promise<void> {
  for (const solve of pendingSolves()) {
    const response = await fetch('/api/solves', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(solve),
      keepalive: true,
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('save failed');
    localStorage.setItem(queueKey, JSON.stringify(pendingSolves().filter(item => item.id !== solve.id)));
  }
}

export async function loadSolves(): Promise<SolvePage> {
  const response = await fetch('/api/solves?limit=10', { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('load failed');
  return response.json() as Promise<SolvePage>;
}
