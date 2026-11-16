const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('three campus views preserve existing routes and personal workspace',()=>{
 const existing=['campus','mostres','aportacions','laboratori','projectes','coneixement','metode'];
 const routes=Object.fromEntries(existing.map(id=>[id,[id,()=>id]]));
 const workspaceHome=()=>'<h1>Personal</h1>';
 const context={routes,workspaceHome,render(){},location:{hash:'#inici'},document:{body:{classList:{toggle(){}}},querySelector:s=>s==='aside nav'?{insertAdjacentHTML(){},querySelector(){return null}}:null,querySelectorAll:()=>[]}};
 vm.createContext(context);vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../quelcom-preview/quelcom-campus.js'),'utf8'),context);
 assert.equal(routes.espai[1],workspaceHome);
 for(const id of ['inici','explorar','investigar','formar']){
  const html=routes[id][1]();assert.match(html,/INCFORSTARTUP/);
  for(const [,target] of html.matchAll(/href="#([a-z]+)"/g)) assert.ok(routes[target]||target==='entrada',`missing route ${target}`);
 }
 for(const id of existing)assert.equal(routes[id][1](),id);
});
