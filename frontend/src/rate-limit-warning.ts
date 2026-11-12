import { ApiError } from './api/api';
import { t } from './i18n';

export function setupRateLimitWarning(): void {
  const dialog = document.querySelector<HTMLDialogElement>('#rate-limit-dialog')!;
  dialog.addEventListener('click', event => event.stopPropagation());
  dialog.addEventListener('keydown', event => {
    event.stopPropagation();
    if (event.key === 'Tab') event.preventDefault();
  });
}

export function showRateLimitWarning(error: unknown, returnFocus: HTMLElement): boolean {
  if (!(error instanceof ApiError) || error.status !== 429) return false;
  const dialog = document.querySelector<HTMLDialogElement>('#rate-limit-dialog')!;
  const message = document.getElementById('rate-limit-text')!;
  const seconds = error.retryAfter;
  message.textContent = seconds === null ? t('too many requests try again shortly')
    : seconds === 1 ? t('too many requests try again in 1 second')
    : t('too many requests try again in {seconds} seconds').replace('{seconds}', String(seconds));
  if (!dialog.open) {
    dialog.addEventListener('close', () => returnFocus.focus({preventScroll:true}), {once:true});
    dialog.showModal();
  }
  return true;
}
