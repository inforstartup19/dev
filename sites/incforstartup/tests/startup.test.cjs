const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const M=require('../public/startup-model.js'),C=require('../public/startup-catalog.js');
const fields={goal:'Contrastar la necessitat',action:'Una prova petita',evidence:'Quadern',question:'Què falta?'};
test('orientation covers all combinations and never grants admission',()=>{
 for(let bits=0;bits<8;bits++){const r=M.recommend({need:!!(bits&1),mvp:!!(bits&2),evidence:!!(bits&4)});assert.equal(r.track,bits===7?'enlaira':'crea-i-creix');}
 assert.match(M.recommend({need:true,mvp:true,evidence:true}).reason,/no és una admissió/);
 assert.throws(()=>M.recommend({need:1,mvp:true,evidence:true}));
});
test('preparation round trips independently and rejects foreign projects or invalid records',()=>{
 const original=M.create('p1'),next=M.apply(original,{type:'note',key:'crea-i-creix/mvp',fields});
 assert.deepEqual(original.notes,{});assert.equal(next.projectId,'p1');assert.equal(next.revision,1);
 assert.deepEqual(M.parse(JSON.stringify(next),'p1'),next);assert.throws(()=>M.parse(JSON.stringify(next),'p2'));
 assert.throws(()=>M.parse('{broken','p1'));assert.throws(()=>M.apply(next,{type:'complete'}));
 assert.throws(()=>M.apply(next,{type:'note',key:'crea-i-creix/mvp',fields:{...fields,goal:'x'.repeat(3001)}}));
 assert.throws(()=>M.apply(next,{type:'note',key:'__proto__',fields}));
});
test('non-investor funding remains a valid choice and cannot complete a stage',()=>{
 for(const choice of ['pendent','propis','ingressos','ajuts','inversio']){const next=M.apply(M.create('p1'),{type:'financing',value:choice});assert.equal(next.financing,choice);assert.deepEqual(next.notes,{});}
 assert.throws(()=>M.apply(M.create('p1'),{type:'financing',value:'guaranteed'}));
});
test('concurrent updates and storage denial preserve earlier content',()=>{
 const data=new Map([['key','newer']]),storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};
 assert.throws(()=>M.save(storage,'key',M.create('p1'),null),/altra pestanya/);assert.equal(data.get('key'),'newer');
 assert.throws(()=>M.save({getItem:()=>null,setItem:()=>{throw Error('denied')}},'key',M.create('p1'),null),/denied/);
});
function harness(){
 const data=new Map([['workspace','original-workspace'],['academic','original-academic']]);const handlers={},windowHandlers={},els={'#su-status':{},'#su-recommendation':{},'.su-inline-status':{classList:{toggle(){}}}};
 const c={QuelcomStartup:M,QuelcomStartupCatalog:C,state:{projects:[{id:'p1',title:'First',live:{origin:'Campus'}},{id:'p2',title:'Second'}]},routes:{},render(){},esc:s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),location:{hash:'#startup'},localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)},document:{querySelector:s=>els[s]||null,querySelectorAll:()=>[],body:{classList:{toggle(){}}},addEventListener:(k,f)=>handlers[k]=f},window:{addEventListener:(k,f)=>windowHandlers[k]=f},FormData:class{constructor(form){return new Map(Object.entries(form.values))}}};
 vm.createContext(c);vm.runInContext(fs.readFileSync('sites/incforstartup/public/startup.js','utf8'),c);
 return {c,data,handlers,windowHandlers,els,page(hash){c.location.hash=hash;c.render();return c.routes[hash.slice(1)][1]();},input(key,values){const form={id:'su-note',dataset:{key},values};handlers.input({target:{closest:()=>form}});}};
}
test('all stages are reachable without a project, including deep links',()=>{
 const h=harness();for(const t of C.tracks){const page=h.page('#startup/'+t.id);for(const s of t.steps){assert.ok(page.includes('#startup/'+t.id+'//'+s.id));assert.match(h.page('#startup/'+t.id+'//'+s.id),new RegExp(s.title));}}
 assert.match(h.page('#startup/crea-i-creix/unknown/mvp'),/No trobem aquest projecte/);
});
test('editing preparation preserves main project and academic data, and is isolated by project',()=>{
 const h=harness(),baseline=JSON.stringify(h.c.state);h.page('#startup/crea-i-creix/p1/mvp');h.input('crea-i-creix/mvp',fields);
 assert.equal(JSON.parse(h.data.get('quelcom.startup.p1.v1')).notes['crea-i-creix/mvp'].goal,fields.goal);
 assert.match(h.page('#startup/crea-i-creix/p1/mvp'),/Contrastar la necessitat/);
 assert.doesNotMatch(h.page('#startup/crea-i-creix/p2/mvp'),/Contrastar la necessitat/);
 assert.equal(JSON.stringify(h.c.state),baseline);assert.equal(h.data.get('workspace'),'original-workspace');assert.equal(h.data.get('academic'),'original-academic');
});
test('corruption blocks overwrite and preserves pending text for export and revisiting',()=>{
 const h=harness();h.data.set('quelcom.startup.p1.v1','{broken');assert.match(h.page('#startup/crea-i-creix/p1/mvp'),/No podem recuperar/);
 h.input('crea-i-creix/mvp',{...fields,goal:'Text pendent'});assert.equal(h.data.get('quelcom.startup.p1.v1'),'{broken');
 assert.match(h.page('#startup/crea-i-creix/p1/mvp'),/Text pendent/);
 let guarded=false;h.windowHandlers.beforeunload({preventDefault(){guarded=true}});assert.equal(guarded,true);
});
test('cross-tab conflict keeps pending text rather than replacing the newer revision',()=>{
 const h=harness();h.page('#startup/crea-i-creix/p1/mvp');h.input('crea-i-creix/mvp',fields);
 const newer=M.apply(M.parse(h.data.get('quelcom.startup.p1.v1'),'p1'),{type:'financing',value:'propis'});const raw=JSON.stringify(newer);h.data.set('quelcom.startup.p1.v1',raw);
 h.input('crea-i-creix/mvp',{...fields,goal:'Conflicte recuperable'});assert.equal(h.data.get('quelcom.startup.p1.v1'),raw);
 assert.match(h.els['#su-status'].textContent,/altra pestanya/);assert.match(h.page('#startup/crea-i-creix/p1/mvp'),/Conflicte recuperable/);
});

test('generated catalogue matches the source',()=>assert.deepEqual(C,require('../../../shared/startup-pathways.json')));
