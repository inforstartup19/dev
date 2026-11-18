const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {protectedRoute}=require('../public/campus-access.js');
test('Campus aliases, academic subpages and fallback require authentication',()=>{
 const known={entrada:1,univers:1,login:1,startup:1,'nova-idea':1,projectes:1};
 for(const route of ['inici','campus','campus-demo','espai-demo','demo-tfg','demo-tfm','befirst-tfm-tauler','befirst-tfg-recorregut','uni-revisio','recurs-roles','coworking','biblioteca','universitats','unknown'])assert.equal(protectedRoute(route,known),true,route);
 for(const route of Object.keys(known))assert.equal(protectedRoute(route,known),false,route);
});
function page(user){
 const data=new Map(),view={},redirects=[],listeners={};let renders=0;
 const auth={user:async()=>user};
 const context={supabase:{},QuelcomAuth:{create:()=>auth,destination:r=>r},QuelcomAuthConfig:{},sessionStorage:{setItem:(k,v)=>data.set(k,v)},fetch(){},location:{hash:'#befirst-tfm-tauler',origin:'https://example.test',replace:x=>redirects.push(x)},document:{hidden:false,addEventListener:(n,f)=>listeners[n]=f,querySelector:()=>view},render(){renders++}};
 vm.createContext(context);vm.runInContext(fs.readFileSync('public/campus-access.js','utf8'),context);
 return {context,data,view,redirects,get renders(){return renders}};
}
test('anonymous direct URL never renders Campus and preserves requested destination',async()=>{
 const p=page(null),routes={'befirst-tfm-tauler':true};
 assert.equal(p.context.CampusAccess.allow('befirst-tfm-tauler',routes),false);
 await new Promise(setImmediate);
 assert.equal(p.renders,0);assert.deepEqual(p.redirects,['#login']);assert.equal(p.data.get('quelcom.auth.return'),'befirst-tfm-tauler');
});
test('verified user can enter; logout invalidates the cached identity',async()=>{
 const p=page({email:'student@example.test'}),routes={'befirst-tfm-tauler':true};
 assert.equal(p.context.CampusAccess.allow('befirst-tfm-tauler',routes),false);await new Promise(setImmediate);
 assert.equal(p.context.CampusAccess.allow('befirst-tfm-tauler',routes),true);assert.equal(p.renders,1);
 p.context.QuelcomSession.clear();assert.equal(p.context.CampusAccess.allow('befirst-tfm-tauler',routes),false);
});
