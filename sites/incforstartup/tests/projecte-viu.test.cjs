const test=require('node:test'),assert=require('node:assert/strict');
const {create,evolve}=require('../public/projecte-viu-model.js');
test('question-only creation and full proof/result/decision lifecycle preserve identity and evidence',()=>{
 let p=create({question:'Com reduïm residus?'},'stable-id','t1');assert.equal(p.live.active,null);assert.equal(p.live.intention,'');
 p=evolve(p,'proof',{task:'Mesurar dues mostres',criterion:'Comparar pes'},'t2');
 p=evolve(p,'result',{result:'La mostra A pesa menys',evidence:'Quadern 1'},'t3');assert.equal(p.live.active,null);assert.equal(p.live.experiments.length,1);
 p=evolve(p,'decision',{decision:'Reformular',reason:'Cal repetir la mesura'},'t4');
 p=evolve(p,'proof',{task:'Repetir amb tres mostres'},'t5');assert.equal(p.id,'stable-id');assert.equal(p.live.experiments[0].evidence,'Quadern 1');assert.equal(p.history.length,4);
 const restored=JSON.parse(JSON.stringify(p));assert.equal(restored.live.active.task,'Repetir amb tres mostres');
});
test('pause/close are reversible and do not remove active proof or history',()=>{
 let p=create({question:'Pregunta'},'id','t');p=evolve(p,'proof',{task:'Prova'},'t');
 for(const decision of ['Pausar','Tancar']){p=evolve(p,'decision',{decision,reason:'Decisió humana'},'t');assert.throws(()=>evolve(p,'result',{result:'x'},'t'));assert.equal(p.live.active.task,'Prova');p=evolve(p,'decision',{decision:'Continuar',reason:'Reprenem'},'t');assert.equal(p.live.status,'En curs')}
});
test('invalid input never mutates original, legacy projects and fields survive',()=>{
 const original={id:'legacy',title:'Anterior',description:'Idea antiga',domain:'Art',team:'Equip anterior',history:[{at:'old'}],custom:'retain'};
 assert.throws(()=>evolve(original,'result',{result:'x'},'t'));assert.equal(original.live,undefined);
 const next=evolve(original,'needs',{needs:'Aprendre a mesurar'},'t');assert.equal(next.custom,'retain');assert.equal(next.team,'Equip anterior');assert.equal(next.history[0].at,'old');
 assert.throws(()=>create({question:'   '},'id','t'));assert.throws(()=>evolve(next,'decision',{decision:'Publicar',reason:'x'},'t'));assert.throws(()=>evolve(next,'proof',{task:''},'t'));
});
