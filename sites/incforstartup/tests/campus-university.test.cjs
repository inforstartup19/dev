const test = require('node:test');
const assert = require('node:assert/strict');
const university = require('../public/campus-university.js');

const institution = {id:'university-one',name:'Universitat Quelcom',can_manage:true};
const roster = {
  institution: {id:institution.id, name:institution.name},
  revision:4,
  teachers:[
    {id:'t1',label:'Docent A',status:'active'},
    {id:'t2',label:'Docent B',status:'invited'}
  ],
  students:[
    {id:'s1',label:'<Alumne A>',status:'active'},
    {id:'s2',label:'Estudiant B',status:'invited'},
    {id:'s3',label:'Estudiant C',status:'active'}
  ],
  assignments:[
    {teacher_id:'t1',student_id:'s2',mode:'evaluate'},
    {teacher_id:'t1',student_id:'s3',mode:'project_only'},
    {teacher_id:'t2',student_id:'s1',mode:'supervise'}
  ]
};
const manager = {institution,roster,role:'teacher'};
const personal = {institution:{...institution,can_manage:false},roster,role:'student'};

test('the selected teacher shows assigned and unassigned students and the exact permissions within this centre', () => {
  const html = university.render(manager);
  assert.match(html,/Universitat Quelcom/);
  assert.match(html,/2 estudiants assignats/);
  assert.match(html,/data-uni-student="s2" data-uni-original="evaluate"/);
  assert.match(html,/data-uni-student="s1" data-uni-original="none"/);
  assert.match(html,/value="project_only" selected disabled/);
  assert.match(html,/value="none">Sense assignació/);
  assert.match(html,/Invitació pendent/);
  assert.match(html,/&lt;Alumne A&gt;/);
  assert.doesNotMatch(html,/<Alumne A>/);
  assert.ok(html.indexOf('data-uni-student="s2"') < html.indexOf('data-uni-student="s1"'));
  assert.doesNotMatch(html,/data-uni-teacher="t2"/);
  const other = university.render({...manager,selectedTeacherId:'t2'});
  assert.match(other,/1 estudiant assignat/);
  assert.match(other,/data-uni-teacher="t2" data-uni-student="s1" data-uni-original="supervise"/);
  assert.equal(university.render({...manager,selectedTeacherId:'t-foreign'}),html);
});

test('a nonmanager sees only their own active opposite-role assignments and cannot submit a permission change', () => {
  const assignments=[
    {id:'t1',role:'teacher',label:'La meva tutora',mode:'supervise',status:'active'},
    {id:'t2',role:'teacher',label:'Docent pendent',mode:'evaluate',status:'invited'},
    {id:'s2',role:'student',label:'Una altra estudiant',mode:'evaluate',status:'active'}
  ];
  const student = university.render({...personal,assignments});
  assert.match(student,/Els teus docents/);
  assert.match(student,/La meva tutora/);
  assert.doesNotMatch(student,/Docent A|Docent pendent|Una altra estudiant|Assignacions docents|<form|name="mode"|Revoca/);
  const tutor = university.render({...personal,role:'teacher',assignments});
  assert.match(tutor,/Els teus estudiants/);
  assert.match(tutor,/Una altra estudiant/);
  assert.doesNotMatch(tutor,/La meva tutora|Docent pendent|<form/);
  assert.equal(university.render({...personal,role:'guest'}),'');
  assert.equal(university.render({roster}),'');
});

test('manager loading, stale data, missing context or the wrong centre blocks changes', () => {
  assert.doesNotMatch(university.render({...manager,loading:true}),/<form|Estudiant B/);
  const other = university.render({...manager,roster:{...roster,institution:{id:'another'}}});
  assert.doesNotMatch(other,/<form|Estudiant B/);
  const denied = university.render({...manager,error:'<Accés denegat>'});
  assert.match(denied,/&lt;Accés denegat&gt;/);
  assert.doesNotMatch(denied,/<form|Estudiant B/);
  const stale = university.render({...manager,stale:true});
  assert.match(stale,/data-uni-locked/);
  assert.match(stale,/data-uni-refresh>/);
  assert.match(stale,/name="university_teacher" required disabled/);
  assert.match(university.render({...manager,saving:true}),/data-uni-refresh disabled/);
});

test('the row previews the change and requires an explicit save; restoring, locking or invalid choices disables it', () => {
  const button={disabled:true}, hint={textContent:''};
  const form={
    dataset:{uniOriginal:'evaluate'}, locked:false,
    hasAttribute:()=>form.locked,
    querySelector:selector=>selector.startsWith('button') ? button : hint
  };
  const select={value:'none',closest:()=>form};
  university.updateMode(select);
  assert.equal(button.disabled,false);
  assert.match(hint.textContent,/perdrà l’accés/);
  select.value='evaluate';
  university.updateMode(select);
  assert.equal(button.disabled,true);
  assert.equal(hint.textContent,'');
  select.value='supervise';
  form.locked=true;
  university.updateMode(select);
  assert.equal(button.disabled,true);
  form.locked=false;
  select.value='project_only';
  university.updateMode(select);
  assert.equal(button.disabled,true);
  select.value='constructor';
  university.updateMode(select);
  assert.equal(button.disabled,true);
});

test('an empty or pending roster stays usable without exposing institutional provisioning', () => {
  const empty={...roster,teachers:[],students:[],assignments:[]};
  assert.match(university.render({...manager,roster:empty}),/Encara no hi ha docents al centre/);
  assert.match(university.render({...manager,roster:{...empty,teachers:roster.teachers}}),/Encara no hi ha estudiants al centre/);
  const student=university.render({...personal,assignments:[]});
  assert.match(student,/Encara no tens cap docent assignat/);
  assert.doesNotMatch(university.render(manager),/Nova universitat|Crea un centre|Alta de centre/);
});
