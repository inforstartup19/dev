const test=require('node:test'),assert=require('node:assert/strict');
const {create,uuid}=require('../public/campus-pilot-api.js');
const id='12345678-1234-4234-8234-123456789abc';
function setup(responses,token='test-token'){const calls=[];const api=create({config:{url:'https://test.supabase.co',publishableKey:'sb_publishable_test'},token:async()=>token,fetcher:async(url,opts)=>{calls.push({url,...opts});const r=responses.shift();return{ok:r.status<400,status:r.status,json:async()=>r.body};}});return {api,calls};}
test('private data requests require a session and forward JWT, never a service key',async()=>{const {api,calls}=setup([],null);await assert.rejects(api.projects(),/sessió/);assert.equal(calls.length,0);const s=setup([{status:200,body:[]}]);await s.api.projects();assert.equal(s.calls[0].headers.Authorization,'Bearer test-token');assert.equal(s.calls[0].headers.apikey,'sb_publishable_test');});
test('updates include expected revision and preserve conflicts as errors',async()=>{const {api,calls}=setup([{status:200,body:[]}]);await assert.rejects(api.saveProject(id,3,{title:'Draft'}),/versió més recent/);assert.match(calls[0].url,/revision=eq.3/);assert.deepEqual(JSON.parse(calls[0].body),{title:'Draft'});});
test('create retry reuses the same UUID and existing record instead of duplicating',async()=>{const {api,calls}=setup([{status:200,body:[{id,title:'Saved'}]}]);const p=await api.createProject({id,title:'Saved'});assert.equal(p.id,id);assert.equal(calls.length,1);assert.equal(calls[0].method,'GET');});
test('enrollment and shared excerpts use narrowly scoped RPCs',async()=>{const {api,calls}=setup([{status:200,body:null},{status:200,body:[]}]);assert.equal(await api.enroll(),null);assert.deepEqual(await api.library(),[]);assert.match(calls[0].url,/rpc\/qc_accept_pilot$/);assert.match(calls[1].url,/rpc\/qc_library_feed$/);});
test('invalid identifiers and revisions cannot alter filters',async()=>{assert.throws(()=>uuid(id+'?select=*'));const {api,calls}=setup([]);await assert.rejects(api.saveTask(id,-1,{}));assert.equal(calls.length,0);});
test('network failure does not claim a successful save',async()=>{const api=create({config:{url:'https://test.supabase.co',publishableKey:'sb_publishable_test'},token:async()=>'test',fetcher:async()=>{throw Error('offline')}});await assert.rejects(api.saveProject(id,0,{title:'Pending'}),/Conservem el text/);});
test('PDF uploads are bounded, checked and immutable',async()=>{
 const calls=[];const bucket={upload:async(...args)=>{calls.push(args);return{};}};
 const api=create({config:{},token:async()=>'test',storage:{from:()=>bucket}});
 await assert.rejects(api.uploadDocument(id,{size:52428801,name:'big.pdf'},id),/50 MB/);
 await assert.rejects(api.uploadDocument(id,new File(['WRONG'], 'fake.pdf'),id),/PDF|capçalera/);
 const file=new File(['%PDF-1.7 test'],'Treball de recerca.pdf',{type:'application/pdf'});
 const path=await api.uploadDocument(id,file,id);assert.equal(path,id+'/'+id+'--Treball_de_recerca.pdf');assert.equal(calls[0][2].upsert,false);
});

test('retry after an ambiguous create cannot silently discard newly edited text',async()=>{const {api,calls}=setup([{status:200,body:[{id,title:'Original'}]}]);await assert.rejects(api.createProject({id,title:'Edited after timeout'}),/altre contingut/);assert.equal(calls.length,1);});


