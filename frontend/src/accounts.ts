import { ApiError, request, type User } from './api/api';

export function setupAccounts(onChange: (user: User | null) => Promise<void>): { requireLogin: () => void } {
  const dialog = document.getElementById('account-dialog') as HTMLDialogElement;
  const form = document.getElementById('account-form') as HTMLFormElement;
  const username = document.getElementById('username') as HTMLInputElement;
  const password = document.getElementById('password') as HTMLInputElement;
  const submit = document.getElementById('account-submit') as HTMLButtonElement;
  const toggle = document.getElementById('account-toggle') as HTMLButtonElement;
  const message = document.getElementById('account-message') as HTMLElement;
  let registering = false;
  const showMessage = (text: string) => { message.hidden = false; message.textContent = text; };
  const requireLogin = () => {
    void onChange(null);
    if (!dialog.open) dialog.showModal();
  };
  dialog.addEventListener('cancel', event => event.preventDefault());
  toggle.addEventListener('click', () => {
    registering = !registering;
    const label = registering ? 'create account' : 'sign in';
    document.getElementById('account-heading')!.textContent = label;
    submit.textContent = label;
    toggle.textContent = registering ? 'sign in' : 'create account';
    password.autocomplete = registering ? 'new-password' : 'current-password';
    message.hidden = true;
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    submit.disabled = toggle.disabled = true;
    message.hidden = true;
    try {
      const user = await request<User>(`/api/auth/${registering ? 'register' : 'login'}`, { username: username.value, password: password.value });
      await onChange(user);
      password.value = '';
      dialog.close();
    } catch (error) {
      showMessage(error instanceof ApiError ? error.message : 'connection unavailable');
    } finally {
      submit.disabled = toggle.disabled = false;
    }
  });
  document.getElementById('logout')!.addEventListener('click', async () => {
    try {
      await request('/api/auth/logout', {});
      requireLogin();
    } catch {
      document.getElementById('storage-status')!.hidden = false;
      document.getElementById('storage-status')!.textContent = 'sign out unavailable';
    }
  });
  void request<User>('/api/auth/me').then(onChange).catch(error => {
    requireLogin();
    if (!(error instanceof ApiError && error.status === 401)) showMessage('connection unavailable');
  });
  return { requireLogin };
}
