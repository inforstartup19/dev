const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const id='12345678-1234-4234-8234-123456789abc',name=id+'--research.docx';
const firstTaskId='4af62297-b545-4786-b08d-6ce8e924adc5';
const flush=()=>new Promise(setImmediate);
async function harness(options={}){
 const {
  reviews=[],reviewError=false,analysisError=false,available=true,analysisWait=null,
  uploadImpl=null,documentSize=1024,role='student',route='research_plan',confirmImpl=null,
  startAt='#campus-treball/'+id, extraProjects=[], taskStatus='prepare', pilotProposals=[], feedbackImpl=null, defenseRead=async()=>null, defenseWrite=null
 }=options;
 const project={id,owner_id:'student',title:'Treball privat',kind:'TFM',revision:0,updated_at:'2026-11-19T12:00:00Z',
  orientation_route:route,orientation_first_step:route?'Primera tasca de prova':null,orientation_task_id:route?firstTaskId:null};
 const stored=new Map([project,...extraProjects].map(p=>[p.id,p]));
 const cards=new Map();
 if(route)cards.set(project.id,[{id:firstTaskId,project_id:id,status:taskStatus,title:'Primera tasca de prova',revision:0}]);
 let user=role;
 const handlers={},calls=[],createOptions=[];
 const originalFile={id,name,created_at:'2026-11-19T12:00:00Z',metadata:{size:documentSize}};
 const api={
  enroll:async()=>({role:user,university:'Centre de prova'}),projects:async()=>[...stored.values()],library:async()=>[],
  project:async key=>stored.has(key)?{...stored.get(key)}:null,
  tasks:async key=>(cards.get(key)||[]).map(x=>({...x})),history:async()=>[],projectHistory:async()=>[],proposals:async()=>pilotProposals,
  documents:async key=>key===id?[originalFile]:[],
  defense:async projectId=>{calls.push({method:'defense',args:[projectId]});return defenseRead(projectId);},
  saveDefense:async(...args)=>{calls.push({method:'saveDefense',args});return defenseWrite(...args);},
  createProject:async row=>{
   calls.push({method:'createProject',args:[row]});
   if(!stored.has(row.id))stored.set(row.id,{...row,revision:0,updated_at:'2026-11-19T12:00:00Z',orientation_route:null,orientation_task_id:null});
   return {...stored.get(row.id)};
  },
  confirmOrientation:async(...args)=>{
   calls.push({method:'confirmOrientation',args});
   if(confirmImpl)await confirmImpl(...args);
   const [key,newRoute,text]=args;
   const changed={...stored.get(key),orientation_route:newRoute,orientation_first_step:text,orientation_task_id:firstTaskId,revision:stored.get(key).revision+1};
   stored.set(key,changed);cards.set(key,[{id:firstTaskId,project_id:key,status:'prepare',title:text,revision:0}]);
   return {...changed};
  },
  uploadDocument:async(...args)=>{calls.push({method:'upload',args});if(uploadImpl)return uploadImpl(...args);},
  documentReviews:async()=>{if(reviewError)throw Error('offline');return reviews;},
  aiAvailability:async()=>({available,provider:'OpenAI'}),
  analyzeDocument:async(...args)=>{
   calls.push({method:'analyze',args});if(analysisWait)await analysisWait;if(analysisError)throw Error('Conservem la pregunta');
   return {id,created_at:'2026-11-19T12:00:00Z',storage_name:name,status:'completed',
    result:{summary:'Resum privat',improvements:[],newIdeas:[],questions:[],limitations:[]}};
  },
  saveTask:async(...args)=>{
   calls.push({method:'saveTask',args});if(feedbackImpl)await feedbackImpl();
   const [key,,fields]=args;Object.assign(cards.get(id).find(row=>row.id===key),fields);
  },
  review:async(...args)=>{
   calls.push({method:'review',args});if(feedbackImpl)await feedbackImpl();
   const [key,,fields]=args;Object.assign(pilotProposals.find(row=>row.id===key),fields);
  },
  createTask:async()=>{calls.push({method:'saveTask'});throw Error('Not expected without explicit submission');}
 };
 const location={
  get hash(){return this._hash;},
  set hash(value){this._hash=value.startsWith('#')?value:'#'+value;},
  replace(value){this.hash=value;}
 };
 location.hash=startAt;
 const c={
  routes:{},render(){},location,history:{replaceState(){}},
  document:{addEventListener:(type,fn)=>(handlers[type]??=[]).push(fn),querySelectorAll:()=>[],querySelector:()=>null,
   getElementById:()=>({scrollIntoView(){},focus(){}}),body:{classList:{toggle(){}}}},
  window:{addEventListener(){}},crypto:{randomUUID:require('node:crypto').randomUUID},
  QuelcomSession:{ready:async()=>({user:async()=>({id:user}),accessToken:async()=>'test',storageClient:()=>({})})},
  QuelcomAuthConfig:{},CampusPilotAPI:{create:options=>{createOptions.push(options);return api;},uuid:x=>x},
  FormData:class extends Map{constructor(form){super(Object.entries(form.values));}},confirm:()=>true,prompt:()=>null,setTimeout,URL,Blob,
 };
 vm.createContext(c);
 for(const sd of ['campus-orientation.js','campus-defense.js','campus-academic-path.js','campus-pilot.js']){
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../public',sd),'utf8'),c);
 }
 function fire(type,target={},submitter){
  const event={target,submitter,preventDefault(){},stopImmediatePropagation(){}};
  for(const fn of handlers[type]||[])fn(event);
 }
 function targetFor(dataset={},extra={}){
  const keySelector=key=>'[data-'+key.replace(/[A-Z]/g,letter=>'-'+letter.toLowerCase())+']';
  const el={dataset,...extra,closest(s){return s.split(',').some(piece=>Object.keys(dataset).some(key=>piece.trim()===keySelector(key)))?this:null;},
   matches(s){return !!this.closest(s);},focus(){},scrollIntoView(){}};
  return el;
 }
 const go=async hash=>{c.location.hash=hash;c.render();await flush();};
 await flush();await flush();
 return {c,calls,createOptions,project,stored,cards,go,
  selectKind(value){fire('change',targetFor({},{id:'cp-orientation-kind',value}));},
  changeFile(file){fire('change',targetFor({},{id:'cp-file',files:file?[file]:[]}));},
  dispatch(type){fire(type);},
  changeAccount(next){user=next;fire('quelcom-account-change');},
  html:()=>c.routes[c.location.hash.slice(1)]?.[1]()||'',
  click(dataset){fire('click',targetFor(dataset));},
  setWizard(dataset,value,kind='input'){fire(kind,targetFor(dataset,{value}));},
  submit(formId,values,action){fire('submit',{id:formId,values},action?{value:action}:undefined);},
  input(formId,values){fire('input',{closest:selector=>selector.includes('#'+formId)?{id:formId,values}:null});}
 };
}
function formMarkup(html,id){
 const form=html.match(new RegExp('<form id="'+id+'"[^>]*>[\\s\\S]*?</form>'));
 assert.ok(form,'Expected the rendered '+id+' form');
 return form[0];
}
const requiredMark=/<span class="required-mark" aria-hidden="true">\*<\/span>/;
test('project title alone is visibly and semantically required and saving is branded Quelcom',async()=>{
 const h=await harness();
 h.click({cp:'edit-project'});
 const form=formMarkup(h.html(),'cp-project');
 assert.match(form,/>Desa a Quelcom<\/button>/);
 assert.doesNotMatch(form.replace(/<[^>]+>/g,''),/Supabase|OpenAI|Inc AI/i);
 const labels=form.match(/<label\b[^>]*>[\s\S]*?<\/label>/g);
 assert.ok(labels.length>1);
 for(const label of labels){
  const title=label.includes('name="title"');
  assert.equal(requiredMark.test(label),title,label);
  assert.equal(/<(?:input|textarea)\b[^>]*\srequired\b/.test(label),title,label);
 }
});
test('analysis requires explicit external transfer consent and the question stays optional',async()=>{
 const h=await harness();
 h.click({cpAnalyze:name});
 const form=formMarkup(h.html(),'cp-analysis');
 const labels=form.match(/<label\b[^>]*>[\s\S]*?<\/label>/g);
 const consent=labels.find(label=>label.includes('name="consent"'));
 const question=labels.find(label=>label.includes('name="question"'));
 assert.match(consent,/type="checkbox"[^>]*\srequired\b/);
 assert.doesNotMatch(consent,/\schecked\b/);
 assert.match(consent,requiredMark);
 assert.match(consent,/enviar aquest document[\s\S]*proveïdor extern/i);
 assert.doesNotMatch(question,requiredMark);
 assert.doesNotMatch(form.replace(/<[^>]+>/g,''),/Supabase|OpenAI|Inc AI/i);
 assert.equal(h.calls.length,0);
});
test('unavailable AI and review-list failures keep the real workspace and upload form visible',async()=>{
 const h=await harness({reviewError:true,available:false});assert.match(h.html(),/Treball privat/);assert.match(h.html(),/Desa el document privat/);assert.match(h.html(),/pendent de configuració/);assert.match(h.html(),/No hem pogut recuperar les anàlisis/);
});
test('model text is escaped and a suggested task is only a draft until explicitly saved',async()=>{
 const review={id,status:'completed',storage_name:name,created_at:'2026-11-19T12:00:00Z',result:{summary:'<img src=x onerror=alert(1)>',improvements:[{title:'<script>Unsafe</script>',detail:'Revisa les hipòtesis'}],newIdeas:[],questions:['<b>Una pregunta</b>'],limitations:[],source:{name:'research.docx',sha256:'abc'}}};
 const h=await harness({reviews:[review]});assert.match(h.html(),/&lt;img/);assert.doesNotMatch(h.html(),/<img src=x/);
 h.click({cpAiTask:id,kind:'improvements',index:'0'});assert.match(h.html(),/Nova tasca o fita/);assert.match(h.html(),/Revisa les hipòtesis/);assert.match(h.html(),/Proposta preparada com a esborrany/);assert.equal(h.calls.length,0);
});
test('analysis errors preserve the question and consent; success clears only its analysis draft',async()=>{
 const failed=await harness({analysisError:true});failed.click({cpAnalyze:name});failed.submit('cp-analysis',{question:'Revisa el mostreig',consent:'on'});await flush();assert.match(failed.html(),/Revisa el mostreig/);assert.match(failed.html(),/Conservem la pregunta/);assert.match(failed.html(),/name="consent" required checked/);assert.equal(failed.calls[0].args[3],'Revisa el mostreig');
 const good=await harness();good.click({cpAnalyze:name});good.submit('cp-analysis',{question:'Dona idees',consent:'on'});await flush();assert.match(good.html(),/Resum privat/);assert.doesNotMatch(good.html(),/id="cp-analysis"/);
});
test('failed persisted analyses can be retried only through a new consent form',async()=>{
 const review={id,status:'failed',storage_name:name,question:'Conserva la pregunta',created_at:'2026-11-19T12:00:00Z'};const h=await harness({reviews:[review]});h.click({cpAiRetry:id});assert.match(h.html(),/Conserva la pregunta/);assert.match(h.html(),/id="cp-analysis"/);assert.doesNotMatch(h.html(),/name="consent" required checked/);assert.equal(h.calls.length,0);
});

