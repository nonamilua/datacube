import { parseCstimer, validateImportFile, ImportError, type ImportSession } from './cstimer';
import { CubeSelector } from '../cube-selector';
import { bindShortText, validateShortText } from '../text-fields';
import { scrambleEvents } from '../scrambles';
import { icon } from '../icons';
import { t, setText, setActionLabel, onLanguageChange } from '../i18n';

export function setupAccountTools(canOpen:()=>boolean) {
  const get = <T extends HTMLElement>(id:string) => document.getElementById(id) as T;
  const settings = get<HTMLDetailsElement>('settings-panel');
  const dialog = get<HTMLDialogElement>('import-dialog');
  const about = get<HTMLDialogElement>('about-dialog');
  const file = get<HTMLInputElement>('import-file');
  const next = get<HTMLButtonElement>('import-next');
  const back = get<HTMLButtonElement>('import-back');
  const message = get('import-message');
  let sessions:ImportSession[] = [], active:ImportSession|null = null;
  let step = 0, revision = 0, loading = false, restoreSettings = true;
  let editorRevision = 0, selectorReady = false;
  let fileName = '';
  const rows = new Map<string,{body:HTMLElement;button:HTMLButtonElement}>();
  const editor = document.createElement('div'); editor.className = 'import-session-fields';
  function field(key:string, input:HTMLElement):HTMLLabelElement {
    const label = document.createElement('label'); label.className = 'setting-field';
    const name = document.createElement('span'); setText(name,key);
    label.append(name,input); return label;
  }
  const event = document.createElement('select'); event.required = true;
  event.append(new Option(t('choose event'),''),...Object.keys(scrambleEvents).map(name=>new Option(name,name)));
  const cube = document.createElement('input'); cube.maxLength = 12; cube.autocomplete = 'off';
  cube.setAttribute('role','combobox'); cube.setAttribute('aria-autocomplete','list');
  cube.setAttribute('aria-controls','import-cube-suggestions');
  const cubeField = field('cube label',cube); cubeField.classList.add('cube-handle-field');
  const suggestions = document.createElement('div'); suggestions.id = 'import-cube-suggestions';
  suggestions.className = 'cube-suggestions'; suggestions.role = 'listbox'; suggestions.hidden = true;
  cubeField.append(suggestions);
  const cubeError = document.createElement('p'); cubeError.className = 'validation-message'; cubeError.hidden = true;
  const model = document.createElement('output'); model.className = 'import-model-name';
  const warning = document.createElement('span'); warning.className = 'import-model-warning';
  const modelField = document.createElement('div'); modelField.className = 'setting-field';
  const modelLabel = document.createElement('span'); setText(modelLabel,'model name');
  modelField.append(modelLabel,model,warning);
  const custom = document.createElement('input'); custom.maxLength = 12; custom.autocomplete = 'off';
  const customError = document.createElement('p'); customError.className = 'validation-message'; customError.hidden = true;
  editor.append(field('event',event),cubeField,cubeError,modelField,field('custom tag',custom),customError);
  const selector = new CubeSelector(cube,model,suggestions,warning,cubeError);
  bindShortText(cube,cubeError); bindShortText(custom,customError);

  function commit() {
    if (!active) return;
    active.cube = cube.value; active.custom = custom.value;
    if (selectorReady) { active.cubeModelId = selector.modelId; active.modelName = selector.modelId ? model.value : ''; }
  }
  function valid():boolean {
    return sessions.some(session=>session.selected) && sessions.filter(session=>session.selected).every(session=>session.event && session.cube.length<=12 && session.custom.length<=12 && !/[\u0000-\u001f\u007f]/.test(session.cube+session.custom));
  }
  function buttons() {
    back.hidden = step === 0;
    next.hidden = step === 2;
    next.disabled = loading || !sessions.length || step === 1 && !valid();
    get('import-final').hidden = step !== 2;
    if (step === 1) {
      const selected = sessions.filter(session=>session.selected);
      const error = !selected.length ? 'select a session' : selected.some(session=>!session.event) ? 'choose an event for each selected session' : '';
      setText(message,error); message.hidden = !error;
    }
  }
  function activate(session:ImportSession|null) {
    commit(); selector.close();
    for (const row of rows.values()) { row.body.hidden = true; row.button.setAttribute('aria-expanded','false'); }
    active = session;
    const currentEditorRevision = ++editorRevision;
    selectorReady = false;
    if (session) {
      const row = rows.get(session.id)!;
      row.body.append(editor); row.body.hidden = false; row.button.setAttribute('aria-expanded','true');
      for (const label of Array.from(editor.querySelectorAll<HTMLElement>('[data-i18n]'))) setText(label,label.dataset.i18n!);
      event.value = session.event; cube.value = session.cube; custom.value = session.custom;
      validateShortText(cube,cubeError); validateShortText(custom,customError);
      void selector.configure(session.event,session.cubeModelId).then(()=> {
        if (currentEditorRevision !== editorRevision) return;
        selectorReady = true; commit();
      });
    } else { void selector.configure(''); editor.remove(); }
  }
  event.addEventListener('change',()=> {
    if (!active) return;
    active.event = event.value; active.cube = ''; active.cubeModelId = null; active.modelName = '';
    cube.value = ''; validateShortText(cube,cubeError); void selector.configure(event.value);
    buttons();
  });
  for (const input of [cube,custom]) input.addEventListener('input',()=> {
    if (input === cube && active) { active.cubeModelId = null; active.modelName = ''; }
    commit(); buttons();
  });
  editor.addEventListener('click',()=> { commit(); buttons(); });
  function buildSessions() {
    activate(null); rows.clear();
    get('import-sessions').replaceChildren(...sessions.map(session=> {
      const row = document.createElement('div'); row.className = 'import-session';
      const heading = document.createElement('div'); heading.className = 'import-session-heading';
      const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = session.selected;
      checkbox.setAttribute('aria-label',session.name);
      const checkLabel = document.createElement('label'); checkLabel.className = 'import-session-check'; checkLabel.append(checkbox);
      const button = document.createElement('button'); button.type = 'button'; button.className = 'import-session-toggle';
      const name = document.createElement('span'); name.className = 'import-session-name'; name.textContent = session.name; name.title = session.name;
      const count = document.createElement('span'); count.className = 'import-session-count'; count.textContent = `${session.solves.length} ${t('solves')}`;
      button.append(name,count); button.setAttribute('aria-expanded','false'); button.disabled = !session.selected;
      const body = document.createElement('div'); body.id = `import-${session.id}`; body.hidden = true;
      button.setAttribute('aria-controls',body.id);
      rows.set(session.id,{body,button}); heading.append(checkLabel,button); row.append(heading,body);
      button.addEventListener('click',()=>activate(active===session?null:session));
      checkbox.addEventListener('change',()=> {
        session.selected = checkbox.checked; button.disabled = !session.selected;
        if (active === session && !session.selected) activate(null);
        if (session.selected) activate(session);
        buttons();
      });
      return row;
    }));
    activate(sessions.find(session=>session.selected) ?? null);
  }
  function review() {
    const selected = sessions.filter(session=>session.selected);
    get('import-total').textContent = `${selected.length} ${t('sessions')} ${selected.reduce((total,session)=>total+session.solves.length,0)} ${t('solves')}`;
    get('import-review').replaceChildren(...selected.map(session=> {
      const row = document.createElement('div'); row.className = 'import-review-row';
      const name = document.createElement('strong'); name.textContent = session.name;
      const count = document.createElement('span'); count.textContent = `${session.solves.length} ${t('solves')}`;
      const assignment = document.createElement('span');
      assignment.textContent = `${t('event')} ${session.event}  ${t('cube label')} ${session.cube || t('none')}  ${t('custom tag')} ${session.custom || t('none')}`;
      row.append(name,count,assignment);
      if (session.modelName) { const fullModel = document.createElement('span'); fullModel.className = 'import-model-name'; fullModel.textContent = session.modelName; row.append(fullModel); }
      return row;
    }));
  }
  function showStep() {
    for (const [index,id] of ['import-file-step','import-config-step','import-review-step'].entries()) get(id).hidden = step!==index;
    setText(get('import-step-heading'),['choose file','configure sessions','review'][step]);
    const filename = get('import-filename'); filename.hidden = !fileName; filename.textContent = fileName;
    buttons();
    if (step === 2) review();
  }
  file.addEventListener('change',async()=> {
    const selected = file.files?.[0]; if (!selected) return;
    const currentRevision = ++revision;
    activate(null); sessions = []; fileName = ''; get('import-sessions').replaceChildren(); rows.clear(); message.hidden = true;
    loading = true; buttons();
    try {
      validateImportFile(selected.name,selected.size);
      const parsed = parseCstimer(await selected.text());
      if (currentRevision !== revision || !dialog.open) return;
      sessions = parsed; fileName = selected.name;
    } catch (error) {
      if (currentRevision !== revision || !dialog.open) return;
      setText(message,error instanceof ImportError ? error.message : 'file unavailable'); message.hidden = false;
    } finally {
      if (currentRevision === revision) { loading = false; showStep(); }
    }
  });
  next.addEventListener('click',()=> {
    commit();
    if (!sessions.length || step===1 && !valid()) return;
    step++; message.hidden = true;
    if (step===1) buildSessions(); else selector.close();
    showStep(); focusStep(); get('import-step-heading').scrollIntoView({block:'nearest'});
  });
  back.addEventListener('click',()=> { commit(); step--; message.hidden = true; showStep(); focusStep(); });

  function focusStep() {
    const control = step === 0 ? file : step === 1 ? get('import-sessions').querySelector<HTMLInputElement>('input[type="checkbox"]') : back;
    (control ?? dialog).focus({preventScroll:true});
  }

  function resetDraft() {
    revision++; loading = false; activate(null); sessions = []; rows.clear(); step = 0; fileName = '';
    file.value = ''; message.hidden = true; get('import-sessions').replaceChildren(); get('import-review').replaceChildren(); showStep();
  }
  function modal(target:HTMLDialogElement, triggerId:string) {
    const trigger = get<HTMLButtonElement>(triggerId);
    trigger.addEventListener('click',()=> {
      if (!canOpen() || document.querySelector('dialog[open]')) return;
      if (target === dialog) resetDraft();
      restoreSettings = true; target.showModal();
      if (target === dialog) focusStep(); else target.querySelector<HTMLAnchorElement>('a')!.focus();
    });
    target.addEventListener('cancel',event=> { event.preventDefault(); target.close(); });
    target.addEventListener('close',()=> {
      if (target===dialog) resetDraft();
      if (restoreSettings && !document.querySelector('dialog[open]')) { settings.open = true; trigger.focus({preventScroll:true}); }
    });
    target.addEventListener('click',event=> {
      event.stopPropagation(); const rect = target.getBoundingClientRect();
      if (event.target===target && (event.clientX<rect.left || event.clientX>rect.right || event.clientY<rect.top || event.clientY>rect.bottom)) target.close();
    });
    target.addEventListener('keydown',event=> {
      event.stopPropagation();
      if (event.key!=='Tab') return;
      const controls = Array.from(target.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href]')).filter(el=>el.getClientRects().length);
      const first = controls[0], last = controls.at(-1);
      if (!first || !last) { event.preventDefault(); target.focus(); }
      else if (event.shiftKey && (document.activeElement===first || document.activeElement===target)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement===last) { event.preventDefault(); first.focus(); }
    });
  }
  modal(dialog,'open-import'); modal(about,'open-about');
  for (const [id,name] of [['open-import','import'],['export-placeholder','export'],['open-about','about']] as const) {
    get(id).append(icon(name)); setActionLabel(get(id),name);
  }
  onLanguageChange(()=> {
    setText(modelLabel,'model name'); event.options[0].textContent = t('choose event');
    if (dialog.open) { commit(); showStep(); if (step===1) buildSessions(); }
  });
  showStep();
  return {reset() { restoreSettings = false; if (dialog.open) dialog.close(); if (about.open) about.close(); resetDraft(); }};
}
