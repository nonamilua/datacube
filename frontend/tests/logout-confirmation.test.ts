import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setupLogoutConfirmation } from '../src/logout-confirmation.ts';
import { setLanguage } from '../src/i18n.ts';

function fixture() {
  const previous = globalThis.document;
  const elements = new Map<string, Control>();
  const document = {activeElement:null as Control|null,getElementById:(id:string) => elements.get(id)};
  class Control extends EventTarget {
    disabled = false; open = false; hidden = true; textContent = ''; dataset = {};
    attributes = new Map<string,string>();
    focus() { document.activeElement = this; }
    showModal() { this.open = true; }
    close() { this.open = false; this.dispatchEvent(new Event('close')); }
    click() { if (!this.disabled) this.dispatchEvent(new Event('click')); }
    setAttribute(name:string,value:string) { this.attributes.set(name,value); }
    removeAttribute(name:string) { this.attributes.delete(name); }
    getBoundingClientRect() { return {left:100,right:300,top:100,bottom:200}; }
  }
  for (const id of ['logout','logout-confirmation','logout-cancel','logout-confirm','logout-message']) elements.set(id,new Control());
  globalThis.document = document as unknown as Document;
  return {get:(id:string) => elements.get(id)!,document,restore:() => { globalThis.document = previous; setLanguage('en'); }};
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('opening does not log out and cancel Escape and backdrop restore trigger focus',() => {
  const f = fixture(); let requests = 0;
  try {
    setupLogoutConfirmation(async () => { requests++; },() => assert.fail('unexpected cleanup'));
    const trigger = f.get('logout'), dialog = f.get('logout-confirmation'), cancel = f.get('logout-cancel');
    for (const dismiss of [() => cancel.click(),() => dialog.dispatchEvent(new Event('cancel',{cancelable:true})),() => dialog.dispatchEvent(Object.assign(new Event('click'),{clientX:20,clientY:20}))]) {
      trigger.click(); assert.equal(dialog.open,true); assert.equal(f.document.activeElement,cancel);
      dismiss(); assert.equal(dialog.open,false); assert.equal(f.document.activeElement,trigger);
    }
    assert.equal(requests,0);
  } finally { f.restore(); }
});

test('Tab and shift Tab wrap between the confirmation buttons',() => {
  const f = fixture();
  try {
    setupLogoutConfirmation(async () => {},() => {}); f.get('logout').click();
    const dialog = f.get('logout-confirmation'), cancel = f.get('logout-cancel'), confirm = f.get('logout-confirm');
    const key = (shiftKey:boolean) => Object.assign(new Event('keydown',{cancelable:true}),{key:'Tab',shiftKey});
    const backwards = key(true); dialog.dispatchEvent(backwards);
    assert.equal(backwards.defaultPrevented,true); assert.equal(f.document.activeElement,confirm);
    const forwards = key(false); dialog.dispatchEvent(forwards);
    assert.equal(forwards.defaultPrevented,true); assert.equal(f.document.activeElement,cancel);
  } finally { f.restore(); }
});

test('confirmation prevents duplicates retains localized failures and only cleans up after success',async () => {
  const f = fixture(); let requests = 0, cleanups = 0;
  let reject!: (error:Error) => void, resolve!: () => void;
  try {
    setLanguage('pt-BR');
    setupLogoutConfirmation(() => { requests++; return new Promise<void>((yes,no) => {resolve=yes; reject=no;}); },() => {cleanups++;});
    const dialog = f.get('logout-confirmation'), confirm = f.get('logout-confirm'), cancel = f.get('logout-cancel');
    f.get('logout').click(); confirm.click(); confirm.dispatchEvent(new Event('click'));
    assert.equal(requests,1); assert.equal(cancel.disabled,true); assert.equal(confirm.disabled,true);
    dialog.dispatchEvent(new Event('cancel',{cancelable:true})); assert.equal(dialog.open,true);
    reject(new Error('offline')); await tick();
    assert.equal(cleanups,0); assert.equal(dialog.open,true); assert.equal(confirm.disabled,false);
    assert.equal(f.get('logout-message').hidden,false); assert.equal(f.get('logout-message').textContent,'não foi possível sair');
    assert.equal(f.document.activeElement,cancel);
    confirm.click(); resolve(); await tick();
    assert.equal(requests,2); assert.equal(cleanups,1); assert.equal(dialog.open,false);
  } finally { f.restore(); }
});