test('an analysis finishing after an account change never reveals its private result',async()=>{
 let finish;const wait=new Promise(resolve=>finish=resolve);const h=await harness({analysisWait:wait});h.click({cpAnalyze:name});h.submit('cp-analysis',{question:'Pregunta privada',consent:'on'});h.dispatch('quelcom-account-change');finish();await flush();assert.doesNotMatch(h.html(),/Resum privat|Pregunta privada|Petició confirmada/);
});


test('50 MB attachment limit is visibly separate from the 10 MB AI limit',async()=>{
 const h=await harness({documentSize:20*1048576});assert.match(h.html(),/50 MB per fitxer/);assert.match(h.html(),/Anàlisi IA: fins a 10 MB per document/);assert.match(h.html(),/data-cp-analyze="[^"]+" disabled aria-describedby=/);assert.match(h.html(),/original continua disponible per descarregar/);h.click({cpAnalyze:name});assert.doesNotMatch(h.html(),/id="cp-analysis"/);assert.equal(h.calls.length,0);assert.equal(h.createOptions[0].userId,'student');
});
test('upload progress is accessible and a failed upload retains the same file and id for retry',async()=>{
 let callback,rejectUpload;const waiting=new Promise((_,reject)=>rejectUpload=reject);let attempt=0;
 const h=await harness({uploadImpl:async(project,file,uploadId,onProgress)=>{callback=onProgress;if(++attempt===1)return waiting;}});
 const freshUpload=formMarkup(h.html(),'cp-upload');
 assert.match(freshUpload,/id="cp-file"[^>]*\srequired\b/);
 assert.match(freshUpload,requiredMark);
 const file={name:'Large.docx',size:20*1048576};h.changeFile(file);h.submit('cp-upload',{});callback({loaded:5*1048576,total:file.size,percent:25});assert.match(h.html(),/id="cp-upload-meter" max="100" value="25"/);assert.match(h.html(),/role="status" aria-live="polite"/);assert.match(h.html(),/Carregant: 25%/);
 rejectUpload(Error('Connexió interrompuda'));await flush();assert.match(h.html(),/Càrrega interrompuda al 25%/);assert.match(h.html(),/Selecció pendent: Large.docx/);assert.match(h.html(),/Reintenta la càrrega/);
 const retryUpload=formMarkup(h.html(),'cp-upload');
 assert.doesNotMatch(retryUpload,/id="cp-file"[^>]*\srequired\b/);
 assert.doesNotMatch(retryUpload,requiredMark);
 h.submit('cp-upload',{});await flush();const uploads=h.calls.filter(x=>x.method==='upload');assert.equal(uploads.length,2);assert.equal(uploads[0].args[1],file);assert.equal(uploads[1].args[1],file);assert.equal(uploads[0].args[2],uploads[1].args[2]);assert.doesNotMatch(h.html(),/Selecció pendent: Large.docx/);assert.match(h.html(),/Document privat desat/);
});
test('late upload progress and completion are ignored after account change',async()=>{
 let progress,finish;const waiting=new Promise(resolve=>finish=resolve);const h=await harness({uploadImpl:async(_project,_file,_id,onProgress)=>{progress=onProgress;return waiting;}});h.changeFile({name:'Private.docx',size:20*1048576});h.submit('cp-upload',{});h.dispatch('quelcom-account-change');progress({loaded:15*1048576,total:20*1048576,percent:75});finish();await flush();assert.doesNotMatch(h.html(),/75%|Private.docx|Document privat desat/);
});
test('late upload progress and completion cannot update another route',async()=>{
 let progress,finish;const waiting=new Promise(resolve=>finish=resolve);const h=await harness({uploadImpl:async(_project,_file,_id,onProgress)=>{progress=onProgress;return waiting;}});h.changeFile({name:'Previous.docx',size:20*1048576});h.submit('cp-upload',{});h.c.location.hash='#campus';h.c.render();progress({loaded:15*1048576,total:20*1048576,percent:75});finish();await flush();const html=h.c.routes.campus[1]();assert.doesNotMatch(html,/75%|Previous.docx|Document privat desat/);
});

