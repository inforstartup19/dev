const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('login preview never authenticates, all providers pending; local demo stays explicit',()=>{
 const handlers={};const routes={};const workspaceHome=()=>'<h1>Local</h1>';
 const feedback={innerHTML:''};
 const c={routes,workspaceHome,render(){},location:{hash:'#espai'},document:{body:{classList:{toggle(){}}},querySelectorAll:()=>[],querySelector:()=>feedback,addEventListener:(name,fn)=>handlers[name]=fn}};
 vm.createContext(c);vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../public/quelcom-login.js'),'utf8'),c);
 const html=routes.espai[1]();assert.equal((html.match(/type="button" disabled/g)||[]).length,5);
 for(const name of ['Microsoft','Apple','Google','universitat','Correu']) assert.ok(html.includes(name));
 assert.ok(!html.includes('type="password"'));assert.equal(routes['espai-demo'][1],workspaceHome);
 for(const value of ['expired','cancelled','unavailable','denied','invitation','code','linked','apple']){handlers.change({target:{id:'ql-scenario',value}});assert.ok(feedback.innerHTML.length>20);}
 const before=feedback.innerHTML;handlers.change({target:{id:'ql-scenario',value:'<script>'}});assert.equal(feedback.innerHTML,before);
});