test('document analysis requires explicit consent, valid scope and a session',async()=>{
 const s=setup([]);const name=id+'--work.docx';
 await assert.rejects(s.api.analyzeDocument(id,name,id,'Review',false),/autoritzar/);
 await assert.rejects(s.api.analyzeDocument(id,'../other.pdf',id,'',true),/Document/);
 await assert.rejects(s.api.analyzeDocument(id,name,id,'x'.repeat(2001),true),/2.000/);
 assert.equal(s.calls.length,0);
 const anonymous=setup([],null);await assert.rejects(anonymous.api.aiAvailability(),/sessió/);assert.equal(anonymous.calls.length,0);
});
test('AI requests use the current user JWT and preserve request identity for retries',async()=>{
 const row={id,status:'completed',storage_name:id+'--work.xlsx',result:{summary:'Checked'}};
 const s=setup([{status:200,body:{review:row}}]);
 assert.deepEqual(await s.api.analyzeDocument(id,row.storage_name,id,'Compare costs',true),row);
 assert.match(s.calls[0].url,/functions\/v1\/campus-document-review$/);
 assert.equal(s.calls[0].headers.Authorization,'Bearer test-token');
 assert.deepEqual(JSON.parse(s.calls[0].body),{projectId:id,storageName:row.storage_name,requestId:id,question:'Compare costs',consent:true});
});
test('AI availability and historical reviews are read separately from the workspace',async()=>{
 const s=setup([{status:200,body:{available:false,provider:'OpenAI'}},{status:200,body:[]}]);
 assert.equal((await s.api.aiAvailability()).available,false);assert.equal(s.calls[0].method,'GET');assert.equal(s.calls[0].body,undefined);
 await s.api.documentReviews(id);assert.match(s.calls[1].url,/qc_document_reviews\?project_id=eq\./);assert.match(s.calls[1].url,/limit=30/);
});
test('missing AI configuration and denied access never become successful analysis',async()=>{
 for(const [status,message] of [[403,/accés/],[429,/límit/],[409,/en curs/]]){
  const s=setup([{status,body:{}}]);await assert.rejects(s.api.analyzeDocument(id,id+'--work.pptx',id,'',true),message);
 }
 const malformed=setup([{status:200,body:{output:'not persisted'}}]);await assert.rejects(malformed.api.analyzeDocument(id,id+'--work.doc',id,'',true),/confirmar el resultat/);
});
test('missing configuration is distinct from transient provider failures',async()=>{
 const missing=setup([{status:503,body:{error:'not_configured'}}]);await assert.rejects(missing.api.aiAvailability(),/pendent de configuració/);
 const temporary=setup([{status:503,body:{error:'service_unavailable',message:'El servei no respon. Torna-ho a provar més endavant.'}}]);await assert.rejects(temporary.api.analyzeDocument(id,id+'--work.pdf',id,'',true),error=>/servei no respon/.test(error.message)&&!/configuració/.test(error.message));
});
test('AI network errors retain the question and advise checking saved results before retry',async()=>{
 const api=create({config:{url:'https://test.supabase.co'},token:async()=>'jwt',fetcher:async()=>{throw Error('timeout')}});
 await assert.rejects(api.analyzeDocument(id,id+'--work.pdf',id,'Question',true),/Conservem la pregunta/);
});

test('Office uploads keep private immutable paths and explicit MIME types',async()=>{
 const calls=[],ole=Buffer.alloc(512);Buffer.from('d0cf11e0a1b11ae1','hex').copy(ole);
 const bucket={upload:async(...args)=>{calls.push(args);return{};},download:async path=>({data:path})};
 const api=create({config:{},token:async()=>'test',storage:{from:bucketId=>{assert.equal(bucketId,'qc-campus-documents');return bucket;}}});
 for(const [extension,mime] of [['doc','application/msword'],['xls','application/vnd.ms-excel'],['ppt','application/vnd.ms-powerpoint']]){
  const result=await api.uploadDocument(id,new File([ole],'Memòria.'+extension,{type:'application/octet-stream'}),id);
  assert.equal(result,id+'/'+id+'--Memoria.'+extension);assert.equal(calls.at(-1)[2].contentType,mime);assert.equal(calls.at(-1)[2].upsert,false);
 }
 for(const extension of ['docx','xlsx','pptx'])assert.equal(await api.downloadDocument(id,id+'--work.'+extension),id+'/'+id+'--work.'+extension);
 await assert.rejects(api.downloadDocument(id,id+'--../work.docx'),/Document no vàlid/);
});

test('large Campus uploads use authenticated resumable chunks rather than SDK whole-file upload',async()=>{
 const user='22222222-2222-4222-8222-222222222222',token='head.'+Buffer.from(JSON.stringify({sub:user})).toString('base64url')+'.sig';
 const file=new File(['%PDF-1.7',new Uint8Array(7*1024*1024)],'large.pdf',{type:'application/pdf'});let offset=0;const calls=[],progress=[];
 const api=create({config:{url:'https://test.supabase.co',publishableKey:'public'},userId:user,token:async()=>token,storage:{from:()=>({upload(){throw Error('Whole-file upload must not run')}})},fetcher:async(url,options)=>{calls.push({url,...options});if(options.method==='POST')return new Response(null,{status:201,headers:{Location:url+'/id'}});if(options.method==='HEAD')return new Response(null,{status:200,headers:{'Upload-Length':String(file.size),'Upload-Offset':String(offset)}});offset+=options.body.size;return new Response(null,{status:204,headers:{'Upload-Offset':String(offset)}});}});
 assert.equal(await api.uploadDocument(id,file,id,p=>progress.push(p)),id+'/'+id+'--large.pdf');assert.deepEqual(calls.map(c=>c.method),['POST','HEAD','PATCH','PATCH']);assert.equal(calls[2].body.size,6*1024*1024);assert.equal(progress.at(-1).percent,100);
});
test('existing-object retries require matching exact private name, size and MIME',async()=>{
 const file=new File(['%PDF-1.7 small'],'small.pdf',{type:'application/pdf'}),name=id+'--small.pdf';
 for(const metadata of [{size:file.size,mimetype:'application/pdf'},{size:file.size+1,mimetype:'application/pdf'},{size:file.size,mimetype:'text/html'}]){
  const api=create({config:{},token:async()=>'test',storage:{from:()=>({upload:async()=>({error:{statusCode:409}}),list:async()=>({data:[{name,metadata}]})})}});
  if(metadata.size===file.size&&metadata.mimetype==='application/pdf')assert.equal(await api.uploadDocument(id,file,id),id+'/'+name);else await assert.rejects(api.uploadDocument(id,file,id),/confirmar la versió/);
 }
});