test('a student opening an older project can read its existing documents while the upload remains locked',async()=>{
 const h=await harness({route:null});
 const html=h.html();
 assert.match(html,/Treball privat/);
 assert.match(html,/research\.docx/);
 assert.match(html,/data-cp-download=/);
 assert.doesNotMatch(html,/id="cp-upload"|id="cp-file"/);
 assert.ok(!h.calls.length);
});

test('an assigned teacher can use the documents panel before student orientation',async()=>{
 const h=await harness({role:'teacher',route:null});
 assert.match(h.html(),/Docent assignat/);
 assert.match(h.html(),/id="cp-upload"/);
 assert.match(h.html(),/data-cp-download=/);
});

test('the upload control follows the selected project and its persisted orientation',async()=>{
 const otherId='ef31be32-10ef-4083-b87c-17a3bf43b447';
 const other={id:otherId,owner_id:'student',title:'Un altre treball',kind:'TR',revision:0,updated_at:'2026-11-19T12:00:00Z',orientation_route:null,orientation_task_id:null};
 const h=await harness({extraProjects:[other]});
 assert.match(h.html(),/id="cp-upload"/);
 await h.go('#campus-treball/'+otherId);
 assert.match(h.html(),/Un altre treball/);
 assert.doesNotMatch(h.html(),/id="cp-upload"|research\.docx/);
 await h.go('#campus-treball/'+id);
 assert.match(h.html(),/id="cp-upload"/);
});

