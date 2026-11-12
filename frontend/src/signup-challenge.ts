import { request } from './api/api';
import { currentLanguage, setText } from './i18n';

type Turnstile = {
  render(container: HTMLElement, options: Record<string, unknown>): string;
  remove(widget: string): void;
};

let scriptLoad: Promise<Turnstile> | undefined;

function loadTurnstile(): Promise<Turnstile> {
  if (!scriptLoad) {
    scriptLoad = new Promise<Turnstile>((resolve, reject) => {
      const script = document.createElement('script');
      const failed = () => {
        clearTimeout(timeout);
        script.remove();
        reject(new Error('Turnstile could not load'));
      };
      const timeout = window.setTimeout(failed, 10000);
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.onerror = failed;
      script.onload = () => {
        const api = (window as Window & { turnstile?: Turnstile }).turnstile;
        if (!api) { failed(); return; }
        clearTimeout(timeout);
        resolve(api);
      };
      document.head.append(script);
    }).catch(error => {
      scriptLoad = undefined;
      throw error;
    });
  }
  return scriptLoad;
}

export function setupSignupChallenge() {
  const section = document.getElementById('signup-challenge')!;
  const container = document.getElementById('signup-widget')!;
  const message = document.getElementById('signup-challenge-message')!;
  const retry = document.getElementById('signup-challenge-retry') as HTMLButtonElement;
  let api: Turnstile | undefined;
  let widget: string | undefined;
  let revision = 0;
  // Null means the server explicitly disabled Turnstile. Undefined means no usable token yet.
  let token: string | null | undefined;

  function notice(key: string, canRetry = false) {
    setText(message, key);
    message.hidden = false;
    retry.hidden = !canRetry;
  }

  function close() {
    revision++;
    if (widget !== undefined) api?.remove(widget);
    widget = undefined;
    token = undefined;
    section.hidden = true;
  }

  async function open() {
    close();
    const current = revision;
    section.hidden = false;
    notice('loading security check');
    try {
      const {sitekey} = await request<{sitekey: string | null}>('/api/auth/turnstile');
      if (current !== revision) return;
      if (sitekey === null) { token = null; section.hidden = true; return; }
      if (typeof sitekey !== 'string' || !sitekey) throw new Error('Missing Turnstile site key');
      api = await loadTurnstile();
      if (current !== revision) return;
      notice('complete the security check');
      const invalidate = (key: string) => {
        if (current !== revision) return;
        token = undefined;
        notice(key, true);
      };
      widget = api.render(container, {
        sitekey, action:'register', theme:'dark', language:currentLanguage(),
        size:container.clientWidth < 300 ? 'compact' : 'flexible',
        'response-field':false, retry:'never', 'refresh-expired':'manual', 'refresh-timeout':'manual',
        callback(value: string) {
          if (current !== revision) return;
          token = value;
          message.hidden = retry.hidden = true;
        },
        'expired-callback': () => invalidate('security check expired or already used try again'),
        'timeout-callback': () => invalidate('security check expired or already used try again'),
        'error-callback': () => { invalidate('security check unavailable try again'); return true; },
        'unsupported-callback': () => invalidate('security check unavailable try again'),
      });
    } catch {
      if (current === revision) notice('security check unavailable try again', true);
    }
  }

  retry.addEventListener('click', () => void open());
  return {
    open, close, get token() { return token; },
    failed(key: string) { close(); section.hidden = false; notice(key, true); },
  };
}
