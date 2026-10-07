export function validateShortText(input: HTMLInputElement, status: HTMLElement): boolean {
  const tooLong = input.value.length > 10;
  const controls = /[\u0000-\u001f\u007f]/.test(input.value);
  input.setAttribute('aria-invalid', String(tooLong || controls));
  status.hidden = !tooLong && !controls;
  status.textContent = tooLong ? 'cannot exceed 10 characters' : controls ? 'use plain text' : '';
  return !tooLong && !controls;
}

export function bindShortText(input: HTMLInputElement, status: HTMLElement): void {
  input.addEventListener('beforeinput', event => {
    if (!event.data || event.inputType.startsWith('delete')) return;
    const selected = (input.selectionEnd ?? 0) - (input.selectionStart ?? 0);
    if (input.value.length - selected + event.data.length > 10) {
      event.preventDefault();
      status.textContent = 'cannot exceed 10 characters';
      status.hidden = false;
    }
  });
  input.addEventListener('input', () => {
    const normalized = input.value.toLowerCase();
    if (normalized !== input.value) input.value = normalized;
    validateShortText(input, status);
  });
}