test('the uploaded document gate is also enforced by selection and submit handlers',async()=>{
 const h=await harness({route:null});
 h.changeFile({name:'Example.pdf',size:1024});
 h.submit('cp-upload',{});
 await flush();
 assert.equal(h.calls.filter(call=>call.method==='upload').length,0);
 assert.doesNotMatch(h.html(),/Selecció pendent: Example.pdf/);
});

function orient(h,action,value){
 const html=h.html();
 assert.ok(html.includes('data-orient-action="'+action+'"'),'The action must be visible: '+action);
 if(value)assert.ok(html.includes('data-orient-value="'+value+'"'),'The choice must be visible: '+value);
 h.click({orientAction:action,orientValue:value});
}
function chooseResearchData(h){
 orient(h,'choose','research');orient(h,'choose','empirical');
}
function prepareNew(h,kind){
 h.click({cp:'new-project'});
 assert.match(h.html(),/id="cp-orientation-kind"/);
 assert.doesNotMatch(h.html(),/id="cp-project"/);
 h.selectKind(kind);
}

test('each new TR, TFG and TFM shows the guide before the title, then saves a project and one first card',async()=>{
 for(const kind of ['TR','TFG','TFM']){
  const h=await harness({startAt:'#campus'});
  prepareNew(h,kind);
  chooseResearchData(h);
  const firstStep='Comprova les unitats de la sèrie '+kind;
  h.setWizard({orientTask:''},firstStep);
  orient(h,'confirm');
  assert.match(h.html(),/id="cp-project"/);
  assert.equal(h.calls.length,0);
  h.submit('cp-project',{title:'Projecte de prova',kind});
  await flush();await flush();
  const [create,confirm]=h.calls;
  assert.equal(create.method,'createProject');assert.equal(create.args[0].kind,kind);
  assert.equal(confirm.method,'confirmOrientation');assert.deepEqual(confirm.args,[create.args[0].id,'empirical',firstStep,0]);
  assert.equal(h.cards.get(create.args[0].id).length,1);
  assert.ok(h.html().includes(firstStep));assert.match(h.html(),/id="cp-upload"/);
 }
});

