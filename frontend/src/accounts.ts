import { ApiError, request, type User } from './api/api';
import { setText, onLanguageChange } from './i18n';
import { setupLogoutConfirmation } from './logout-confirmation';
import { setupOnboarding } from './onboarding';
import { USERNAME_LIMITS, usernameError, passwordError } from './account-validation';

export function setupAccounts(onChange: (user: User | null) => Promise<void>): { requireLogin: () => void } {
  const dialog = document.getElementById('account-dialog') as HTMLDialogElement;
  const form = document.getElementById('account-form') as HTMLFormElement;
  const username = document.getElementById('username') as HTMLInputElement;
  const password = document.getElementById('password') as HTMLInputElement;
  const submit = document.getElementById('account-submit') as HTMLButtonElement;
  const toggle = document.getElementById('account-toggle') as HTMLButtonElement;
  const message = document.getElementById('account-message') as HTMLElement;
  let registering = false;
  let revision = 0;
  const onboarding = setupOnboarding(async user => {
    const response = await fetch('/api/auth/onboarding', {method:'POST',headers:{'X-Namicubes-Request':'1','X-Namicubes-Account':String(user.id)},signal:AbortSignal.timeout(10000)});
    if (!response.ok) throw new Error('acknowledgment failed');
  });
  const showMessage = (text: string) => { message.hidden = false; setText(message,text); };
  let validationMessage = false;
  function validate(input:HTMLInputElement):string {
    const error = input === username ? usernameError(input.value,registering) : passwordError(input.value);
    input.setAttribute('aria-invalid',String(Boolean(error)));
    return error;
  }
  for (const input of [username,password]) {
    input.addEventListener('blur',()=> {
      if (!input.value) return;
      const error = validate(input);
      if (error) { validationMessage = true; showMessage(error); }
    });
    input.addEventListener('input',()=> {
      const error = validate(input);
      if (validationMessage) {
        if (error) showMessage(error);
        else { message.hidden = true; validationMessage = false; }
      }
    });
    function rejectLongInput(text:string|null) {
      if (!text) return false;
      const length = input.value.length - ((input.selectionEnd ?? 0) - (input.selectionStart ?? 0)) + text.length;
      if (length <= input.maxLength) return false;
      validationMessage = true;
      showMessage(input === username ? registering ? 'username must contain 3 to 16 characters' : 'username must contain 3 to 32 characters' : 'password must contain 8 to 128 characters');
      return true;
    }
    input.addEventListener('beforeinput',event=> {
      if (!event.inputType.startsWith('delete') && rejectLongInput(event.data)) event.preventDefault();
    });
    input.addEventListener('paste',event=> {
      if (rejectLongInput(event.clipboardData?.getData('text/plain') ?? null)) event.preventDefault();
    });
  }
  const requireLogin = () => {
    revision++; onboarding.reset();
    void onChange(null);
    if (!dialog.open) dialog.showModal();
  };
  dialog.addEventListener('cancel', event => event.preventDefault());
  const updateMode = () => {
    const label = registering ? 'create account' : 'sign in';
    setText(document.getElementById('account-heading')!,label);
    setText(submit,label);
    setText(toggle,registering ? 'sign in' : 'create account');
    password.autocomplete = registering ? 'new-password' : 'current-password';
    username.maxLength = registering ? USERNAME_LIMITS.registration : USERNAME_LIMITS.login;
  };
  onLanguageChange(updateMode);
  toggle.addEventListener('click', () => {
    registering = !registering;
    updateMode();
    message.hidden = true;
    validationMessage = false;
    username.removeAttribute('aria-invalid'); password.removeAttribute('aria-invalid');
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const nameError = validate(username), secretError = validate(password);
    if (nameError || secretError) {
      validationMessage = true; showMessage(nameError || secretError);
      (nameError ? username : password).focus();
      return;
    }
    validationMessage = false;
    submit.disabled = toggle.disabled = true;
    message.hidden = true;
    try {
      const currentRevision = ++revision;
      const user = await request<User>(`/api/auth/${registering ? 'register' : 'login'}`, { username: username.value, password: password.value });
      await onChange(user);
      if (currentRevision !== revision) return;
      password.value = '';
      dialog.close();
      onboarding.show(user);
    } catch (error) {
      showMessage(error instanceof ApiError ? error.message : 'connection unavailable');
    } finally {
      submit.disabled = toggle.disabled = false;
    }
  });
  setupLogoutConfirmation(() => request<void>('/api/auth/logout', {}),requireLogin);
  const initialRevision = revision;
  void request<User>('/api/auth/me').then(async user => {
    if (initialRevision !== revision) return;
    await onChange(user);
    if (initialRevision === revision) onboarding.show(user);
  }).catch(error => {
    if (initialRevision !== revision) return;
    requireLogin();
    if (!(error instanceof ApiError && error.status === 401)) showMessage('connection unavailable');
  });
  return { requireLogin };
}
