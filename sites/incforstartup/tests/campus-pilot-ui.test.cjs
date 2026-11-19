const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const id='12345678-1234-4234-8234-123456789abc',name=id+'--research.docx';
const flush=()=>new Promise(setImmediate);
async function harness({reviews=[],reviewError=false,analysisError=false,available=true,analysisWait=null,uploadImpl=null,documentSize=1024}={}){
 const handlers={},calls=[],project={id,owner_id:'student',title:'Treball privat',kind:'TFM',revision:0,updated_at:'2026-11-19T12:00:00Z'},document={id,name,created_at:'2026-11-19T12:00:00Z',metadata:{size:documentSize}};const createOptions=[];
 const api={uploadDocument:async(...args)=>{calls.push({method:'upload',args});if(uploadImpl)return uploadImpl(...args);},enroll:async()=>({role:'student'}),projects:async()=>[project],library:async()=>[],project:async()=>project,tasks:async()=>[],history:async()=>[],projectHistory:async()=>[],proposals:async()=>[],documents:async()=>[document],documentReviews:async()=>{if(reviewError)throw Error('offline');return reviews},aiAvailability:async()=>({available,provider:'OpenAI'}),analyzeDocument:async(...args)=>{calls.push({method:'analyze',args});if(analysisWait)await analysisWait;if(analysisError)throw Error('Conservem la pregunta');return {id,created_at:'2026-11-19T12:00:00Z',storage_name:name,status:'completed',result:{summary:'Resum privat',improvements:[],newIdeas:[],questions:[],limitations:[]}}},createTask:async()=>{calls.push({method:'saveTask'});throw Error('Not expected without explicit submission')}};
 const c={routes:{},render(){},location:{hash:'#campus-treball/'+id,replace(){}},history:{replaceState(){}},document:{addEventListener:(type,fn)=>(handlers[type]??=[]).push(fn),querySelectorAll:()=>[],getElementById:()=>({scrollIntoView(){}}),body:{classList:{toggle(){}}}},window:{addEventListener(){}},crypto:{randomUUID:()=>id},QuelcomSession:{ready:async()=>({user:async()=>({id:'student'}),accessToken:async()=>'jwt',storageClient:()=>({})})},QuelcomAuthConfig:{},CampusPilotAPI:{create:options=>{createOptions.push(options);return api;},uuid:x=>x},FormData:class extends Map{constructor(form){super(Object.entries(form.values))}},confirm:()=>true,prompt:()=>null,setTimeout,URL,Blob};
 vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/campus-pilot.js'),'utf8'),c);
 await flush();await flush();
 return {c,calls,createOptions,changeFile(file){const ev={target:{id:'cp-file',files:file?[file]:[],closest:()=>null}};for(const fn of handlers.change||[])fn(ev);},dispatch(type){for(const fn of handlers[type]||[])fn();},html:()=>c.routes['campus-treball/'+id][1](),click(dataset){const b={dataset},ev={target:{closest:selector=>selector.startsWith('a[')?null:b},preventDefault(){},stopImmediatePropagation(){}};for(const fn of handlers.click||[])fn(ev);},submit(formId,values){const ev={target:{id:formId,values},preventDefault(){}};for(const fn of handlers.submit||[])fn(ev);},input(formId,values){const ev={target:{closest:selector=>selector.includes('#'+formId)?{id:formId,values}:null}};for(const fn of handlers.input||[])fn(ev);}};
}
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
 const file={name:'Large.docx',size:20*1048576};h.changeFile(file);h.submit('cp-upload',{});callback({loaded:5*1048576,total:file.size,percent:25});assert.match(h.html(),/id="cp-upload-meter" max="100" value="25"/);assert.match(h.html(),/role="status" aria-live="polite"/);assert.match(h.html(),/Carregant: 25%/);
 rejectUpload(Error('Connexió interrompuda'));await flush();assert.match(h.html(),/Càrrega interrompuda al 25%/);assert.match(h.html(),/Selecció pendent: Large.docx/);assert.match(h.html(),/Reintenta la càrrega/);
 h.submit('cp-upload',{});await flush();const uploads=h.calls.filter(x=>x.method==='upload');assert.equal(uploads.length,2);assert.equal(uploads[0].args[1],file);assert.equal(uploads[1].args[1],file);assert.equal(uploads[0].args[2],uploads[1].args[2]);assert.doesNotMatch(h.html(),/Selecció pendent: Large.docx/);assert.match(h.html(),/Document privat desat/);
});
test('late upload progress and completion are ignored after account change',async()=>{
 let progress,finish;const waiting=new Promise(resolve=>finish=resolve);const h=await harness({uploadImpl:async(_project,_file,_id,onProgress)=>{progress=onProgress;return waiting;}});h.changeFile({name:'Private.docx',size:20*1048576});h.submit('cp-upload',{});h.dispatch('quelcom-account-change');progress({loaded:15*1048576,total:20*1048576,percent:75});finish();await flush();assert.doesNotMatch(h.html(),/75%|Private.docx|Document privat desat/);
});
test('late upload progress and completion cannot update another route',async()=>{
 let progress,finish;const waiting=new Promise(resolve=>finish=resolve);const h=await harness({uploadImpl:async(_project,_file,_id,onProgress)=>{progress=onProgress;return waiting;}});h.changeFile({name:'Previous.docx',size:20*1048576});h.submit('cp-upload',{});h.c.location.hash='#campus';h.c.render();progress({loaded:15*1048576,total:20*1048576,percent:75});finish();await flush();const html=h.c.routes.campus[1]();assert.doesNotMatch(html,/75%|Previous.docx|Document privat desat/);
});