test('the direct route still requires a valid approach and editable first step',async()=>{
 const h=await harness({route:null});
 orient(h,'direct');orient(h,'confirm');
 assert.equal(h.calls.length,0);
 assert.doesNotMatch(h.html(),/id="cp-upload"/);
 h.setWizard({orientRoute:''},'prototype','change');
 h.setWizard({orientTask:''},'  ');
 orient(h,'confirm');
 assert.equal(h.calls.length,0);
 const text='Prova el prototip amb deu lots ficticis';
 h.setWizard({orientTask:''},text);
 orient(h,'confirm');
 await flush();
 assert.deepEqual(h.calls.map(call=>call.method),['confirmOrientation']);
 assert.deepEqual(h.calls[0].args,[id,'prototype',text,0]);
 assert.match(h.html(),/id="cp-upload"/);
});

test('a failed confirmation after creating preserves the project, the revised first task and the upload gate',async()=>{
 let attempts=0;
 const h=await harness({startAt:'#campus',confirmImpl:()=>{if(++attempts===1)throw Error('Connexió interrompuda');}});
 prepareNew(h,'TR');
 orient(h,'choose','examples');orient(h,'choose','apply');orient(h,'choose','prototype');
 const task='Mesura les cues al pati durant un descans';
 h.setWizard({orientTask:''},task);orient(h,'confirm');
 h.submit('cp-project',{kind:'TR',title:'Cues al pati'});
 await flush();await flush();
 assert.match(h.html(),/Cues al pati/);
 assert.ok(h.html().includes(task));assert.doesNotMatch(h.html(),/id="cp-upload"/);
 orient(h,'confirm');
 await flush();
 assert.match(h.html(),/id="cp-upload"/);
 const created=h.calls.filter(x=>x.method==='createProject'),confirmations=h.calls.filter(x=>x.method==='confirmOrientation');
 assert.equal(created.length,1);assert.equal(confirmations.length,2);assert.deepEqual(confirmations[0].args,confirmations[1].args);
 assert.equal(h.cards.get(created[0].args[0].id).length,1);
});

