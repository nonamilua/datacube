import assert from 'node:assert/strict';
import {test} from 'node:test';
import {CubeSelector, suggestModels, type CubeModel} from '../src/cube-selector.ts';

test('cube suggestions search full names and aliases ignoring case spaces and punctuation and retain distinct identities', () => {
  const models: CubeModel[] = [
    {id:'guhong',brand:'DaYan',name:'GuHong Pro+',label:'DaYan GuHong Pro+',aliases:['guhong pro+']},
    {id:'gan15a',brand:'GAN',name:'15 MagLev',label:'GAN 15 MagLev',aliases:['gan 15']},
    {id:'gan15b',brand:'GAN',name:'15 NewBlack',label:'GAN 15 NewBlack',aliases:['gan 15']},
    {id:'gan16',brand:'GAN',name:'16 Maglev',label:'GAN 16 Maglev',aliases:['gan 16']},
  ];
  assert.equal(suggestModels(models,'GUHONGPRO+')[0].id,'guhong');
  assert.equal(suggestModels(models,'dayan')[0].id,'guhong');
  assert.deepEqual(suggestModels(models,'gan15').map(model=>model.id),['gan15a','gan15b']);
  assert.deepEqual(suggestModels(models,''),[]);
  assert.deepEqual(suggestModels(models,'my own cube'),[]);
  assert.equal(suggestModels(models,'guhong')[0].aliases[0],'guhong pro+');
  assert.equal(models[0].label,'DaYan GuHong Pro+');
  assert.equal(suggestModels(Array.from({length:20},(_,i)=>({...models[0],id:String(i)})),'guhong').length,8);
});

test('selection fills the model and handle editing clears it and stale event requests cannot restore it', async () => {
  const originalDocument = globalThis.document;
  const originalFetch = globalThis.fetch;
  const models = [{id:'gan15',brand:'GAN',name:'15 MagLev',label:'GAN 15 MagLev',aliases:['gan 15']}];
  function control() {
    const callbacks: Record<string, (event?: any) => void> = {};
    return {value:'',hidden:false,disabled:false,dataset:{},children:[] as any[],textContent:'',scrollTop:0,
      addEventListener:(event:string,callback:(event?:any)=>void)=>{callbacks[event]=callback;},
      setAttribute:()=>{},removeAttribute:()=>{},focus:()=>callbacks.focus?.(),
      replaceChildren(...children:any[]){this.children=children;}, callbacks};
  }
  const handle=control(), model=control(), list=control(), warning=control(), validation=control();
  globalThis.document = {addEventListener:()=>{},createElement:()=>control(),getElementById:()=>validation} as any;
  globalThis.fetch = async () => new Response(JSON.stringify(models),{status:200});
  try {
    const selector = new CubeSelector(handle as any,model as any,list as any,warning as any);
    await selector.configure('3x3');
    handle.value='gan15'; handle.callbacks.input();
    assert.equal(model.value,''); assert.equal(list.children[0].textContent,'GAN 15 MagLev');
    list.scrollTop=150;
    handle.callbacks.input();
    assert.equal(list.scrollTop,0);
    list.children[0].callbacks.click();
    assert.equal(handle.value,'gan 15'); assert.equal(model.value,'GAN 15 MagLev');
    assert.equal(selector.modelId,'gan15'); assert.equal(warning.hidden,true);
    handle.value='my cube'; handle.callbacks.input();
    assert.equal(selector.modelId,null); assert.equal(model.value,''); assert.equal(warning.hidden,false);
    assert.equal(list.hidden,true);
    await selector.configure('3x3','gan15');
    assert.equal(selector.modelId,'gan15');
    let release!: (value:Response)=>void;
    globalThis.fetch = () => new Promise(resolve=>{release=resolve;});
    const stale=selector.configure('3x3','gan15');
    globalThis.fetch = async () => new Response('[]',{status:200});
    await selector.configure('clock');
    release(new Response(JSON.stringify(models),{status:200})); await stale;
    assert.equal(selector.modelId,null); assert.equal(model.value,'');
    assert.equal(warning.textContent,'no cube models for this event');
  } finally {globalThis.document=originalDocument; globalThis.fetch=originalFetch;}
});
