const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const M=require('../public/academic-workspace-model.js');
function boot(data={},options={}){const events={},windowEvents={},nodes={},focusCalls=[];const c={AcademicWorkspace:M,routes:{},render(){},esc:s=>String(s).replaceAll('<','&lt;'),location:{hash:'#befirst-tfg-tauler'},matchMedia:()=>({matches:!!options.mobile}),localStorage:{getItem:k=>data[k]??null,setItem:(k,v)=>data[k]=v},FormData:class{constructor(f){this.data=f.data;}[Symbol.iterator](){return Object.entries(this.data)[Symbol.iterator]()}get(k){return this.data[k]}},document:{querySelector:s=>nodes[s]||null,body:{classList:{add(){}}},addEventListener:(n,f)=>(events[n]??=[]).push(f)},window:{scrollY:730,scrollTo(p){this.scrollY=p.top},requestAnimationFrame:f=>f(),addEventListener:(n,f)=>(windowEvents[n]??=[]).push(f)}};vm.createContext(c);vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../public/befirst-board.js'),'utf8'),c);return {c,data,nodes,focusCalls,html:()=>c.routes[c.location.hash.slice(1)][1](),fire:(n,e)=>(events[n]||[]).forEach(f=>f(e)),click(dataset,attributes=[]){this.fire('click',{target:{closest:()=>({dataset,hasAttribute:a=>attributes.includes(a)})}})},role(value){this.fire('change',{target:{id:'bb-role',value}})},navigate(k){c.location.hash='#befirst-'+k.toLowerCase()+'-tauler';(windowEvents.hashchange||[]).forEach(f=>f())},state(k='TFG'){return JSON.parse(data['quelcom.befirst-board.'+k+'.v1'])}};}
test('template is unsubmitted, independent and persists only on action',()=>{const b=boot({'quelcom.befirst-academic.v1':'untouched'});assert.match(b.html(),/0 de 5/);assert.equal(Object.keys(b.data).length,1);b.click({bbMove:'bf-1',status:'active'});assert.equal(b.state().tasks[0].status,'active');assert.equal(b.data['quelcom.befirst-academic.v1'],'untouched');b.c.location.hash='#befirst-tfm-tauler';assert.match(b.html(),/0 de 5/);});
test('evidence, teacher feedback and immutable resubmission form one cycle',()=>{const b=boot();b.html();b.click({bbMove:'bf-1',status:'active'});b.click({bbMove:'bf-1',status:'review'});assert.equal(b.state().submissions.length,0);let form={id:'bb-task',dataset:{id:'bf-1'},data:{...b.state().tasks[0],evidence:'Primera evidència'}};b.fire('submit',{target:form,preventDefault(){}});b.click({bbMove:'bf-1',status:'review'});assert.equal(b.state().submissions.length,1);b.click({bbMove:'bf-1',status:'done'});assert.equal(b.state().tasks[0].status,'review');b.role('teacher');b.fire('submit',{target:{id:'bb-review',dataset:{id:'bf-1'},data:{comment:'Concreta el públic'}},submitter:{value:'revise'},preventDefault(){}});assert.equal(b.state().tasks[0].status,'revise');b.role('student');b.click({bbMove:'bf-1',status:'active'});form.data.evidence='Segona evidència';b.fire('submit',{target:form,preventDefault(){}});b.click({bbMove:'bf-1',status:'review'});const s=b.state();assert.equal(s.submissions[0].snapshot.evidence,'Primera evidència');assert.equal(s.submissions[1].snapshot.evidence,'Segona evidència');assert.ok(s.history.some(h=>h.actor==='teacher'&&h.message.includes('Concreta')));assert.match(boot(b.data).html(),/En revisió/);});
test('dependencies and incomplete evidence prevent completion',()=>{let s=M.create('TFG');for(const id of ['a','b'])s=M.apply(s,{type:'save',task:{id,title:id,deliverable:'Fitxa',criteria:'Complet',requireEvidence:true,evidence:'Prova',dependencies:id==='b'?['a']:[]}},'student');s=M.apply(s,{type:'move',id:'b',status:'active'},'student');assert.throws(()=>M.apply(s,{type:'move',id:'b',status:'review'},'student'),/dependències/);});
test('corrupt data and concurrent updates cannot be overwritten',()=>{const key='quelcom.befirst-board.TFG.v1',b=boot({[key]:'{bad'});assert.match(b.html(),/No podem recuperar/);b.click({bbMove:'bf-1',status:'active'});assert.equal(b.data[key],'{bad');const c=boot();c.html();c.data[key]='external';c.click({bbMove:'bf-1',status:'active'});assert.equal(c.data[key],'external');assert.match(c.html(),/altra pestanya/);});
test('pending edits block transitions until saved',()=>{const b=boot();b.html();b.click({bbMove:'bf-1',status:'active'});const form={id:'bb-task',dataset:{id:'bf-1'},data:{evidence:'En preparació'}};b.fire('input',{target:{closest:()=>form}});b.click({bbMove:'bf-1',status:'review'});assert.match(b.html(),/Desa els canvis/);assert.equal(b.state().tasks[0].status,'active');});


test('filters keep all tasks and empty states without writing domain data',()=>{
 const b=boot();b.html();b.click({bbMove:'bf-1',status:'active'});const original=JSON.stringify(b.data);
 for(const f of ['prepare','active','review','done']){b.click({bbFilter:f});const html=b.html();assert.match(html,new RegExp('data-bb-filter="'+f+'" aria-pressed="true"'));assert.equal((html.match(/data-bb-card=/g)||[]).length,5);assert.match(html,/Cap tasca en revisió/);assert.match(html,/Abans cal validar: Definir l’abast/);assert.equal(JSON.stringify(b.data),original);}
 b.click({bbFilter:'invalid'});assert.match(b.html(),/data-bb-filter="done" aria-pressed="true"/);
});
test('TFG and TFM filters and demo roles retain their own view',()=>{
 const b=boot();b.html();b.click({bbFilter:'done'});b.navigate('TFM');assert.match(b.html(),/data-bb-filter="prepare" aria-pressed="true"/);b.click({bbFilter:'active'});b.navigate('TFG');assert.match(b.html(),/data-bb-filter="done" aria-pressed="true"/);b.role('teacher');assert.match(b.html(),/data-bb-filter="review" aria-pressed="true"/);b.role('student');assert.match(b.html(),/data-bb-filter="done" aria-pressed="true"/);assert.equal(Object.keys(b.data).length,0);
});
test('close restores filter, scroll and opener; pending form edits survive filtering',()=>{
 const b=boot({}, {mobile:true});b.html();b.click({bbFilter:'prepare'});let focused=false;
 b.nodes['[data-bb-card="bf-2"]']={getClientRects:()=>[{}],focus(){focused=true}};
 b.click({bbOpen:'bf-2'});const form={id:'bb-task',dataset:{id:'bf-2'},data:{evidence:'Esborrany encara no desat'}};
 b.fire('input',{target:{closest:()=>form}});b.click({bbFilter:'done'});b.click({bbTab:'history'});b.c.window.scrollY=1400;b.click({},['data-bb-close']);assert.equal(b.c.window.scrollY,730);assert.ok(focused);assert.match(b.html(),/data-bb-card="bf-2" data-bb-last="true"/);assert.match(b.html(),/data-bb-filter="prepare" aria-pressed="true"/);b.click({bbOpen:'bf-2'});assert.match(b.html(),/Esborrany encara no desat/);assert.equal(Object.keys(b.data).length,0);
});
for(const k of ['TFG','TFM'])test(k+' review, return, correction and completion update counts without losing snapshots',()=>{
 const b=boot();b.navigate(k);b.html();b.click({bbMove:'bf-1',status:'active'});
 const save=evidence=>b.fire('submit',{target:{id:'bb-task',dataset:{id:'bf-1'},data:{...b.state(k).tasks[0],evidence}},preventDefault(){}});
 const review=decision=>b.fire('submit',{target:{id:'bb-review',dataset:{id:'bf-1'},data:{comment:'Retorn docent de prova'}},submitter:{value:decision},preventDefault(){}});
 save('Primera prova');b.click({bbMove:'bf-1',status:'review'});b.role('teacher');review('revise');b.role('student');b.click({bbFilter:'active'});assert.match(b.html(),/En curs<\/span><b>1/);b.click({bbMove:'bf-1',status:'active'});save('Prova corregida');b.click({bbMove:'bf-1',status:'review'});b.role('teacher');review('done');assert.equal(b.state(k).tasks[0].status,'done');assert.match(b.html(),/Completat<\/span><b>1/);assert.equal(b.state(k).submissions[0].snapshot.evidence,'Primera prova');assert.equal(b.state(k).submissions[1].snapshot.evidence,'Prova corregida');
});
test('large task lists keep every task reachable with correct state counts',()=>{
 let s=M.create('TFG');for(let i=0;i<75;i++)s=M.apply(s,{type:'save',task:{id:'task-'+i,title:'Una tasca llarga '+i,owner:'Equip',dependencies:[]}},'student');const b=boot({'quelcom.befirst-board.TFG.v1':JSON.stringify(s)});for(const f of ['prepare','active','review','done']){b.click({bbFilter:f});assert.equal((b.html().match(/data-bb-card=/g)||[]).length,75);}assert.match(b.html(),/Pendent<\/span><b>75/);
});

for(const k of ['TFG','TFM'])test(k+' enforces all five steps and unlocks only after teacher validation',()=>{
 const b=boot();b.navigate(k);b.html();
 for(let i=1;i<=5;i++){
  if(i<5){const before=JSON.stringify(b.data);b.click({bbMove:'bf-'+(i+1),status:'active'});assert.equal(JSON.stringify(b.data),before);assert.match(b.html(),/Tasca bloquejada/);}
  b.click({bbMove:'bf-'+i,status:'active'});assert.equal(b.state(k).tasks[i-1].status,'active');
  b.fire('submit',{target:{id:'bb-task',dataset:{id:'bf-'+i},data:{...b.state(k).tasks[i-1],evidence:'Evidència del pas '+i}},preventDefault(){}});
  b.click({bbMove:'bf-'+i,status:'review'});
  if(i<5){const before=JSON.stringify(b.data);b.click({bbMove:'bf-'+(i+1),status:'active'});assert.equal(JSON.stringify(b.data),before);}
  b.role('teacher');b.fire('submit',{target:{id:'bb-review',dataset:{id:'bf-'+i},data:{comment:'Criteris comprovats per al pas '+i}},submitter:{value:'done'},preventDefault(){}});b.role('student');
  assert.equal(b.state(k).tasks[i-1].status,'done');
 }
 assert.match(b.html(),/Recorregut de prova completat/);assert.equal(b.state(k).submissions.length,5);assert.equal(b.state(k).tasks.every(t=>t.status==='done'),true);
});
test('future tasks cannot be edited or started by either demo role, including with removed dependencies',()=>{
 const b=boot();b.html();b.click({bbMove:'bf-1',status:'active'});const original=b.state();
 for(const role of ['student','teacher']){
  b.role(role);b.click({bbOpen:'bf-3'});assert.match(b.html(),/Tasca bloquejada · només consulta/);assert.match(b.html(),/<fieldset disabled>/);assert.doesNotMatch(b.html(),/data-bb-move="bf-3"/);
  assert.throws(()=>M.apply(original,{type:'save',task:{...original.tasks[2],dependencies:[],evidence:'Intent de salt'}},role),/bloquejada/);
  assert.throws(()=>M.apply(original,{type:'move',id:'bf-3',status:'active'},role),/bloquejada/);
 }
 assert.deepEqual(b.state(),original);
});
test('reopening an earlier step freezes all later work without deleting evidence or snapshots',()=>{
 let s=M.create('TFG');for(let i=1;i<=5;i++)s=M.apply(s,{type:'save',task:{id:'bf-'+i,title:'Pas '+i,deliverable:'Entrega',criteria:'Comprovable',requireEvidence:true,evidence:'Evidència '+i,dependencies:i>1?['bf-'+(i-1)]:[]}},'student');s.sequence=s.tasks.map(t=>t.id);
 for(let i=1;i<=3;i++){s=M.apply(s,{type:'move',id:'bf-'+i,status:'active'},'student');s=M.apply(s,{type:'move',id:'bf-'+i,status:'review'},'student');s=M.apply(s,{type:'move',id:'bf-'+i,status:'done',comment:'Validat'},'teacher');}
 s=M.apply(s,{type:'move',id:'bf-4',status:'active'},'student');const submissions=JSON.stringify(s.submissions),evidence=s.tasks[3].evidence;s=M.apply(s,{type:'move',id:'bf-1',status:'revise',comment:'Revisar l’abast'},'teacher');const original=JSON.stringify(s);
 assert.deepEqual(M.blockedBy(s,'bf-4'),['bf-1']);assert.throws(()=>M.apply(s,{type:'save',task:{...s.tasks[3],evidence:'Canvi'}},'student'),/bloquejada/);assert.throws(()=>M.apply(s,{type:'move',id:'bf-4',status:'review'},'student'),/bloquejada/);
 assert.equal(JSON.stringify(s),original);assert.equal(JSON.stringify(s.submissions),submissions);assert.equal(s.tasks[3].evidence,evidence);
});
test('legacy saved boards acquire the sequential policy without overwriting storage on read',()=>{
 const b=boot();b.html();b.click({bbMove:'bf-1',status:'active'});const legacy=b.state();delete legacy.sequence;legacy.tasks[2].status='active';legacy.tasks[2].evidence='Treball antic que cal conservar';const key='quelcom.befirst-board.TFG.v1',raw=JSON.stringify(legacy),restored=boot({[key]:raw});
 restored.html();restored.click({bbOpen:'bf-3'});assert.match(restored.html(),/Treball antic que cal conservar/);assert.match(restored.html(),/<fieldset disabled>/);restored.click({bbMove:'bf-3',status:'review'});assert.equal(restored.data[key],raw);
 assert.throws(()=>M.valid({...legacy,sequence:['bf-1','bf-1']}),/Seqüència/);
});