test('an existing project stays locked on conflict and retains the draft for revision and retry',async()=>{
 let attempts=0;
 const h=await harness({route:null,confirmImpl:()=>{if(++attempts===1)throw Error('Conflicte de versió');}});
 chooseResearchData(h);
 h.setWizard({orientTask:''},'Una primera tasca editable');
 orient(h,'confirm');
 await flush();
 assert.match(h.html(),/Conflicte de versió/);
 assert.match(h.html(),/Una primera tasca editable/);
 assert.doesNotMatch(h.html(),/id="cp-upload"/);
 h.stored.get(id).revision=1;
 h.click({cp:'reload'});
 await flush();
 orient(h,'confirm');await flush();
 assert.equal(h.calls[1].args[3],1);
 assert.match(h.html(),/id="cp-upload"/);
});

test('a pending orientation completion never reveals the old account’s draft or success',async()=>{
 let finish;
 const pending=new Promise(resolve=>finish=resolve);
 const h=await harness({route:null,confirmImpl:()=>pending});
 chooseResearchData(h);
 h.setWizard({orientTask:''},'Tasca de demostració del compte anterior');
 orient(h,'confirm');h.changeAccount('another-student');finish();await flush();
 assert.doesNotMatch(h.html(),/Tasca de demostració del compte anterior|Orientació desada|id="cp-upload"/);
});

test('teacher task review waits for a required comment and keeps it available after a failed save',async()=>{
 let attempts=0;
 const teacher=await harness({role:'teacher',taskStatus:'review',feedbackImpl:async()=>{
  if(++attempts===1)throw Error('Connexió interrompuda');
 }});
 teacher.click({cpMove:firstTaskId,status:'revise'});
 const form=formMarkup(teacher.html(),'cp-feedback');
 assert.match(form,requiredMark);
 assert.match(form,/<textarea name="comment"[^>]* required/);
 assert.equal(teacher.calls.length,0);
 teacher.submit('cp-feedback',{comment:'  '});
 assert.equal(teacher.calls.length,0);
 teacher.submit('cp-feedback',{comment:'Concreta el mostreig.'});
 await flush();
 assert.match(formMarkup(teacher.html(),'cp-feedback'),/>Concreta el mostreig\.<\/textarea>/);
 teacher.submit('cp-feedback',{comment:'Concreta el mostreig.'});
 await flush();
 assert.equal(teacher.calls.length,2);
 const [task,revision,fields]=teacher.calls[1].args;
 assert.equal(task,firstTaskId);assert.equal(revision,0);
 assert.equal(fields.status,'revise');assert.equal(fields.review_comment,'Concreta el mostreig.');
 assert.doesNotMatch(teacher.html(),/id="cp-feedback"/);
});

