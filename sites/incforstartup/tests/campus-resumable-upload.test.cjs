const test=require('node:test'),assert=require('node:assert/strict');
const {create,chunkSize,maxFileSize}=require('../public/campus-resumable-upload.js');
const user='22222222-2222-4222-8222-222222222222',project='11111111-1111-4111-8111-111111111111',id='33333333-3333-4333-8333-333333333333';
const path=project+'/'+id+'--document.pdf',endpoint='https://test.storage.supabase.co/storage/v1/upload/resumable',url=endpoint+'/private-upload';
const jwt=(sub,version=1)=>'header.'+Buffer.from(JSON.stringify({sub,version})).toString('base64url')+'.signature';
const res=(status,headers={})=>new Response(null,{status,headers});
function file(size=chunkSize*2+123){const slices=[];return {size,slices,slice(start,end){slices.push([start,end]);return {size:end-start,start,end};}};}
function setup({onRequest,token=async()=>jwt(user),wait=async()=>{}}={}){
 const calls=[];let offset=0,total=0;const fetcher=async(target,options)=>{calls.push({target,...options});const custom=await onRequest?.(target,options,calls.length,{get offset(){return offset},set offset(v){offset=v},get total(){return total}});if(custom)return custom;
 if(options.method==='POST'){total=Number(options.headers['Upload-Length']);return res(201,{Location:url});}
 if(options.method==='HEAD')return res(200,{'Upload-Offset':String(offset),'Upload-Length':String(total)});
 if(options.method==='PATCH'){assert.equal(Number(options.headers['Upload-Offset']),offset);offset+=options.body.size;return res(204,{'Upload-Offset':String(offset)});}
 throw Error('Unexpected method');};
 const client=create({config:{url:'https://test.supabase.co',publishableKey:'public-key'},token,userId:user,fetcher,wait});return {client,calls};
}
test('50MiB uploads use direct private Storage, exact 6MiB chunks, refreshed JWT and progress',async()=>{
 let version=0;const {client,calls}=setup({token:async()=>jwt(user,++version)}),f=file(maxFileSize),progress=[];
 assert.equal(await client.upload({file:f,path,mime:'application/pdf',onProgress:p=>progress.push(p)}),path);
 assert.equal(calls[0].target,endpoint);assert.equal(calls[0].headers['Upload-Length'],String(maxFileSize));
 assert.ok(calls.every(c=>c.headers['x-upsert']===undefined&&c.redirect==='error'));
 assert.ok(calls.every(c=>c.headers.apikey==='public-key'));assert.equal(new Set(calls.map(c=>c.headers.Authorization)).size,calls.length);
 assert.deepEqual(f.slices.map(([start,end])=>end-start),[chunkSize,chunkSize,chunkSize,chunkSize,chunkSize,chunkSize,chunkSize,chunkSize,2*1024*1024]);
 assert.deepEqual(progress.at(-1),{loaded:maxFileSize,total:maxFileSize,percent:100});
 const metadata=Object.fromEntries(calls[0].headers['Upload-Metadata'].split(',').map(v=>{const [k,b64]=v.split(' ');return[k,Buffer.from(b64,'base64').toString()]}));
 assert.deepEqual(metadata,{bucketName:'qc-campus-documents',objectName:path,contentType:'application/pdf',cacheControl:'3600'});
});
test('a committed but disconnected chunk is discovered with HEAD and is not uploaded twice',async()=>{
 let interrupted=false;const {client,calls}=setup({onRequest:async(_,opts,_n,state)=>{if(opts.method==='PATCH'&&!interrupted){interrupted=true;state.offset+=opts.body.size;throw Error('lost response');}}});
 await client.upload({file:file(chunkSize+5),path,mime:'application/pdf'});
 assert.equal(calls.filter(c=>c.method==='PATCH').length,2);assert.deepEqual(calls.map(c=>c.method),['POST','HEAD','PATCH','HEAD','PATCH']);
});
test('bounded network retries keep a same-selection resume URL in memory',async()=>{
 let offline=true;const {client,calls}=setup({onRequest:async(_,opts)=>{if(opts.method==='PATCH'&&offline)throw Error('offline');}});const f=file(chunkSize+12);
 await assert.rejects(client.upload({file:f,path,mime:'application/pdf'}),/interromput/);assert.equal(calls.filter(c=>c.method==='PATCH').length,3);
 offline=false;await client.upload({file:f,path,mime:'application/pdf'});assert.equal(calls.filter(c=>c.method==='POST').length,1);assert.equal(calls.filter(c=>c.method==='PATCH').at(-1).body.size,12);
});
test('50MiB plus one byte is rejected before any network or slice read',async()=>{
 const {client,calls}=setup(),f=file(maxFileSize+1);await assert.rejects(client.upload({file:f,path,mime:'application/pdf'}),/50 MB/);assert.equal(calls.length,0);assert.equal(f.slices.length,0);
});
test('no session and account changes stop before sending bytes under another identity',async()=>{
 for(const token of [async()=>null,async()=>jwt('44444444-4444-4444-8444-444444444444')]){const {client,calls}=setup({token});await assert.rejects(client.upload({file:file(),path,mime:'application/pdf'}),/sessió|compte/);assert.equal(calls.length,0);}
 let reads=0;const {client,calls}=setup({token:async()=>++reads<3?jwt(user):jwt('another-account')});await assert.rejects(client.upload({file:file(),path,mime:'application/pdf'}),/compte ha canviat/);assert.ok(!calls.some(c=>c.method==='PATCH'));
});
test('a denied session is not retried with stale credentials',async()=>{
 const {client,calls}=setup({onRequest:async(_,opts)=>opts.method==='PATCH'?res(401):null});await assert.rejects(client.upload({file:file(),path,mime:'application/pdf'}),/sessió/);assert.equal(calls.filter(c=>c.method==='PATCH').length,1);
});
test('untrusted upload locations cannot receive auth headers or chunks',async()=>{
 for(const location of ['https://evil.invalid/upload','https://test.storage.supabase.co/other','https://user:pass@test.storage.supabase.co/storage/v1/upload/resumable/a']){const {client,calls}=setup({onRequest:async()=>res(201,{Location:location})});await assert.rejects(client.upload({file:file(),path,mime:'application/pdf'}),/segura/);assert.equal(calls.length,1);}
});
test('offsets, file length and expired upload URLs are validated before resuming',async()=>{
 for(const headers of [{'Upload-Offset':'-1','Upload-Length':String(chunkSize+1)},{'Upload-Offset':String(chunkSize*3),'Upload-Length':String(chunkSize+1)},{'Upload-Offset':'0','Upload-Length':'1'}]){const {client,calls}=setup({onRequest:async(_,opts)=>opts.method==='HEAD'?res(200,headers):null});await assert.rejects(client.upload({file:file(chunkSize+1),path,mime:'application/pdf'}),/progrés|correspon/);assert.ok(!calls.some(c=>c.method==='PATCH'));}
 let expired=true;const {client,calls}=setup({onRequest:async(_,opts)=>opts.method==='HEAD'&&expired?res(410):null}),f=file(chunkSize+1);await assert.rejects(client.upload({file:f,path,mime:'application/pdf'}),/caducat/);expired=false;await client.upload({file:f,path,mime:'application/pdf'});assert.equal(calls.filter(c=>c.method==='POST').length,2);
});
test('same File object cannot move a partial upload to another project',async()=>{
 const {client,calls}=setup({onRequest:async(_,opts)=>opts.method==='PATCH'?res(503):null}),f=file(chunkSize+1);await assert.rejects(client.upload({file:f,path,mime:'application/pdf'}));const count=calls.length;
 await assert.rejects(client.upload({file:f,path:path.replace(project,'55555555-5555-4555-8555-555555555555'),mime:'application/pdf'}),/altre treball/);assert.equal(calls.length,count);
});
test('progress callback exceptions cannot corrupt a successful upload',async()=>{
 const {client}=setup();await client.upload({file:file(),path,mime:'application/pdf',onProgress(){throw Error('UI disconnected');}});
});

test('partially persisted PATCH resumes from the server offset without rejecting a valid non-aligned offset',async()=>{
 let interrupted=false;const partial=5*1024*1024;const {client,calls}=setup({onRequest:async(_,opts,_n,state)=>{if(opts.method==='PATCH'&&!interrupted){interrupted=true;state.offset=partial;throw Error('connection lost mid-PATCH');}}});
 await client.upload({file:file(chunkSize*3),path,mime:'application/pdf'});const patches=calls.filter(c=>c.method==='PATCH');assert.equal(patches[1].headers['Upload-Offset'],String(partial));assert.equal(patches[1].body.start,partial);assert.equal(patches[1].body.size,chunkSize);
});
