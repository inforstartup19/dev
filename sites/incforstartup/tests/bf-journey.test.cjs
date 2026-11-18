const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const J=require('../public/bf-journey-model.js'),A=require('../public/academic-workspace-model.js'),S=require('../public/startup-model.js'),C=require('../public/startup-catalog.js');
const at='2026-11-18T00:00:00.000Z';
function fixture(kind='TFM'){
 let board=A.create(kind);for(let i=1;i<=5;i++)board=A.apply(board,{type:'save',task:{id:'bf-'+i,title:'Fase '+i,deliverable:'Artefacte de prova',criteria:'Criteri explícit',requireEvidence:true,evidence:'Evidència sintètica '+i,dependencies:i>1?['bf-'+(i-1)]:[]}},'student',at);board.sequence=board.tasks.map(t=>t.id);
 for(const task of board.tasks){board=A.apply(board,{type:'move',id:task.id,status:'active'},'student',at);board=A.apply(board,{type:'move',id:task.id,status:'review'},'student',at);board=A.apply(board,{type:'move',id:task.id,status:'done',comment:'Revisió docent de prova'},'teacher',at);}
 const proposal={draft:null,feedback:'',versions:[{title:'BF de prova',objective:'Objectiu',method:'Mètode',milestone:'Fita',at}],reviews:[{version:1,decision:'accepted',comment:'Retorn docent',at}]};
 const rawProposal=JSON.stringify({[kind]:proposal}),rawBoard=JSON.stringify(board),src=J.source(rawProposal,rawBoard,kind);let prep=S.create(J.id(kind));
 for(const track of C.tracks)for(const step of track.steps)prep=S.apply(prep,{type:'note',key:track.id+'/'+step.id,fields:{goal:'Hipòtesi de prova',action:'Acció prevista',evidence:'Escenari sintètic',question:'Què falta contrastar?'}},at);
 return {kind,board,proposal,rawProposal,rawBoard,src,prep};
}
const closure={summary:'Memòria de prova',limitations:'Cap resultat comercial real',defense:'Assaig de defensa'};
const agreement={team:'Equip de prova',materials:'Textos sintètics seleccionats',authorship:'Autoria pendent de verificació real',audience:'Mentor de prova local'};
function agreed(f){let s=J.create(f.kind);s=J.apply(s,{type:'closure',fields:closure},'student',f.src,f.prep,at);s=J.apply(s,{type:'academic-review',decision:'accepted',comment:'Retorn docent de prova'},'teacher',f.src,f.prep,at);return J.apply(s,{type:'agree',confirmed:true,fields:agreement},'student',f.src,f.prep,at);}
function packet(s,f,options={}){return J.apply(s,{type:'packet',confirmed:true,request:'Revisar la propera prova',...options},'student',f.src,f.prep,at);}
function mentor(s,f,decision='continue'){return J.apply(s,{type:'mentor-review',decision,fields:{strengths:'Límits clars',changes:'Falten proves reals',nextStep:'Preparar una prova acotada'}},'mentor',f.src,f.prep,at);}
for(const kind of ['TFG','TFM'])test(kind+' completes the academic-to-mentor cycle with stable identity and optional investment',()=>{
 const f=fixture(kind),before=JSON.stringify(f);let s=agreed(f);s=packet(s,f,{includeAcademic:true,includeGrowth:true});s=mentor(s,f);s=J.apply(s,{type:'decision',decision:'continue',fields:{action:'Una prova petita',criterion:'Observacions amb font'}},'student',f.src,f.prep,at);
 assert.equal(s.projectId,J.id(kind));assert.equal(s.packets[0].snapshot.projectId,s.projectId);assert.equal(s.packets[0].snapshot.financing,'pendent');assert.equal(s.packets[0].snapshot.notes.length,10);assert.equal(s.packets[0].snapshot.academicTasks.length,5);assert.equal(s.decisions.length,1);assert.equal(JSON.stringify(f),before);assert.deepEqual(J.parse(JSON.stringify(s),kind),s);
});
test('academic requirements and explicit continuity cannot be bypassed',()=>{
 const f=fixture(),s=J.create('TFM');assert.equal(J.source(null,null,'TFM').ready,false);
 assert.throws(()=>J.apply(s,{type:'closure',fields:closure},'student',J.source(null,null,'TFM'),f.prep,at),/cinc tasques/);
 assert.throws(()=>J.apply(s,{type:'agree',confirmed:true,fields:agreement},'student',f.src,f.prep,at),/revisió docent/);
 const c=J.apply(s,{type:'closure',fields:closure},'student',f.src,f.prep,at);assert.equal(J.closureReady(c,f.src),false);
 const changes=J.apply(c,{type:'academic-review',decision:'changes',comment:'Falten límits'},'teacher',f.src,f.prep,at);assert.equal(J.closureReady(changes,f.src),false);
 assert.throws(()=>J.apply(agreed(f),{type:'agree',fields:agreement,confirmed:false},'student',f.src,f.prep,at),/Confirma/);
});
test('unpresented proposal changes, missing evidence and reopened tasks invalidate readiness',()=>{
 const f=fixture();f.proposal.draft={...f.proposal.versions[0],method:'Mètode pendent de presentar'};
 assert.equal(J.source(JSON.stringify({TFM:f.proposal}),f.rawBoard,'TFM').ready,false);
 const noEvidence=structuredClone(f.board);noEvidence.tasks[2].evidence='';assert.equal(J.source(f.rawProposal,JSON.stringify(noEvidence),'TFM').ready,false);
 const reopened=A.apply(f.board,{type:'move',id:'bf-3',status:'revise',comment:'Cal reprendre'},'teacher',at);const src=J.source(f.rawProposal,JSON.stringify(reopened),'TFM');const s=packet(agreed(f),f);
 assert.equal(J.agreementReady(s,src),false);assert.equal(J.packetCurrent(s,src,f.prep),false);assert.throws(()=>J.apply(s,{type:'mentor-review',decision:'continue',fields:{strengths:'a',changes:'b',nextStep:'c'}},'mentor',src,f.prep,at),/desactualitzat/);
});
test('student, teacher and mentor decisions cannot impersonate one another',()=>{
 const f=fixture(),s=packet(agreed(f),f);
 for(const actor of ['student','teacher'])assert.throws(()=>J.apply(s,{type:'mentor-review'},actor,f.src,f.prep,at),/perfil mentor/);
 for(const actor of ['student','mentor'])assert.throws(()=>J.apply(s,{type:'academic-review'},actor,f.src,f.prep,at),/perfil teacher/);
 for(const actor of ['teacher','mentor'])for(const type of ['closure','agree','packet','decision','withdraw'])assert.throws(()=>J.apply(s,{type},actor,f.src,f.prep,at),/perfil student/);
});
test('packet contains only the selected material and never the original academic store',()=>{
 const f=fixture();const s=packet(agreed(f),f);assert.equal(s.packets[0].snapshot.notes.length,5);assert.deepEqual(s.packets[0].snapshot.academicTasks,[]);assert.equal('history' in s.packets[0].snapshot,false);assert.equal('rawProposal' in s.packets[0].snapshot,false);
 const empty={...f,prep:S.create(J.id('TFM'))};assert.throws(()=>packet(agreed(f),empty),/cinc etapes/);
 const onlyCreate=structuredClone(f.prep);for(const key of Object.keys(onlyCreate.notes))if(key.startsWith('enlaira'))delete onlyCreate.notes[key];assert.throws(()=>packet(agreed(f),{...f,prep:onlyCreate},{includeGrowth:true}),/Enlaira/);
});
test('mentor revisions require new material, retain versions and block premature continuation',()=>{
 const f=fixture();let s=mentor(packet(agreed(f),f),f,'revise');assert.throws(()=>J.apply(s,{type:'decision',decision:'continue',fields:{action:'Avançar',criterion:'Criteri'}},'student',f.src,f.prep,at),/demanat canvis/);
 const first=structuredClone(s.packets[0]);f.prep=S.apply(f.prep,{type:'note',key:'crea-i-creix/mvp',fields:{goal:'Hipòtesi revisada',action:'Prova revisada',evidence:'Protocol sintètic revisat',question:'Criteri clar?'}},at);
 assert.equal(J.packetCurrent(s,f.src,f.prep),false);assert.throws(()=>mentor(s,f),/desactualitzat/);s=packet(s,f);s=mentor(s,f);assert.equal(s.packets.length,2);assert.deepEqual(s.packets[0],first);assert.equal(s.mentorReviews.length,2);
});
test('withdrawal preserves evidence and history but blocks review until a new agreement and packet',()=>{
 const f=fixture();let s=mentor(packet(agreed(f),f),f);const before=structuredClone(s);s=J.apply(s,{type:'withdraw'},'student',f.src,f.prep,at);assert.equal(J.agreementReady(s,f.src),false);assert.deepEqual(s.packets,before.packets);assert.throws(()=>mentor(s,f),/retirat/);
 s=J.apply(s,{type:'agree',confirmed:true,fields:agreement},'student',f.src,f.prep,at);assert.equal(J.agreementReady(s,f.src),true);assert.equal(J.packetCurrent(s,f.src,f.prep),false);s=packet(s,f);assert.equal(J.packetCurrent(s,f.src,f.prep),true);
});
test('malformed, foreign and conflicting data never overwrite preserved originals',()=>{
 const f=fixture(),s=agreed(f);assert.throws(()=>J.parse(JSON.stringify(s),'TFG'));assert.throws(()=>J.parse('{bad','TFM'));assert.throws(()=>J.source('{bad',f.rawBoard,'TFM'));
 const store=new Map([['workspace','untouched'],[J.key('TFM'),'external']]);const storage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};assert.throws(()=>J.save(storage,J.key('TFM'),s,null),/altra pestanya/);assert.equal(store.get(J.key('TFM')),'external');assert.equal(store.get('workspace'),'untouched');
 assert.throws(()=>J.apply(s,{type:'closure',fields:{...closure,summary:'x'.repeat(3001)}},'student',f.src,f.prep,at));assert.throws(()=>J.save({getItem:()=>null,setItem(){throw Error('storage denied')}},J.key('TFM'),s,null),/storage denied/);
});
function ui(f,s){const data=new Map([['quelcom.befirst-academic.v1',f.rawProposal],['quelcom.befirst-board.TFM.v1',f.rawBoard],[J.key('TFM'),JSON.stringify(s)],['quelcom.startup.demo-befirst-tfm.v1',JSON.stringify(f.prep)]]),events={},pendingForms={};const c={BFJourney:J,QuelcomStartup:S,QuelcomStartupCatalog:C,routes:{},state:{projects:[]},location:{hash:'#befirst-tfm-recorregut'},esc:x=>String(x).replaceAll('<','&lt;'),render(){},localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)},window:{addEventListener(){}},document:{addEventListener:(name,fn)=>(events[name]??=[]).push(fn),querySelector:()=>null,querySelectorAll:()=>[],body:{classList:{toggle(){}}}},FormData:class{constructor(form){return new Map(Object.entries(form.values))}}};vm.createContext(c);vm.runInContext(fs.readFileSync('sites/incforstartup/public/bf-journey.js','utf8'),c);return {c,data,events,html:()=>c.routes[c.location.hash.slice(1)][1](),role(value){for(const fn of events.change)fn({target:{id:'bj-role',value}});}};}
test('BF appears once as the same academic case, without inserting a duplicate Projecte Viu',()=>{
 const f=fixture(),u=ui(f,agreed(f));const before=JSON.stringify(u.c.state);const p=u.c.window.QuelcomBFJourney.projects();assert.equal(p.length,1);assert.equal(p[0].id,'demo-befirst-tfm');assert.equal(p[0].sourceRoute,'#befirst-tfm-recorregut');assert.equal(JSON.stringify(u.c.state),before);
 vm.runInContext(fs.readFileSync('sites/incforstartup/public/startup.js','utf8'),u.c);u.c.location.hash='#startup/crea-i-creix/demo-befirst-tfm/mvp';u.c.render();assert.match(u.html(),/Obre el recorregut acadèmic/);assert.match(u.html(),/Hipòtesi de prova/);
});
test('mentor sees selected packet and teacher cannot receive business material through that view',()=>{
 const f=fixture(),u=ui(f,packet(agreed(f),f));u.c.location.hash='#befirst-tfm-mentoria';u.role('mentor');assert.match(u.html(),/Hipòtesi de prova/);assert.doesNotMatch(u.html(),/Evidència sintètica 1/);assert.doesNotMatch(u.html(),/Autoria pendent de verificació real/);
 u.role('teacher');assert.match(u.html(),/no rep automàticament/);assert.doesNotMatch(u.html(),/Hipòtesi de prova/);
});
test('mentor packet excludes unrelated local mentoring drafts',()=>{
 const f=fixture();f.prep=S.apply(f.prep,{type:'note',key:'mentoria',fields:{goal:'Private draft',action:'Not selected',evidence:'Keep local',question:'Pending'}},at);
 const s=packet(agreed(f),f);assert.equal(s.packets[0].snapshot.notes.length,5);assert.doesNotMatch(JSON.stringify(s.packets[0].snapshot),/Private draft/);
});
test('failed submissions retain material selections and the chosen decision for correction',()=>{
 const f=fixture(),u=ui(f,agreed(f));u.c.location.hash='#befirst-tfm-mentoria';u.html();u.data.set(J.key('TFM'),'concurrent change');
 for(const fn of u.events.submit)fn({preventDefault(){},target:{id:'bj-packet',values:{request:'Keep this request',includeAcademic:'on',includeGrowth:'on',confirmed:'on'}}});
 const html=u.html();assert.match(html,/Keep this request/);assert.match(html,/name="includeAcademic" checked/);assert.match(html,/name="includeGrowth" checked/);assert.equal(u.data.get(J.key('TFM')),'concurrent change');
 const v=ui(f,mentor(packet(agreed(f),f),f,'revise'));v.c.location.hash='#befirst-tfm-mentoria';
 for(const fn of v.events.submit)fn({preventDefault(){},target:{id:'bj-decision',values:{decision:'continue',action:'Retain action',criterion:'Retain criterion'}}});
 assert.match(v.html(),/option value="continue" selected/);assert.match(v.html(),/Retain action/);assert.match(v.html(),/El mentor ha demanat canvis/);
});
