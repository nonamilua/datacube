import { SolveTimer, type Solve } from './timer';

export function bindControls(timer: SolveTimer, area: HTMLElement, onSolve: (solve: Solve) => void): void {
  let owner: 'keyboard' | number | null = null;
  const stop = () => { const solve = timer.stop(); if (solve) onSolve(solve); };
  const cancel = () => { owner = null; timer.cancelPreparation(); };
  const isEditable = (target: EventTarget | null) => target instanceof Element && Boolean(target.closest('input, select, textarea, [contenteditable], summary, a, button:not(#timer-area)'));

  window.addEventListener('keydown', (event) => {
    if (area.closest('[hidden]')) return;
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || isEditable(event.target)) return;
    if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab', 'Escape'].includes(event.key) || event.key.startsWith('F') && /^F\d+$/.test(event.key)) return;
    if (timer.state === 'RUNNING') {
      if (event.code === 'Space') event.preventDefault();
      stop();
    } else if (event.code === 'Space' && owner === null) {
      event.preventDefault();
      owner = 'keyboard';
      timer.prepare();
    }
  });
  window.addEventListener('keyup', (event) => {
    if (event.code !== 'Space' || owner !== 'keyboard') return;
    event.preventDefault();
    owner = null;
    if (event.ctrlKey || event.metaKey || event.altKey) timer.cancelPreparation();
    else timer.release();
  });
  area.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    area.focus({ preventScroll: true });
    if (timer.state === 'RUNNING') { stop(); return; }
    if (owner !== null) return;
    owner = event.pointerId;
    area.setPointerCapture(event.pointerId);
    timer.prepare();
  });
  area.addEventListener('pointerup', (event) => {
    if (owner !== event.pointerId) return;
    owner = null;
    timer.release();
  });
  area.addEventListener('pointercancel', cancel);
  area.addEventListener('lostpointercapture', () => { if (typeof owner === 'number') cancel(); });
  window.addEventListener('blur', cancel);
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancel(); });
}
