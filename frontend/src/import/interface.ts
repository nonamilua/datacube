import { decodeImportFile, parseCstimerData, validateImportFile, validateImportFilename, IMPORT_LIMITS, ImportError, type ImportSession } from './cstimer';
import { CubeSelector } from '../cube-selector';
import { bindShortText, validateShortText } from '../text-fields';
import { scrambleEvents } from '../scrambles';
import { icon } from '../icons';
import { t, setText, setActionLabel, onLanguageChange } from '../i18n';
import { ApiError, SOLVE_LIMIT_REACHED, type User } from '../api/api';
import { saveImport, type ImportResult } from './client';
import { downloadBackup, fetchBackup, isDatacubeBackup, restoreBackup } from './backup';
import { showRateLimitWarning } from '../rate-limit-warning';

export function setupAccountTools(canOpen:()=>boolean, account:()=>User|null, onImported:(accountId:number)=>Promise<void>) {
  const get = <T extends HTMLElement>(id:string) => document.getElementById(id) as T;
  const settings = get<HTMLDetailsElement>('settings-panel');
  const dialog = get<HTMLDialogElement>('import-dialog');
  const about = get<HTMLDialogElement>('about-dialog');
  const exportDialog = get<HTMLDialogElement>('export-dialog');
  const exportCancel = get<HTMLButtonElement>('export-cancel');
  const exportDownload = get<HTMLButtonElement>('export-download');
  const exportMessage = get('export-message');
  const file = get<HTMLInputElement>('import-file');
  const next = get<HTMLButtonElement>('import-next');
  const back = get<HTMLButtonElement>('import-back');
  const message = get('import-message');
  const choose = get<HTMLButtonElement>('import-choose-file');
  choose.append(icon('folder'));
  setActionLabel(choose,'choose file');
  const save = get<HTMLButtonElement>('import-final');
  const done = get<HTMLButtonElement>('import-done');
  const sessionList = get('import-sessions');
  let sessions:ImportSession[] = [];
  let native:{file:File; preview:ImportResult}|null = null;
  let quotaWarning:{limit:string|null; timer:boolean}|null = null;
  let step = 0, revision = 0, loading = false, restoreSettings = true;
  let saving = false, result:ImportResult|null = null;
  let controller:AbortController|null = null;
  let exportController:AbortController|null = null;
  let draftEditors = new AbortController();
  let fileName = '';
  function field(key:string, input:HTMLElement):HTMLLabelElement {
    const label = document.createElement('label'); label.className = 'setting-field';
    const name = document.createElement('span'); setText(name,key);
    const box = document.createElement('span'); box.className = 'import-control'; box.append(input);
    label.append(name,box); return label;
  }
  function valid():boolean {
    if (native) return true;
    return sessions.some(session=>session.selected) && sessions.filter(session=>session.selected).every(session=>session.event && session.cube.length<=12 && session.custom.length<=12 && !/[\u0000-\u001f\u007f]/.test(session.cube+session.custom));
  }
  function buttons() {
    back.hidden = step === 0 || step >= 3;
    next.hidden = step >= 2;
    next.disabled = loading || saving || (!native && !sessions.length) || step === 1 && !valid();
    back.disabled = choose.disabled = saving || loading;
    save.hidden = step !== 2;
    save.disabled = saving || !valid();
    done.hidden = step < 3;
    setText(done,quotaWarning ? 'ok' : 'done');
    if (step === 1) {
      const selected = sessions.filter(session=>session.selected);
      const error = !selected.length ? 'select a session' : selected.some(session=>!session.event) ? 'choose an event for each selected session' : '';
      setText(message,error); message.hidden = !error;
    }
  }
  function addSessionFields(session:ImportSession, body:HTMLElement, checkLabel:HTMLLabelElement):CubeSelector {
    const editor = document.createElement('div'); editor.className = 'import-session-fields';
    const event = document.createElement('select'); event.required = true;
    const placeholder = new Option('', ''); setText(placeholder,'choose');
    event.append(placeholder,...Object.keys(scrambleEvents).map(name=>new Option(name,name)));
    event.value = session.event;
    const cube = document.createElement('input'); cube.maxLength = 12; cube.autocomplete = 'off';
    cube.setAttribute('role','combobox'); cube.setAttribute('aria-autocomplete','list');
    const cubeField = field('cube model',cube); cubeField.classList.add('cube-handle-field');
    const suggestions = document.createElement('div'); suggestions.id = `${body.id}-cube-suggestions`;
    suggestions.className = 'cube-suggestions'; suggestions.role = 'listbox'; suggestions.hidden = true;
    cube.setAttribute('aria-controls',suggestions.id);
    cubeField.append(suggestions);
    const cubeError = document.createElement('p'); cubeError.className = 'validation-message'; cubeError.hidden = true;
    const model = document.createElement('output'); model.className = 'import-model-name';
    const warning = document.createElement('span'); warning.className = 'import-model-warning';
    const modelField = document.createElement('div'); modelField.className = 'setting-field import-model-field'; modelField.hidden = true;
    modelField.append(model,warning);
    const custom = document.createElement('input'); custom.maxLength = 12; custom.autocomplete = 'off';
    const customError = document.createElement('p'); customError.className = 'validation-message'; customError.hidden = true;
    editor.append(field('event',event),field('custom tag',custom),checkLabel,cubeField,cubeError,modelField,customError);
    body.append(editor);
    const selector = new CubeSelector(cube,model,suggestions,warning,cubeError,draftEditors.signal);
    bindShortText(cube,cubeError); bindShortText(custom,customError);
    function commit() {
      session.cube = cube.value; session.custom = custom.value;
      session.cubeModelId = selector.modelId; session.modelName = model.value;
      modelField.hidden = !cube.value.trim();
      buttons();
    }
    event.addEventListener('change',()=> {
      session.event = event.value;
      cube.value = ''; validateShortText(cube,cubeError);
      void selector.configure(event.value);
      commit();
    });
    cube.addEventListener('input',commit);
    custom.addEventListener('input',commit);
    suggestions.addEventListener('click',commit);
    cube.addEventListener('keydown',event=> { if (event.key === 'Enter' && event.defaultPrevented) commit(); });
    void selector.configure(session.event);
    return selector;
  }
  function buildSessions() {
    const fragment = document.createDocumentFragment();
    for (const session of sessions) {
      const row = document.createElement('div'); row.className = 'import-session';
      const body = document.createElement('div'); body.className = 'import-session-body'; body.id = `import-${session.id}`; body.hidden = true;
      const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = session.selected;
      const include = document.createElement('span'); setText(include,'include in import');
      const checkLabel = document.createElement('label'); checkLabel.className = 'import-session-check'; checkLabel.append(checkbox,include);
      const button = document.createElement('button'); button.type = 'button'; button.className = 'import-session-toggle';
      const name = document.createElement('span'); name.className = 'import-session-name'; name.textContent = session.name; name.title = session.name;
      name.id = `${body.id}-name`; checkbox.setAttribute('aria-describedby',name.id);
      const count = document.createElement('span'); count.className = 'import-session-count';
      const countLabel = document.createElement('span'); setText(countLabel,session.solves.length === 1 ? 'solve' : 'solves');
      count.append(`${session.solves.length} `,countLabel);
      const excluded = document.createElement('span'); excluded.hidden = true; excluded.id = `${body.id}-excluded`; setText(excluded,'excluded from import');
      const indicator = document.createElement('span'); indicator.className = 'import-session-indicator'; indicator.append(icon('plus'));
      button.append(indicator,name,count);
      button.setAttribute('aria-expanded','false'); button.setAttribute('aria-controls',body.id);
      body.append(checkLabel); row.append(button,body,excluded); fragment.append(row);
      let selector:CubeSelector | undefined;
      button.addEventListener('click',()=> {
        const expanded = body.hidden;
        if (expanded) selector ??= addSessionFields(session,body,checkLabel);
        else selector?.close();
        body.hidden = !expanded;
        button.setAttribute('aria-expanded',String(expanded));
        indicator.replaceChildren(icon(expanded ? 'minus' : 'plus'));
      });
      checkbox.addEventListener('change',()=> {
        session.selected = checkbox.checked;
        row.classList.toggle('import-session-excluded',!session.selected);
        if (session.selected) button.removeAttribute('aria-describedby');
        else button.setAttribute('aria-describedby',excluded.id);
        buttons();
      });
    }
    sessionList.replaceChildren(fragment);
  }
  function clearSessions() {
    draftEditors.abort(); draftEditors = new AbortController();
    sessions = []; sessionList.replaceChildren();
  }
  function reviewValue(value:string):string | HTMLSpanElement {
    if (!value.trim()) return t('none');
    const text = document.createElement('span');
    text.className = 'import-review-value';
    text.textContent = value;
    return text;
  }
  function review() {
    get('import-cstimer-note').hidden = Boolean(native);
    get('import-native-review').hidden = !native;
    if (native) {
      const {imported,skipped} = native.preview;
      get('import-total').textContent = t('datacube backup');
      get('import-review').replaceChildren();
      get('import-native-counts').textContent = `${imported} ${t('to add')} ${skipped} ${t('to skip')}`;
      return;
    }
    const selected = sessions.filter(session=>session.selected);
    const total = selected.reduce((sum,session)=>sum+session.solves.length,0);
    get('import-total').textContent = `${selected.length} ${t(selected.length === 1 ? 'session' : 'sessions')} ${total} ${t(total === 1 ? 'solve' : 'solves')}`;
    get('import-review').replaceChildren(...selected.map(session=> {
      const row = document.createElement('div'); row.className = 'import-review-row';
      const name = document.createElement('strong'); name.textContent = session.name;
      const count = document.createElement('span'); count.textContent = `${session.solves.length} ${t(session.solves.length === 1 ? 'solve' : 'solves')}`;
      const assignment = document.createElement('span');
      assignment.append(`${t('event')} ${session.event}  ${t('cube model')} `,reviewValue(session.cube),`  ${t('custom tag')} `,reviewValue(session.custom));
      row.append(name,count,assignment);
      return row;
    }));
  }
  function showStep() {
    for (const [index,id] of ['import-file-step','import-config-step','import-review-step','import-result-step','import-warning-step'].entries()) get(id).hidden = step!==index;
    setText(get('import-heading'),saving ? 'importing solves' : ['import solves','configure sessions','review import','import complete','warning'][step]);
    const filename = get('import-filename'); filename.hidden = step !== 0 || !fileName; filename.textContent = fileName;
    buttons();
    if (step === 2) review();
    if (result) {
      const {imported,skipped} = result;
      get('import-result').textContent = native
        ? `${imported} ${t('added')} ${skipped} ${t('skipped')}`
        : `${imported} ${t('imported')}  ${skipped} ${t('skipped')}`;
    }
    if (quotaWarning) {
      const {limit,timer} = quotaWarning;
      const explanation = limit ? t('each account can save up to {limit} solves').replace('{limit}',limit) : t('solve limit reached');
      const action = t(timer ? 'free space in history to save pending solves automatically' : 'delete saved solves and try the import again');
      get('import-warning-text').textContent = `${explanation}\n${action}`;
    }
  }
  choose.addEventListener('click',()=>file.click());
  file.addEventListener('change',async()=> {
    const selected = file.files?.[0]; if (!selected) return;
    file.value = '';
    const currentRevision = ++revision;
    controller?.abort();
    const reading = new AbortController(); controller = reading;
    clearSessions(); native = null; fileName = ''; message.hidden = true;
    loading = true; buttons();
    try {
      const nativeOnly = selected.size > IMPORT_LIMITS.fileBytes;
      if (nativeOnly) validateImportFilename(selected.name);
      else validateImportFile(selected.name,selected.size);
      // Large backups are identified by the server without a full JS text/JSON copy.
      const parsed = nativeOnly ? null : decodeImportFile(await selected.text());
      if (currentRevision !== revision || !dialog.open) return;
      if (nativeOnly || isDatacubeBackup(parsed)) {
        const owner = account()?.id;
        if (owner === undefined) return;
        const preview = await restoreBackup(owner,selected,reading.signal,true);
        if (currentRevision !== revision || account()?.id !== owner || !dialog.open) return;
        native = {file:selected,preview}; step = 2;
      } else {
        sessions = parseCstimerData(parsed);
      }
      fileName = selected.name;
    } catch (error) {
      if (currentRevision !== revision || !dialog.open) return;
      if (!showRateLimitWarning(error,choose)) {
        setText(message,error instanceof ImportError || error instanceof ApiError ? error.message : 'file unavailable'); message.hidden = false;
      }
    } finally {
      if (currentRevision === revision) {
        controller = null; loading = false; showStep();
        if (native) { get('import-dialog').querySelector('.import-content')!.scrollTop = 0; focusStep(); }
      }
    }
  });
  next.addEventListener('click',()=> {
    if (saving || loading) return;
    if ((!native && !sessions.length) || step===1 && !valid()) return;
    step = native ? 2 : step + 1; message.hidden = true;
    if (step===1 && !sessionList.firstElementChild) buildSessions();
    showStep(); get('import-dialog').querySelector('.import-content')!.scrollTop = 0; focusStep();
  });
  back.addEventListener('click',()=> { if (saving) return; step = native ? 0 : step - 1; message.hidden = true; showStep(); focusStep(); });
  done.addEventListener('click',()=>dialog.close());
  save.addEventListener('click',async event=> {
    // A double-click on next must not also confirm the newly displayed import.
    if (event.detail > 1 || saving || step !== 2 || !valid()) return;
    const owner = account()?.id;
    if (owner === undefined) return;
    const currentRevision = revision;
    controller = new AbortController(); saving = true; message.hidden = true;
    dialog.setAttribute('aria-busy','true'); showStep(); dialog.focus();
    let rateWarning = false;
    try {
      const saved = native ? await restoreBackup(owner,native.file,controller.signal) : await saveImport(owner,sessions,controller.signal);
      if (currentRevision !== revision || account()?.id !== owner) return;
      result = saved; step = 3;
      await onImported(owner);
    } catch (error) {
      if (currentRevision !== revision || account()?.id !== owner) return;
      const reason = error instanceof ApiError || error instanceof ImportError ? error.message : 'import unavailable try again';
      if (error instanceof ApiError && error.status === 422 && reason === SOLVE_LIMIT_REACHED) {
        quotaWarning = {limit:error.solveLimit,timer:false}; step = 4;
      } else if (!(rateWarning = showRateLimitWarning(error,save))) {
        setText(message,reason); message.hidden = false;
      }
    } finally {
      if (currentRevision === revision && account()?.id === owner) {
        saving = false; controller = null; dialog.removeAttribute('aria-busy'); showStep();
        if (!rateWarning) (step >= 3 ? done : save).focus({preventScroll:true});
      }
    }
  });

  function focusStep() {
    const control = step === 0 ? choose : step === 1 ? sessionList.querySelector<HTMLButtonElement>('.import-session-toggle') : step === 3 ? done : back;
    (control ?? dialog).focus({preventScroll:true});
  }

  function resetDraft() {
    controller?.abort(); controller = null; saving = false; result = null; native = null; quotaWarning = null; dialog.removeAttribute('aria-busy');
    revision++; loading = false; clearSessions(); step = 0; fileName = '';
    file.value = ''; message.hidden = true; get('import-review').replaceChildren(); showStep();
  }
  function modal(target:HTMLDialogElement, triggerId:string, focus:()=>void, blocked = ()=>false, prepare = ()=>{}) {
    const trigger = get<HTMLButtonElement>(triggerId);
    trigger.addEventListener('click',()=> {
      if (!canOpen() || document.querySelector('dialog[open]')) return;
      prepare();
      restoreSettings = true; target.showModal();
      focus();
    });
    target.addEventListener('cancel',event=> { event.preventDefault(); if (!blocked()) target.close(); });
    target.addEventListener('close',()=> {
      if (target===dialog) resetDraft();
      if (restoreSettings && !document.querySelector('dialog[open]')) { settings.open = true; trigger.focus({preventScroll:true}); }
    });
    target.addEventListener('click',event=> {
      event.stopPropagation(); const rect = target.getBoundingClientRect();
      if (event.target===target && !blocked() && (event.clientX<rect.left || event.clientX>rect.right || event.clientY<rect.top || event.clientY>rect.bottom)) target.close();
    });
    target.addEventListener('keydown',event=> {
      event.stopPropagation();
      if (event.key!=='Tab') return;
      const controls = Array.from(target.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href]')).filter(el=>el.getClientRects().length && el.tabIndex >= 0);
      const first = controls[0], last = controls.at(-1);
      if (!first || !last) { event.preventDefault(); target.focus(); }
      else if (event.shiftKey && (document.activeElement===first || document.activeElement===target)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement===last) { event.preventDefault(); first.focus(); }
    });
  }
  function exportHeading() {
    get('export-heading').textContent = t('export {account} solves?').replace('{account}',()=>account()?.username ?? '');
  }
  function setExportBusy(busy:boolean) {
    exportCancel.disabled = exportDownload.disabled = busy;
    if (busy) exportDialog.setAttribute('aria-busy','true');
    else exportDialog.removeAttribute('aria-busy');
  }
  exportCancel.addEventListener('click',()=>exportDialog.close());
  exportDownload.addEventListener('click',async()=> {
    const owner = account()?.id;
    if (exportController || owner === undefined || !exportDialog.open) return;
    const pending = new AbortController(); exportController = pending;
    setExportBusy(true); exportMessage.hidden = true; exportDialog.focus();
    let rateWarning = false;
    try {
      const backup = await fetchBackup(owner,pending.signal);
      if (pending.signal.aborted || account()?.id !== owner || !exportDialog.open) return;
      downloadBackup(backup);
      exportDialog.close();
    } catch (error) {
      if (pending.signal.aborted || account()?.id !== owner) return;
      rateWarning = showRateLimitWarning(error,exportDownload);
      if (!rateWarning) { setText(exportMessage,'export unavailable try again'); exportMessage.hidden = false; }
    } finally {
      if (exportController === pending) {
        exportController = null; setExportBusy(false);
        if (exportDialog.open && !rateWarning) exportDownload.focus();
      }
    }
  });
  modal(dialog,'open-import',focusStep,()=>saving,resetDraft);
  modal(about,'open-about',()=>about.querySelector<HTMLAnchorElement>('a')!.focus());
  modal(exportDialog,'open-export',()=>exportCancel.focus(),()=>Boolean(exportController),()=> {
    exportHeading(); exportMessage.hidden = true;
  });
  for (const [id,name] of [['open-import','import'],['open-export','export'],['open-about','about']] as const) {
    get(id).append(icon(name)); setActionLabel(get(id),name);
  }
  onLanguageChange(()=> { if (dialog.open) showStep(); if (exportDialog.open) exportHeading(); });
  showStep();
  return {get busy() { return saving || Boolean(exportController); }, showTimerQuota(limit:string|null):boolean {
    if (!canOpen() || document.querySelector('dialog[open]')) return false;
    resetDraft(); restoreSettings = false;
    quotaWarning = {limit,timer:true}; step = 4;
    showStep(); dialog.showModal(); done.focus();
    return true;
  }, reset() {
    restoreSettings = false;
    exportController?.abort(); exportController = null; setExportBusy(false);
    for (const modal of [dialog,about,exportDialog]) if (modal.open) modal.close();
    resetDraft();
  }};
}
