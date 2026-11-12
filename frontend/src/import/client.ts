import { ApiError } from '../api/api.ts';
import { IMPORT_LIMITS, ImportError, type ImportSession } from './cstimer.ts';

export interface ImportResult { imported:number; skipped:number }

export function importPayload(sessions:ImportSession[]) {
  return {sessions:sessions.filter(session=>session.selected).map(session=>({
    event:session.event, cube_name:session.cube || null, cube_model_id:session.cubeModelId,
    custom:session.custom || null, solves:session.solves.map(({duration_ms,penalty,started_at})=>({duration_ms,penalty,started_at})),
  }))};
}

export async function saveImport(accountId:number, sessions:ImportSession[], signal:AbortSignal):Promise<ImportResult> {
  const body = JSON.stringify(importPayload(sessions));
  if (new TextEncoder().encode(body).byteLength > IMPORT_LIMITS.fileBytes) throw new ImportError('file exceeds 10 mib');
  const response = await fetch('/api/solves/import',{
    method:'POST', headers:{'Content-Type':'application/json','X-Namicubes-Request':'1','X-Namicubes-Account':String(accountId)},
    body, signal:AbortSignal.any([signal,AbortSignal.timeout(120_000)]),
  });
  const result = await response.json().catch(()=>({}));
  if (!response.ok) throw new ApiError(response.status,typeof result.detail === 'string' ? result.detail : 'import unavailable try again',response.headers);
  if (!Number.isSafeInteger(result.imported) || !Number.isSafeInteger(result.skipped) || result.imported < 0 || result.skipped < 0) throw new Error('invalid import response');
  return result;
}
