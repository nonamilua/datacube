import { setText } from './i18n';

export function validateShortText(input: HTMLInputElement, status: HTMLElement): boolean {
  const tooLong = input.value.length > 12;
  const controls = /[\u0000-\u001f\u007f]/.test(input.value);
  input.setAttribute('aria-invalid', String(tooLong || controls));
  status.hidden = !tooLong && !controls;
  setText(status, tooLong ? 'cannot exceed 12 characters' : controls ? 'use plain text' : '');
  return !tooLong && !controls;
}

export function bindShortText(input: HTMLInputElement, status: HTMLElement): void {
  input.addEventListener('beforeinput', event => {
    if (!event.data || event.inputType.startsWith('delete')) return;
    const selected = (input.selectionEnd ?? 0) - (input.selectionStart ?? 0);
    if (input.value.length - selected + event.data.length > 12) {
      event.preventDefault();
      setText(status, 'cannot exceed 12 characters');
      status.hidden = false;
    }
  });
  input.addEventListener('input', () => {
    const normalized = input.value.toLowerCase();
    if (normalized !== input.value) input.value = normalized;
    validateShortText(input, status);
  });
}