test('teacher excerpt review can be cancelled and saves its required comment on confirmation',async()=>{
 const row={id,status:'pending',revision:2,title:'Aprenentatge',summary:'Context',learning:'Resultat'};
 const teacher=await harness({role:'teacher',pilotProposals:[row]});
 teacher.click({cpReview:id,status:'published'});
 assert.match(formMarkup(teacher.html(),'cp-feedback'),requiredMark);
 teacher.click({cp:'cancel-feedback'});
 assert.equal(teacher.calls.length,0);
 assert.doesNotMatch(teacher.html(),/id="cp-feedback"/);
 teacher.click({cpReview:id,status:'changes'});
 teacher.submit('cp-feedback',{comment:'  Aclareix el resultat.  '});
 await flush();
 assert.equal(teacher.calls.length,1);
 assert.equal(teacher.calls[0].method,'review');
 const [proposal,revision,fields]=teacher.calls[0].args;
 assert.equal(proposal,id);assert.equal(revision,2);
 assert.equal(fields.status,'changes');assert.equal(fields.review_comment,'Aclareix el resultat.');
});

test('starting a task does not ask the student for a teacher review comment',async()=>{
 const student=await harness();
 student.click({cpMove:firstTaskId,status:'active'});
 await flush();
 assert.equal(student.calls[0].args[2].status,'active');
 assert.equal(Object.hasOwn(student.calls[0].args[2],'review_comment'),false);
 assert.doesNotMatch(student.html(),/id="cp-feedback"/);
});

