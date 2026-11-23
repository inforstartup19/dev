const test = require('node:test');
const assert = require('node:assert/strict');
const {create,render,createPayload} = require('../public/campus-dropbox.js');
const future = new Date(Date.now()+86400000).toISOString();
const past = new Date(Date.now()-86400000).toISOString();
const baseRecipient = () => ({id:'s',label:'Estudiant de mostra',project_id:'p',files:[],pending:[]});
const space = (patch={}) => ({id:'w', title:'Memòria final', kind:'TFG', subject:'Enginyeria',
  due_at:future, opens_at:null, instructions:'Presenta la memòria en PDF.', allow_revisions:false,recipients:[baseRecipient()],...patch});
const as = (role, spaces=[], extra={}) => ({role, data:{spaces,students:[{id:'s',label:'Estudiant'}]}, ...extra});
const flush = () => new Promise(resolve=>setImmediate(resolve));
function bind(view) {
  const element = {matches:()=>true};
  view.bind(element);
  return {
    click(cdAction, props={}) { element.onclick({target:{closest:()=>({dataset:{cdAction,...props}})}}); },
    choose(file) { element.onchange({type:'change',target:{name:'file',files:[file],hasAttribute:()=>true,dataset:{cdBox:'w'}}}); },
    input(name,value) { element.oninput({type:'input',target:{name,value,type:'text',form:{id:'cd-create'},hasAttribute:()=>false}}); },
    submit() { element.onsubmit({preventDefault(){},target:{id:'cd-create'}}); }
  };
}
test('student can submit a single file without typing, knows single-shot policy, sees no teacher editor', () => {
 const ui = render(as('student',[space()]));
 assert.match(ui,/type="file"/);assert.match(ui,/únic document/);assert.match(ui,/50 MB/);
 assert.doesNotMatch(ui,/type="text"|textarea|data-cd-action="new"|Publica el lliurament/);
 assert.doesNotMatch(render(as('manager',[space()])),/Memòria|document/);
});
test('confirmed single-file receipt closes upload; previously submitted versions remain for a multi-file space', () => {
 const r=baseRecipient();r.files.push({storage_name:'p/11111111-1111-1111-1111-111111111111--final.pdf',submitted_at:past});
 let ui=render(as('student',[space({recipients:[r]})]));
 assert.match(ui,/Justificant de lliurament/);assert.match(ui,/final.pdf/);assert.doesNotMatch(ui,/11111111|type="file"/);
 r.files.push({storage_name:'p/annex.pdf',submitted_at:future});
 ui=render(as('student',[space({allow_revisions:true,recipients:[r]})]));
 assert.match(ui,/Afegeix un annex o una versió/);assert.match(ui,/Versions anteriors \(1\)/);
});
test('recovery confirms a pending uploaded object after closing; cannot upload another file outside the period', () => {
 const r=baseRecipient();r.pending.push({storage_name:'p/example.pdf',uploaded_at:past});
 const ui=render(as('student',[space({due_at:past,recipients:[r]})]));
 assert.match(ui,/Confirma el lliurament/);assert.match(ui,/Tancat/);assert.doesNotMatch(ui,/type="file"|Justificant/);
 assert.doesNotMatch(render(as('student',[space({opens_at:future})])),/type="file"/);
});
test('teacher sees recipient receipt downloads only for confirmed objects; private instructions escaped', () => {
 const r=baseRecipient();r.files.push({storage_name:'p/final.pdf',submitted_at:past});r.pending.push({storage_name:'p/partial.pdf'});
 const ui=render(as('teacher',[space({instructions:'<tag>',recipients:[r]})]));
 assert.match(ui,/Descarrega/);assert.match(ui,/de 1/);assert.match(ui,/&lt;tag&gt;/);assert.doesNotMatch(ui,/partial.pdf|<tag>|type="file"/);
});
test('validates window and recipients; translates local teacher times into absolute instants', () => {
 const draft={title:' Final ',subject:'',kind:'TFM',instructions:'',opens_at:'',due_at:'2099-04-01T15:45',allow_revisions:true,student_ids:['s','s']};
 const payload=createPayload(draft);
 assert.deepEqual(payload.student_ids,['s']);assert.equal(payload.opens_at,null);assert.equal(payload.due_at,new Date(draft.due_at).toISOString());
 assert.throws(()=>createPayload({...draft,student_ids:[]}),/estudiant/);
 assert.throws(()=>createPayload({...draft,opens_at:'2099-04-01T16:45'}),/posterior/);
});
test('a failed upload retains the selection; retry reuses the request identifier and renders the confirmed receipt', async () => {
 const data={spaces:[space()],students:[]}, keys=[];
 const view=create({role:'student',api:{dropboxes:async()=>data,uploadDropbox:async(id,file,key,opts)=>{
   keys.push(key);assert.equal(opts.projectId,'p');if(keys.length===1)throw Error('Connexió interrompuda');
   return {storage_name:'p/test.pdf',submitted_at:past};
 }}});
 await view.start();const controls=bind(view);controls.choose({name:'test.pdf'});await flush();
 assert.match(view.html(),/Reintenta la pujada/);assert.doesNotMatch(view.html(),/Justificant de lliurament/);
 controls.click('retry',{cdBox:'w'});await flush();assert.equal(keys.length,2);assert.equal(keys[0],keys[1]);
 assert.match(view.html(),/Document lliurat/);assert.match(view.html(),/Justificant de lliurament/);
});
test('leaving the account while a read is pending drops the response, form state and file contents', async () => {
 let finish;
 const view=create({role:'teacher',api:{dropboxes:()=>new Promise(done=>{finish=done;})}});
 const reading=view.start();view.dispose();finish({students:[],spaces:[space()]});await reading;assert.equal(view.html(),'');
});
test('teacher form survives redraw and refresh; required markers and audience are accessible', async () => {
 const view=create({role:'teacher',api:{dropboxes:async()=>({students:[{id:'s',label:'Test'}],spaces:[]})}});
 await view.start();const controls=bind(view);controls.click('new');controls.input('title','Memòria <final>');
 await view.refresh();assert.match(view.html(),/Memòria &lt;final&gt;/);assert.match(view.html(),/required-mark/);
 assert.match(view.html(),/Admet annexos i noves versions/);
 controls.click('cancel');assert.doesNotMatch(view.html(),/<form/);
});
