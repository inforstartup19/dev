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
 await assert.rejects(api.uploadDocument(id,{size:10485761,name:'big.pdf'},id),/10 MB/);
 await assert.rejects(api.uploadDocument(id,{size:12,name:'fake.pdf',slice:()=>new Blob(['WRONG'])},id),/capçalera/);
 const file=new File(['%PDF-1.7 test'],'Treball de recerca.pdf',{type:'application/pdf'});
 const path=await api.uploadDocument(id,file,id);assert.equal(path,id+'/'+id+'--Treball_de_recerca.pdf');assert.equal(calls[0][2].upsert,false);
});

test('retry after an ambiguous create cannot silently discard newly edited text',async()=>{const {api,calls}=setup([{status:200,body:[{id,title:'Original'}]}]);await assert.rejects(api.createProject({id,title:'Edited after timeout'}),/altre contingut/);assert.equal(calls.length,1);});
