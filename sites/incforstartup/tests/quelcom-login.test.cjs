const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {create,destination}=require('../public/quelcom-auth.js');
const known={campus:true,'befirst-tfm-recorregut':true,login:true};
function setup(options={}){
 const records=new Map([['demo-draft','keep']]),calls=[];
 const storage={getItem:k=>records.get(k),setItem:(k,v)=>records.set(k,v),removeItem:k=>records.delete(k)};
 const auth={signInWithOAuth:async input=>{calls.push(input);return{}},signInWithOtp:async input=>{calls.push(input);return{}},getUser:async()=>({data:{user:{email:'student@example.test'}}}),exchangeCodeForSession:async()=>({}),signOut:async()=>({}),...options.auth};
 const sdk={createClient:(url,key,opts)=>{calls.push(opts);return {auth}}};
 const adapter=create({config:{url:'https://test.supabase.co',publishableKey:'public',redirectReady:true,emailReady:true,...options.config},sdk,storage,fetcher:async()=>({ok:true,json:async()=>({external:{google:true,github:true,azure:true,apple:true,email:true,...options.external}})}),origin:'https://portal.test',known});
 return {adapter,calls,records};
}
test('return targets reject external, malformed and inherited destinations',()=>{
 for(const route of ['https://evil.test','//evil.test','constructor','__proto__','login','espai','campus?next=evil','<script>'])assert.equal(destination(route,known),'campus');
 assert.equal(destination('befirst-tfm-recorregut',known),'befirst-tfm-recorregut');
});
test('readiness and live provider flags fail closed even for direct calls',async()=>{
 for(const options of [{config:{redirectReady:false}},{external:{google:false}}]){
  const {adapter,calls}=setup(options);assert.equal((await adapter.settings()).google,false);await assert.rejects(adapter.oauth('google'));assert.equal(calls.length,0);
 }
 await assert.rejects(setup().adapter.oauth('__proto__'));
 const {adapter}=setup({config:{emailReady:false}});await assert.rejects(adapter.email('test@example.test'));
});
test('OAuth uses SDK PKCE and fixed callback; Microsoft requests email',async()=>{
 const {adapter,calls}=setup();await adapter.oauth('azure');
 assert.equal(calls[0].auth.flowType,'pkce');assert.equal(calls[0].auth.detectSessionInUrl,false);
 assert.deepEqual(calls[1],{provider:'azure',options:{redirectTo:'https://portal.test/auth-callback.html',scopes:'email'}});
});
test('callback validates identity and returns to the draft; logout preserves local work',async()=>{
 const {adapter,records}=setup();adapter.remember('befirst-tfm-recorregut');assert.equal(await adapter.finish('code'),'befirst-tfm-recorregut');await adapter.logout();assert.equal(records.get('demo-draft'),'keep');
 for(const auth of [{exchangeCodeForSession:async()=>({error:{message:'secret'}})},{getUser:async()=>({error:{}})}])await assert.rejects(setup({auth}).adapter.finish('code'),/^Error: callback$/);
 await assert.rejects(adapter.finish(''));
});
test('email is invite-only and does not expose provider failures',async()=>{
 const {adapter,calls}=setup();await adapter.email('student@example.test');assert.equal(calls[1].options.shouldCreateUser,false);
 const failing=setup({auth:{signInWithOAuth:async()=>({error:{message:'private detail'}})}});await assert.rejects(failing.adapter.oauth('google'),/^Error: unavailable$/);
});
test('login includes four providers and no unauthenticated demo bypass',()=>{
 const routes={campus:['Campus',()=>{}]},handlers={};
 const c={routes,QuelcomAuth:require('../public/quelcom-auth.js'),workspaceHome:()=>'',render(){},location:{hash:'#campus'},document:{body:{classList:{toggle(){}}},addEventListener:(n,f)=>handlers[n]=f}};
 vm.createContext(c);vm.runInContext(fs.readFileSync('public/quelcom-login.js','utf8'),c);
 const html=routes.login[1]();for(const name of ['Google','GitHub','Microsoft','Apple'])assert.ok(html.includes(name));
 assert.equal((html.match(/data-ql-provider="[a-z]+" disabled/g)||[]).length,4);assert.ok(!html.includes('type="password"'));assert.ok(html.includes('no els sincronitza'));assert.ok(!html.includes('ql-demo-path'));assert.ok(!html.includes('sense iniciar sessió'));
});
