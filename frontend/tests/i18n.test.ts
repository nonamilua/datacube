import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setLanguage, currentLanguage, t, translations, languageForAccount, rememberLanguage, settingsKey } from '../src/i18n.ts';

test('portuguese count card uses total while graph copy keeps tempos', () => {
  setLanguage('pt-BR');
  assert.equal(t('solve count'),'total');
  assert.equal(t('solves'),'tempos');
  assert.equal(t('none'),'nenhuma');
  setLanguage('en');
  assert.equal(t('solve count'),'solves');
  assert.equal(t('none'),'none');
});

test('language preference defaults to english persists across login and stays isolated by account', () => {
  const values = new Map<string,string>();
  const storage = {getItem:(key:string) => values.get(key) ?? null, setItem:(key:string,value:string) => {values.set(key,value);}};
  assert.equal(languageForAccount(storage,1),'en');
  storage.setItem(settingsKey(1),JSON.stringify({cube:'rs3m',scrambles:true}));
  rememberLanguage(storage,1,'pt-BR');
  rememberLanguage(storage,2,'es');
  assert.equal(languageForAccount(storage,1),'pt-BR');
  assert.equal(languageForAccount(storage,2),'es');
  assert.equal(languageForAccount(storage,3),'en');
  assert.deepEqual(JSON.parse(storage.getItem(settingsKey(1))!),{cube:'rs3m',scrambles:true,language:'pt-BR'});
  storage.setItem(settingsKey(3),'invalid json');
  assert.equal(languageForAccount(storage,3),'en');
  rememberLanguage(storage,3,'unknown');
  assert.equal(languageForAccount(storage,3),'en');
});

test('all translations are complete lowercase and leave notation and user text untouched', () => {
  for (const language of ['pt-BR','es'] as const) {
    setLanguage(language);
    assert.equal(currentLanguage(),language);
    for (const [key,values] of Object.entries(translations)) {
      const translated = t(key);
      assert.equal(translated,values[language === 'pt-BR' ? 0 : 1]);
      assert.ok(translated.length > 0,key);
      assert.equal(translated,translated.toLocaleLowerCase(),key);
    }
    assert.equal(t("R U' F2"),"R U' F2");
    assert.equal(t('rs3m 2020'),'rs3m 2020');
    assert.equal(t('ao100'),'ao100');
  }
  setLanguage('en');
  assert.equal(t('sign in'),'sign in');
  assert.equal(t('custom range'),'custom');
});
