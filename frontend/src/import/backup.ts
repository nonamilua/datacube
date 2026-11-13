import { ApiError } from '../api/api.ts';
import type { ImportResult } from './client.ts';
import { ImportError } from './cstimer.ts';

const NATIVE_BACKUP_BYTES = 32 * 1024 * 1024;

export function isDatacubeBackup(data:unknown):boolean {
  return typeof data === 'object' && data !== null && 'format' in data && data.format === 'datacube';
}

export async function restoreBackup(owner:number, file:Blob, signal:AbortSignal, preview = false):Promise<ImportResult> {
  if (file.size > NATIVE_BACKUP_BYTES) throw new ImportError('backup exceeds 32 mib');
  // Send the original bytes so JS does not round timestamps or large integers.
  const response = await fetch(preview ? '/api/solves/restore/preview' : '/api/solves/restore', {
    method:'POST', headers:{'Content-Type':'application/json','X-Namicubes-Request':'1','X-Namicubes-Account':String(owner)},
    body:file, signal,
  });
  const result = await response.json().catch(()=>null);
  if (!response.ok) throw new ApiError(response.status,typeof result?.detail === 'string' ? result.detail : 'import unavailable try again',response.headers);
  const {imported,skipped} = result ?? {};
  if (![imported,skipped].every(value=>Number.isSafeInteger(value) && value >= 0)) {
    throw new Error('invalid restore response');
  }
  return {imported,skipped};
}

interface BackupDownload { file:Blob; filename:string }

export async function fetchBackup(owner:number, signal:AbortSignal):Promise<BackupDownload> {
  const response = await fetch('/api/solves/backup', {
    headers:{'X-Namicubes-Account':String(owner)}, cache:'no-store',
    signal:AbortSignal.any([signal,AbortSignal.timeout(120_000)]),
  });
  if (response.status === 429) throw new ApiError(429,'too many requests',response.headers);
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('export unavailable');
  const disposition = response.headers.get('Content-Disposition');
  const filename = disposition?.match(/^attachment; filename="(datacube-backup-[a-zA-Z0-9_]+\.json)"$/)?.[1] ?? 'datacube-backup.json';
  return {file:await response.blob(),filename};
}

export function downloadBackup({file,filename}:BackupDownload):void {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(()=>URL.revokeObjectURL(url),30_000);
}
