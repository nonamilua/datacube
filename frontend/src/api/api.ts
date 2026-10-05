import type { Solve } from '../timer/timer';

export interface StoredSolve extends Solve { id: string; penalty: 'OK' | '+2' | 'DNF' }
export interface SolveLabels { category_id: number | null; cube_name: string | null }
export interface PendingSolve extends StoredSolve, SolveLabels {}
export interface SolvePage { items: StoredSolve[]; total: number }
export interface User { id: number; username: string }
export interface NamedItem { id: number; name: string }
export interface Organization { categories: NamedItem[]; cubes: NamedItem[] }
const queueKey = (userId: number) => `namicubes pending solves ${userId}`;

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function request<T>(url: string, data?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: data === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Namicubes-Request': '1' },
    body: data === undefined ? undefined : JSON.stringify(data),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(response.status, typeof body.detail === 'string' ? body.detail : 'check your details');
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

function solveId(): string {
  // randomUUID requires HTTPS; getRandomValues also works over local Wi-Fi HTTP.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function pendingSolves(userId: number): PendingSolve[] {
  const saved = localStorage.getItem(queueKey(userId));
  return saved ? JSON.parse(saved) as PendingSolve[] : [];
}

export function queueSolve(solve: Solve, userId: number, labels: SolveLabels): void {
  const pending = pendingSolves(userId);
  pending.push({ ...solve, ...labels, id: solveId(), penalty: 'OK' });
  localStorage.setItem(queueKey(userId), JSON.stringify(pending));
}

export async function savePendingSolves(userId: number): Promise<void> {
  for (const solve of pendingSolves(userId)) {
    const response = await fetch('/api/solves', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Namicubes-Request': '1', 'X-Namicubes-Account': String(userId) },
      body: JSON.stringify(solve),
      keepalive: true,
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new ApiError(response.status, 'save failed');
    localStorage.setItem(queueKey(userId), JSON.stringify(pendingSolves(userId).filter(item => item.id !== solve.id)));
  }
}

export async function loadSolves(): Promise<SolvePage> {
  return request<SolvePage>('/api/solves?limit=10');
}

export async function deleteSolve(id: string, userId: number): Promise<void> {
  const response = await fetch(`/api/solves/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'X-Namicubes-Request': '1', 'X-Namicubes-Account': String(userId) },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new ApiError(response.status, 'delete unavailable');
}
