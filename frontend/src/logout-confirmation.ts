import { setText } from './i18n.ts';

export function setupLogoutConfirmation(logout: () => Promise<void>, onSuccess: () => void): void {
  const trigger = document.getElementById('logout') as HTMLButtonElement;
  const dialog = document.getElementById('logout-confirmation') as HTMLDialogElement;
  const cancel = document.getElementById('logout-cancel') as HTMLButtonElement;
  const confirm = document.getElementById('logout-confirm') as HTMLButtonElement;
  const message = document.getElementById('logout-message')!;
  let processing = false;

  function dismiss() { if (!processing) dialog.close(); }
  trigger.addEventListener('click',() => {
    if (dialog.open || processing || document.getElementById('onboarding-dialog')?.hasAttribute('open')) return;
    message.hidden = true;
    dialog.showModal();
    cancel.focus();
  });
  cancel.addEventListener('click',dismiss);
  dialog.addEventListener('close',() => trigger.focus({preventScroll:true}));
  dialog.addEventListener('cancel',event => {
    event.preventDefault();
    dismiss();
  });
  dialog.addEventListener('click',event => {
    // Keep settings open so cancellation can return focus to its sign-out button.
    event.stopPropagation();
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dismiss();
  });
  dialog.addEventListener('keydown',event => {
    event.stopPropagation();
    if (event.key !== 'Tab') return;
    const buttons = [cancel,confirm].filter(button => !button.disabled);
    if (!buttons.length) { event.preventDefault(); return; }
    const first = buttons[0], last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  confirm.addEventListener('click',async () => {
    if (processing) return;
    processing = true;
    cancel.disabled = confirm.disabled = true;
    dialog.setAttribute('aria-busy','true');
    dialog.focus();
    message.hidden = true;
    let succeeded = false;
    try {
      await logout();
      succeeded = true;
    } catch {
      setText(message,'sign out unavailable');
      message.hidden = false;
    } finally {
      processing = false;
      cancel.disabled = confirm.disabled = false;
      dialog.removeAttribute('aria-busy');
    }
    if (succeeded) { dialog.close(); onSuccess(); }
    else cancel.focus();
  });
}
