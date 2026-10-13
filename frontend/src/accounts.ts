import { ApiError, request, type User } from './api/api';
import { setText, onLanguageChange } from './i18n';
import { setupLogoutConfirmation } from './logout-confirmation';
import { setupOnboarding } from './onboarding';

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
  };
  onLanguageChange(updateMode);
  toggle.addEventListener('click', () => {
    registering = !registering;
    updateMode();
    message.hidden = true;
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
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
