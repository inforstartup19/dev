const test = require('node:test');
const assert = require('node:assert/strict');
const defense = require('../public/campus-defense.js');

const base = {
  work: {id:'f17bfd49-a1a8-48f4-809a-6b9df820034d', kind:'TR'},
  role:'student', isOwner:true, documents:[]
};
const tutor = {...base,role:'teacher',isOwner:false};
const doc = 'f17bfd49-a1a8-48f4-809a-6b9df820034d--assaig.pptx';
const rec = {status:'submitted',outline:'La pregunta inicial',questions:'Quina dada falta?',attachment:doc,talk_minutes:20,question_minutes:12};

test('the student can save a private draft or explicitly submit a required script', () => {
  const html = defense.render(base);
  assert.match(html, /id="cp-defense-student"/);
  assert.match(html, /name="outline"[^>]+required/);
  assert.match(html, /value="save" formnovalidate/);
  assert.match(html, /value="submit"/);
  assert.match(html, /privat fins que l’enviïs/);
  assert.match(html, /TR de batxillerat/);
  assert.doesNotMatch(html, /id="cp-defense-teacher"/);
  assert.equal(defense.render({...base,isOwner:false}), '');
});

test('submission freezes the student copy and scopes review actions to the teacher', () => {
  const student = defense.render({...base,record:rec});
  assert.match(student, /La pregunta inicial/);
  assert.doesNotMatch(student, /id="cp-defense-student"|value="validate"/);
  const submitted = defense.render({...tutor,record:rec});
  assert.match(submitted, /id="cp-defense-teacher"/);
  assert.match(submitted, /name="feedback"[^>]+required/);
  assert.match(submitted, /value="return"/);
  assert.match(submitted, /value="validate"/);
  assert.doesNotMatch(submitted, /id="cp-defense-student"/);
  assert.match(defense.render(tutor), /Encara no has rebut cap assaig/);
});

test('requested changes preserve the prior feedback, and a validated rehearsal can only reopen via a new draft', () => {
  const record = {...rec, status:'changes_requested', feedback:'<em>Delimita el mètode</em>'};
  const html = defense.render({...base,record});
  assert.match(html, /&lt;em&gt;Delimita el mètode/);
  assert.match(html, /data-defense-project=/);
  assert.match(html, /value="submit"/);
  const done = defense.render({...base,record:{...record,status:'rehearsed'}});
  assert.match(done, /Prepara una nova versió/);
  assert.match(done, /value="save"/);
  assert.doesNotMatch(done, /value="submit"/);
});

test('materials use existing project file actions and reject arbitrary paths and file types', () => {
  const docs = [{name:doc},{name:'https://outside.invalid/file.pdf'},{name:'sensitive.xlsx'}];
  const edit = defense.render({...base,record:{...rec,status:'draft'},documents:docs});
  assert.match(edit, /data-defense-documents/);
  assert.match(edit, new RegExp('data-cp-download="'+doc+'"'));
  assert.doesNotMatch(edit, /outside.invalid|sensitive.xlsx/);
  const review = defense.render({...tutor,record:rec,documents:[{name:doc}]});
  assert.match(review, new RegExp('data-cp-download="'+doc+'"'));
  assert.doesNotMatch(defense.render({...tutor,record:rec,documents:[]}), /data-cp-download/);
});

test('unavailable and stale states cannot submit or reveal technical errors as markup', () => {
  const missing = defense.render({...base,unavailable:true,error:'<script>alert(0)</script>'});
  assert.match(missing, /&lt;script&gt;/);
  assert.doesNotMatch(missing, /<form/);
  const stale = defense.render({...base,stale:true});
  assert.match(stale,/data-defense-refresh/);
  assert.match(stale,/value="submit" class="cp-primary" disabled/);
  assert.equal((defense.render(base).match(/<dd>(\d+)%<\/dd>/g) || []).reduce((s,n)=>s+Number(n.match(/\d+/)[0]),0),100);
});

test('the clock preserves elapsed time per phase on pause, handles delayed browser ticks and stops at zero', () => {
  let now = 0;
  const clock = defense.createClock(() => now), limits = {talk:2,questions:1};
  clock.start(limits); now=10001; assert.equal(clock.read(limits).remaining,110);
  clock.choose('questions'); now=20000; assert.equal(clock.read(limits).remaining,60);
  clock.start(limits); now+=12000; clock.pause(); now+=6000; assert.equal(clock.read(limits).remaining,48);
  clock.choose('talk'); assert.equal(clock.read(limits).remaining,110);
  clock.start(limits); now+=500000;
  assert.deepEqual(clock.read(limits),{phase:'talk',remaining:0,used:120000,running:false,enabled:true});
  clock.reset(); assert.equal(clock.read(limits).remaining,120);
  clock.choose('questions'); const noQuestions = {talk:15,questions:0}; clock.start(noQuestions);
  assert.equal(clock.read(noQuestions).running,false);
});
