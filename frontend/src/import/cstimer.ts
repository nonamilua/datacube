// Bounds are checked before file reading and before record normalization.
export const IMPORT_LIMITS = {fileBytes:10 * 1024 * 1024, records:50_000} as const;

// Session opt.scrType (or legacy scr), never individual scramble notation.
export const CSTIMER_EVENTS: Readonly<Record<string,string>> = {
  '333':'3x3', '333o':'3x3', '222so':'2x2', '222o':'2x2', '2223':'2x2',
  '444wca':'4x4', '444':'4x4', '444m':'4x4', '555wca':'5x5', '555':'5x5',
  '666wca':'6x6', '666si':'6x6', '777wca':'7x7', '777si':'7x7',
  '333ni':'3bld', '444bld':'4bld', '555bld':'5bld', '333oh':'3oh',
  'r3ni':'3mbld', '333fm':'fmc', 'clkwca':'clock', 'clkwcab':'clock',
  'mgmp':'megaminx', 'pyrso':'pyraminx', 'skbso':'skewb', 'sqrs':'square 1', 'ftoso':'fto',
};

export interface ImportSolve {
  duration_ms:number;
  penalty:'OK'|'+2'|'DNF';
  started_at:string;
}
export interface ImportSession {
  id:string; name:string; solves:ImportSolve[]; selected:boolean; event:string;
  cube:string; cubeModelId:string|null; modelName:string; custom:string;
}
export class ImportError extends Error {}
const object = (value:unknown):value is Record<string,unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
function decode(value:unknown):unknown {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { throw new ImportError('invalid cstimer file'); }
}
export function validateImportFile(name:string, size:number):void {
  if (!/\.(txt|json)$/i.test(name)) throw new ImportError('choose a txt or json file');
  if (size > IMPORT_LIMITS.fileBytes) throw new ImportError('file exceeds 10 mib');
}
export function parseCstimer(text:string):ImportSession[] {
  if (new TextEncoder().encode(text).byteLength > IMPORT_LIMITS.fileBytes) throw new ImportError('file exceeds 10 mib');
  const data = decode(text.replace(/^\uFEFF/,''));
  if (!object(data)) throw new ImportError('invalid cstimer file');
  const keys = Object.keys(data).filter(key=>/^session[1-9]\d*$/.test(key));
  if (!keys.length) throw new ImportError('invalid cstimer file');
  keys.sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  // All other preferences and cached statistics are ignored.
  const properties = decode(data.properties ?? {});
  const metadata = object(properties) ? decode(properties.sessionData ?? {}) : {};
  let total = 0;
  const sessions:ImportSession[] = [];
  for (const key of keys) {
    const records = decode(data[key]);
    if (!Array.isArray(records)) throw new ImportError('invalid cstimer file');
    total += records.length;
    if (total > IMPORT_LIMITS.records) throw new ImportError('too many solves');
    if (!records.length) continue;
    const info = object(metadata) && object(metadata[key.slice(7)]) ? metadata[key.slice(7)] as Record<string,unknown> : {};
    const setting = object(info.opt) ? info.opt.scrType ?? info.scr : info.scr;
    const name = typeof info.name === 'string' && info.name.trim() ? info.name : typeof info.name === 'number' ? String(info.name) : key;
    const solves = records.map((record:unknown):ImportSolve => {
      if (!Array.isArray(record) || !Array.isArray(record[0]) || record[0].length < 2) throw new ImportError('invalid solve data');
      const [penalty,duration] = record[0];
      const timestamp = record[3];
      if (![0,2000,-1].includes(penalty) || !Number.isSafeInteger(duration) || duration < 0 ||
          !Number.isSafeInteger(timestamp) || timestamp < 0 || !Number.isFinite(new Date(timestamp * 1000).getTime())) throw new ImportError('invalid solve data');
      // Extra phases, scramble, comment and extensions never enter the preview.
      return {duration_ms:duration,penalty:penalty === -1 ? 'DNF' : penalty === 2000 ? '+2' : 'OK',started_at:new Date(timestamp * 1000).toISOString()};
    });
    sessions.push({id:key,name,solves,selected:true,event:typeof setting === 'string' && Object.hasOwn(CSTIMER_EVENTS,setting) ? CSTIMER_EVENTS[setting] : '',cube:'',cubeModelId:null,modelName:'',custom:''});
  }
  if (!sessions.length) throw new ImportError('no solves in file');
  return sessions;
}
