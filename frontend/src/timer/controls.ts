import { SolveTimer, type Solve } from './timer.ts';

export function bindControls(timer: SolveTimer, area: HTMLElement, onSolve: (solve: Solve) => void, options: {canPrepare?: () => boolean; onStart?: () => void} = {}): void {
  let owner: 'keyboard' | number | null = null;
  const stop = () => { const solve = timer.stop(); if (solve) onSolve(solve); };
  const cancel = () => { owner = null; timer.cancelPreparation(); };
  const release = () => {
    if (options.canPrepare && !options.canPrepare()) { timer.cancelPreparation(); return; }
    timer.release();
    if (timer.state === 'RUNNING') options.onStart?.();
  };
  const isEditable = (target: EventTarget | null) => target instanceof Element && Boolean(target.closest('input, select, textarea, [contenteditable], summary, a, button:not(#timer-area)'));

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') area.setAttribute('data-keyboard-focus', '');
    if (area instanceof HTMLButtonElement && area.disabled) return;
    if (area.closest('[hidden]')) return;
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || isEditable(event.target)) return;
    if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab', 'Escape'].includes(event.key) || event.key.startsWith('F') && /^F\d+$/.test(event.key)) return;
    if (timer.state === 'RUNNING') {
      if (event.code === 'Space') event.preventDefault();
      stop();
    } else if (event.code === 'Space' && owner === null) {
      event.preventDefault();
      if (options.canPrepare && !options.canPrepare()) return;
      owner = 'keyboard';
      timer.prepare();
    }
  });
  window.addEventListener('keyup', (event) => {
    if (event.code !== 'Space' || owner !== 'keyboard') return;
    event.preventDefault();
    owner = null;
    if (event.ctrlKey || event.metaKey || event.altKey) timer.cancelPreparation();
    else release();
  });
  area.addEventListener('pointerdown', (event) => {
    if (area instanceof HTMLButtonElement && area.disabled) return;
    if (!event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    area.removeAttribute('data-keyboard-focus');
    area.focus({ preventScroll: true });
    if (timer.state === 'RUNNING') { stop(); return; }
    if (owner !== null) return;
    if (options.canPrepare && !options.canPrepare()) return;
    owner = event.pointerId;
    area.setPointerCapture(event.pointerId);
    timer.prepare();
  });
  area.addEventListener('pointerup', (event) => {
    if (owner !== event.pointerId) return;
    owner = null;
    release();
  });
  area.addEventListener('pointercancel', cancel);
  area.addEventListener('lostpointercapture', () => { if (typeof owner === 'number') cancel(); });
  window.addEventListener('blur', cancel);
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancel(); });
}
