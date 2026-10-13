import type { User } from './api/api';
import { setText } from './i18n';

export function setupOnboarding(acknowledge:(user:User) => Promise<void>) {
  const dialog = document.getElementById('onboarding-dialog') as HTMLDialogElement;
  const later = document.getElementById('onboarding-later') as HTMLButtonElement;
  const settingsButton = document.getElementById('onboarding-settings') as HTMLButtonElement;
  const message = document.getElementById('onboarding-message')!;
  let account:User|null = null, processing = false;
  let returnFocus:HTMLElement|null = null;
  async function dismiss(openSettings=false) {
    if (!account || processing) return;
    const current = account;
    processing = true; later.disabled = settingsButton.disabled = true;
    dialog.setAttribute('aria-busy','true'); dialog.focus(); message.hidden = true;
    try {
      await acknowledge(current);
      if (account !== current) return;
      current.onboarding_acknowledged = true;
      dialog.close(); account = null;
      if (openSettings) {
        const settings = document.getElementById('settings-panel') as HTMLDetailsElement;
        if (!settings.open) settings.querySelector<HTMLElement>('summary')!.click();
        settings.querySelector<HTMLElement>('summary')!.focus({preventScroll:true});
      } else returnFocus?.focus({preventScroll:true});
    } catch {
      if (account !== current) return;
      setText(message,'connection unavailable'); message.hidden = false;
    } finally {
      processing = false; later.disabled = settingsButton.disabled = false;
      dialog.removeAttribute('aria-busy');
      if (dialog.open && account === current) later.focus();
    }
  }
  later.addEventListener('click',() => void dismiss());
  settingsButton.addEventListener('click',() => void dismiss(true));
  dialog.addEventListener('cancel',event => { event.preventDefault(); void dismiss(); });
  dialog.addEventListener('click',event => {
    event.stopPropagation();
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) void dismiss();
  });
  dialog.addEventListener('keydown',event => {
    event.stopPropagation();
    if (event.key !== 'Tab') return;
    if (processing) { event.preventDefault(); return; }
    if (event.shiftKey && document.activeElement === later) { event.preventDefault(); settingsButton.focus(); }
    else if (!event.shiftKey && document.activeElement === settingsButton) { event.preventDefault(); later.focus(); }
  });
  return {
    show(user:User) {
      if (user.onboarding_acknowledged !== false || dialog.open || document.getElementById('logout-confirmation')!.hasAttribute('open')) return;
      account = user;
      const focused = document.activeElement as HTMLElement|null;
      returnFocus = !focused || focused === document.body || focused.closest('dialog:not([open])') ? document.getElementById('timer-tab') : focused;
      message.hidden = true; dialog.showModal(); later.focus();
    },
    reset() { account = null; if (dialog.open) dialog.close(); },
  };
}