const rehearsalValues={outline:'Guió sintètic',questions:'Mètode i límits',attachment:'',talk_minutes:'15',question_minutes:'10'};
function rehearsalRecord(state='draft',revision=1,params={}){
 return {project_id:id,...rehearsalValues,talk_minutes:15,question_minutes:10,feedback:null,status:state,revision,...params};
}
test('a private project opens the rehearsal on demand and requires an explicit save or submission',async()=>{
 const h=await harness({defenseWrite:async()=>rehearsalRecord('submitted')});
 assert.match(h.html(),/Espai de presentacions/);assert.equal(h.calls.length,0);
 h.click({defenseOpen:''});await flush();assert.match(h.html(),/id="cp-defense-student"/);
 assert.deepEqual(h.calls.map(c=>c.method),['defense']);
 h.submit('cp-defense-student',{...rehearsalValues,outline:'  '},'submit');
 assert.equal(h.calls.length,1);assert.match(h.html(),/Escriu un guió/);
 h.submit('cp-defense-teacher',{feedback:'cap'},'validate');assert.equal(h.calls.length,1);
 h.submit('cp-defense-student',rehearsalValues,'submit');await flush();
 const write=h.calls[1];assert.deepEqual(write.args.slice(0,3),[id,0,'submit']);assert.equal(write.args[3].talk_minutes,15);
 assert.match(h.html(),/Assaig enviat/);assert.doesNotMatch(h.html(),/id="cp-defense-student"/);
 h.click({defenseClose:''});assert.match(h.html(),/data-defense-open/);
});
test('tutors only review a submitted rehearsal and send feedback separately',async()=>{
 const h=await harness({role:'teacher',defenseRead:async()=>rehearsalRecord('submitted',3),
  defenseWrite:async()=>rehearsalRecord('changes_requested',4,{feedback:'Justifica el mètode.'})});
 h.click({defenseOpen:''});await flush();assert.match(h.html(),/id="cp-defense-teacher"/);
 h.submit('cp-defense-teacher',{feedback:'  '},'return');assert.equal(h.calls.length,1);
 h.submit('cp-defense-student',rehearsalValues,'save');assert.equal(h.calls.length,1);
 h.submit('cp-defense-teacher',{feedback:'Justifica el mètode.'},'return');await flush();
 const write=h.calls[1];assert.equal(write.args[1],3);assert.equal(write.args[2],'return');assert.deepEqual(Object.keys(write.args[3]),['feedback']);
 assert.match(h.html(),/Justifica el mètode/);assert.doesNotMatch(h.html(),/id="cp-defense-teacher"/);
});
test('a failed read cannot create or submit a rehearsal; retry recovers read access',async()=>{
 let reads=0;const h=await harness({defenseRead:async()=>{if(!reads++)throw Error('Servei indisponible');return null;}});
 h.click({defenseOpen:''});await flush();assert.match(h.html(),/Reintenta la consulta/);
 assert.doesNotMatch(h.html(),/id="cp-defense-student"/);
 h.submit('cp-defense-student',rehearsalValues,'save');assert.equal(h.calls.length,1);
 h.click({defenseRefresh:''});await flush();assert.match(h.html(),/id="cp-defense-student"/);
});
test('a stale rehearsal keeps the draft and disables additional writes until explicitly reloaded',async()=>{
 let version=1;
 const h=await harness({defenseRead:async()=>rehearsalRecord('draft',version,{outline:'Guió desat '+version}),
  defenseWrite:async()=>{version=2;throw Object.assign(Error('Versió més recent'),{code:'conflict'});}});
 h.click({defenseOpen:''});await flush();h.submit('cp-defense-student',rehearsalValues,'save');await flush();
 assert.match(h.html(),/Guió sintètic/);assert.match(h.html(),/data-defense-refresh/);
 h.submit('cp-defense-student',rehearsalValues,'save');assert.equal(h.calls.filter(x=>x.method==='saveDefense').length,1);
 h.click({defenseRefresh:''});await flush();assert.match(h.html(),/Guió desat 2/);assert.match(h.html(),/Guió sintètic/);
});
test('closing, switching project or signing out never reveals a late rehearsal response',async()=>{
 let finish;const second='87345678-1234-4234-8234-123456789abc';
 const h=await harness({extraProjects:[{id:second,kind:'TR',owner_id:'student',revision:0,title:'Altre treball'}],defenseRead:async projectId=>
  projectId===id?new Promise(resolve=>{finish=resolve;}):null});
 h.click({defenseOpen:''});await h.go('#campus-treball/'+second);h.click({defenseOpen:''});await flush();
 finish(rehearsalRecord('draft',1,{outline:'Private in first room'}));await flush();
 assert.doesNotMatch(h.html(),/Private in first room/);assert.match(h.html(),/id="cp-defense-student"/);
 h.input('cp-defense-student',{...rehearsalValues,outline:'Private in second room'});
 h.click({defenseClose:''});h.click({defenseOpen:''});await flush();assert.match(h.html(),/Private in second room/);
 h.changeAccount('teacher');await h.go('#campus-treball/'+second);h.click({defenseOpen:''});await flush();
 assert.doesNotMatch(h.html(),/Private in second room|id="cp-defense-student"/);
});
test('an academic phase template is prepared as an editable task without a write',async()=>{
 const h=await harness();assert.match(h.html(),/data-cp="academic-task"/);
 h.click({cp:'academic-task'});assert.match(h.html(),/id="cp-task"/);assert.equal(h.calls.length,0);
 const teacher=await harness({role:'teacher'});teacher.click({cp:'academic-task'});assert.match(teacher.html(),/id="cp-task"/);
 assert.equal(teacher.calls.length,0);
});
