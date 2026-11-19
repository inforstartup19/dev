const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const id='12345678-1234-4234-8234-123456789abc',name=id+'--research.docx';
const flush=()=>new Promise(setImmediate);
async function harness({reviews=[],reviewError=false,analysisError=false,available=true,analysisWait=null}={}){
 const handlers={},calls=[],project={id,owner_id:'student',title:'Treball privat',kind:'TFM',revision:0,updated_at:'2026-11-19T12:00:00Z'},document={id,name,created_at:'2026-11-19T12:00:00Z'};
 const api={enroll:async()=>({role:'student'}),projects:async()=>[project],library:async()=>[],project:async()=>project,tasks:async()=>[],history:async()=>[],projectHistory:async()=>[],proposals:async()=>[],documents:async()=>[document],documentReviews:async()=>{if(reviewError)throw Error('offline');return reviews},aiAvailability:async()=>({available,provider:'OpenAI'}),analyzeDocument:async(...args)=>{calls.push({method:'analyze',args});if(analysisWait)await analysisWait;if(analysisError)throw Error('Conservem la pregunta');return {id,created_at:'2026-11-19T12:00:00Z',storage_name:name,status:'completed',result:{summary:'Resum privat',improvements:[],newIdeas:[],questions:[],limitations:[]}}},createTask:async()=>{calls.push({method:'saveTask'});throw Error('Not expected without explicit submission')}};
 const c={routes:{},render(){},location:{hash:'#campus-treball/'+id,replace(){}},history:{replaceState(){}},document:{addEventListener:(type,fn)=>(handlers[type]??=[]).push(fn),querySelectorAll:()=>[],getElementById:()=>({scrollIntoView(){}}),body:{classList:{toggle(){}}}},window:{addEventListener(){}},crypto:{randomUUID:()=>id},QuelcomSession:{ready:async()=>({user:async()=>({id:'student'}),accessToken:async()=>'jwt',storageClient:()=>({})})},QuelcomAuthConfig:{},CampusPilotAPI:{create:()=>api,uuid:x=>x},FormData:class extends Map{constructor(form){super(Object.entries(form.values))}},confirm:()=>true,prompt:()=>null,setTimeout,URL,Blob};
 vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/campus-pilot.js'),'utf8'),c);
 await flush();await flush();
 return {c,calls,dispatch(type){for(const fn of handlers[type]||[])fn();},html:()=>c.routes['campus-treball/'+id][1](),click(dataset){const b={dataset},ev={target:{closest:selector=>selector.startsWith('a[')?null:b},preventDefault(){},stopImmediatePropagation(){}};for(const fn of handlers.click||[])fn(ev);},submit(formId,values){const ev={target:{id:formId,values},preventDefault(){}};for(const fn of handlers.submit||[])fn(ev);},input(formId,values){const ev={target:{closest:selector=>selector.includes('#'+formId)?{id:formId,values}:null}};for(const fn of handlers.input||[])fn(ev);}};
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
