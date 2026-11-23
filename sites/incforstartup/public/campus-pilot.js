/* Authenticated Campus pilot: all durable records go through Supabase RLS. */
(()=>{
 'use strict';
 const e=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const labels={prepare:'Per preparar',active:'En curs',review:'En revisió',revise:'Cal ajustar',done:'Revisada'};
 let api,member,account,booting=false,booted=false,projects=[],feed=[],work=null,tasks=[],historyRows=[],projectRows=[],proposals=[],loaded='',loadingWork='',error='',notice='',busy=false,editor=null,draft=null,newProject=false,newTask=false,newExcerpt=false,loadGeneration=0;
 let documents=[],pendingFile=null,fileId=null,documentReviews=[],reviewError='',aiAvailability=null,aiStatusError='',aiDraft=null,uploadProgress=null;
 const analysisDrafts=new Map();
 let feedback=null;
 // A rehearsal is scoped to the authorized project and to this account's in-memory session.
 let defense=null;
 let homeNeedsRefresh=false,homeRequest=null,workspaceDeferred=false;
 // The directory is scoped to the current visit and never cached across accounts.
 let universityView=null,canEvaluate=false;
 let dropView = null;
 const dropRoute = () => location.hash === '#campus-lliuraments';
 function leaveDropbox(){
  if (!dropView) return;
  const view = dropView;
  dropView = null;
  view.dispose();
  homeNeedsRefresh = true;
 }
 function mountDropbox(){
  const container = document.getElementById('cp-deliveries');
  if (!container || !globalThis.CampusDropbox || !academicMember()) return;
  if (!dropView) {
   const view = CampusDropbox.create({role:member.role,identity:account.id,api,
    onChange:()=>{if(dropView===view && dropRoute())redraw();}});
   dropView = view;
   view.start();
  }
  dropView?.bind(document.getElementById('cp-deliveries'));
 }
 function dropPanel(){
  if (!globalThis.CampusDropbox) return '<p role="alert">No hem pogut obrir els lliuraments. Recarrega el Campus.</p>';
  return '<div id="cp-deliveries">'+(dropView?.html() || '<p role="status">Carregant els lliuraments…</p>')+'</div>';
 }
 const academicMember=()=>['student','teacher'].includes(member?.role);
 const universityPage=()=>isPilot()&&Boolean(member?.institution?.id)&&(location.hash==='#campus-universitat'||member.role==='manager');
 const inUniversity=view=>view===universityView&&view.generation===loadGeneration&&universityPage();
 function universityPanel(){
  if(!globalThis.CampusUniversity)return '<p role="alert">No hem pogut carregar la vista del centre. Recarrega la pàgina.</p>';
  return CampusUniversity.render({institution:member.institution,role:member.role,loading:!universityView,...universityView});
 }
 function checkRoster(value){
  if(!value||value.institution?.id!==member.institution.id||!Number.isSafeInteger(value.revision)||value.revision<0||
   ![value.teachers,value.students,value.assignments].every(Array.isArray))throw Error('No hem pogut confirmar la llista actual del centre. Torna-la a carregar.');
  return value;
 }
 async function readUniversity(){
  if(!universityPage()||universityView?.loading||universityView?.saving)return;
  const view={generation:loadGeneration,loading:true,saving:false,stale:false,error:'',notice:'',
   roster:null,assignments:[],selectedTeacherId:universityView?.selectedTeacherId||''};
  universityView=view;redraw();
  try{
   if(member.institution.can_manage===true){
    const roster=await api.universityRoster();
    if(inUniversity(view))view.roster=checkRoster(roster);
   }else{
    const rows=await api.myAssignments();
    if(inUniversity(view)){
     if(!Array.isArray(rows))throw Error('No hem pogut confirmar les teves assignacions.');
     view.assignments=rows;
    }
   }
  }catch(err){if(inUniversity(view))view.error=err.message;}
  finally{if(inUniversity(view)){view.loading=false;redraw();}}
 }
 async function writeUniversity(form){
  const view=universityView;
  if(!view||!inUniversity(view)||member.institution.can_manage!==true||!view.roster||view.loading||view.saving||view.stale)return;
  const {uniTeacher:teacher,uniStudent:student}=form.dataset;
  const roster=view.roster;
  if(!roster.teachers.some(row=>row.id===teacher)||!roster.students.some(row=>row.id===student))return;
  const mode=new FormData(form).get('mode');
  const current=roster.assignments.find(row=>row.teacher_id===teacher&&row.student_id===student)?.mode||'none';
  if(!['none','supervise','evaluate'].includes(mode)||mode===current)return;
  view.error='';view.notice='';view.saving=true;redraw();
  try{
   const result=await api.assignUniversity(teacher,student,mode,roster.revision);
   if(!inUniversity(view))return;
   const confirmed=checkRoster(result);
   const stored=confirmed.assignments.find(row=>row.teacher_id===teacher&&row.student_id===student)?.mode||'none';
   if(stored!==mode)throw Error('L’assignació ha canviat. Actualitza les dades del centre.');
   view.roster=confirmed;view.notice=mode==='none'?'S’ha retirat l’assignació.':'Assignació desada a Quelcom.';
   if(academicMember()){projects=[];homeNeedsRefresh=true;}
  }catch(err){
   if(!inUniversity(view))return;
   view.error=err.message;
   if(err.code==='denied'){view.roster=null;view.assignments=[];}
   view.stale=err.code!=='invalid';
  }finally{if(inUniversity(view)){view.saving=false;redraw();}}
 }
 document.addEventListener('change',ev=>{
  if(!universityView||!inUniversity(universityView)||universityView.loading||universityView.saving)return;
  if(ev.target.name==='university_teacher'&&universityView.roster?.teachers.some(row=>row.id===ev.target.value)){
   universityView.selectedTeacherId=ev.target.value;universityView.notice='';redraw();
   document.querySelector?.('[name="university_teacher"]')?.focus();
  }else if(ev.target.name==='mode'&&ev.target.closest?.('.cu-assignment'))CampusUniversity.updateMode(ev.target);
 });
 document.addEventListener('submit',ev=>{
  if(!ev.target.matches?.('.cu-assignment'))return;
  ev.preventDefault();writeUniversity(ev.target);
 });
 document.addEventListener('click',ev=>{
  if(ev.target.closest?.('[data-uni-refresh]')&&universityPage())readUniversity();
 });

 const pendingDefenses=new Map();
 function hasProjectAccess(){
  return !!api&&!!account&&!!member&&!!work&&work.id===selected()&&loaded===work.id&&
   (member.role==='teacher'||(member.role==='student'&&work.owner_id===account.id));
 }
 function leaveDefense(keepDraft=false){
  if(defense){
   if(keepDraft&&defense.draft)pendingDefenses.set(defense.project,{draft:defense.draft,revision:defense.baseRevision});
   else pendingDefenses.delete(defense.project);
  }
  defense=null;
  globalThis.CampusDefense?.resetTimer();
 }
 function ownsDefense(room){return room===defense&&hasProjectAccess()&&room.project===work.id;}
 function defensePanel(){
  if(!defense)return '';
  const room=defense,record=room.record;
  const comparison=room.compare&&room.draft&&record&&member.role==='student'?
   `<details class="cp-card"><summary>Compara amb la versió desada (v${e(record.revision)})</summary>
   <p><b>Guió desat</b></p><p>${e(record.outline||'Sense guió')}</p><p><b>Preguntes desades</b></p><p>${e(record.questions||'Sense preguntes')}</p>
   <p>Fitxer: ${e(record.attachment?documentTitle(record.attachment):'Cap')} · Exposició: ${e(record.talk_minutes)} min · Preguntes: ${e(record.question_minutes)} min</p>
   ${record.status==='submitted'?`<p><b>Guió pendent en aquesta pestanya</b></p><p>${e(room.draft.outline)}</p><p>${e(room.draft.questions)}</p>`:''}</details>`:
   room.compare&&room.draft?.feedback&&record?.status!=='submitted'?
    `<details class="cp-card"><summary>El teu comentari pendent en aquesta pestanya</summary><p>${e(room.draft.feedback)}</p></details>`:'';
  const notice=room.notice?`<p class="cp-success" role="status">${e(room.notice)}</p>`:'';
  return `<button type="button" class="cp-back" data-defense-close>Torna a la fitxa del treball</button>`+
   notice+comparison+globalThis.CampusDefense.render({work,role:member.role,isOwner:work.owner_id===account.id,record,
    draft:room.draft,documents,canEvaluate,busy:room.saving,loading:room.loading,error:room.error,
    unavailable:!room.ready&&!room.loading,stale:room.stale});
 }
 async function readDefense(room){
  if(!ownsDefense(room)||room.loading||room.saving)return;
  room.loading=true;room.error='';room.notice='';redraw();
  try{
   const record=await api.defense(room.project);
   if(!ownsDefense(room))return;
   const prev=room.baseRevision;
   room.record=record;room.ready=true;room.stale=false;room.baseRevision=record?.revision||0;
   room.compare=!!room.draft&&prev!==room.baseRevision;
   if(room.compare)room.notice='S’ha recuperat una versió més recent. Revisa-la abans de tornar a confirmar el text pendent.';
  }catch(err){
   if(!ownsDefense(room))return;
   room.record=null;room.ready=false;room.error=err.code==='denied'?err.message:'No hem pogut recuperar l’assaig. Torna-ho a provar.';
   if(err.code==='denied'){room.draft=null;pendingDefenses.delete(room.project);}
  }finally{if(ownsDefense(room)){room.loading=false;redraw();}}
 }
 function openDefense(){
  if(defense||!hasProjectAccess()||!globalThis.CampusDefense)return;
  const pending=pendingDefenses.get(work.id);
  defense={project:work.id,record:null,draft:pending?.draft||null,baseRevision:pending?.revision||0,
   ready:false,stale:false,loading:false,saving:false,compare:false,error:'',notice:''};
  const room=defense;
  readDefense(room).then(()=>{if(ownsDefense(room))document.querySelector?.('#cdf-title')?.focus();});
 }
 function defenseDraft(form){
  const values=Object.fromEntries(new FormData(form));
  if(form.id==='cp-defense-teacher')return {feedback:String(values.feedback||'')};
  return {outline:String(values.outline||''),questions:String(values.questions||''),attachment:String(values.attachment||''),
   talk_minutes:values.talk_minutes??'',question_minutes:values.question_minutes??''};
 }
 async function writeDefense(form,action){
  const room=defense;
  if(!room||!ownsDefense(room)||!room.ready||room.loading||room.saving||room.stale)return;
  const status=room.record?.status||'draft',teacher=member.role==='teacher',fields=defenseDraft(form);
  if(teacher){
   if(!canEvaluate||form.id!=='cp-defense-teacher'||status!=='submitted'||!['return','validate'].includes(action))return;
  }else if(form.id!=='cp-defense-student'||status==='submitted'||!['save','submit'].includes(action)||(status==='rehearsed'&&action!=='save'))return;
  room.draft=fields;room.notice='';room.error='';
  if(teacher&&(!fields.feedback.trim()||fields.feedback.length>3000)){
   room.error='Escriu un retorn de fins a 3.000 caràcters.';redraw();return;
  }
  if(!teacher){
   if(action==='submit'&&!fields.outline.trim()){room.error='Escriu un guió abans d’enviar l’assaig a tutoria.';redraw();return;}
   if(fields.outline.length>6000||fields.questions.length>3000){room.error='Revisa la longitud del guió i de les preguntes.';redraw();return;}
   const talk=Number(fields.talk_minutes),questions=Number(fields.question_minutes);
   if(fields.talk_minutes===''||fields.question_minutes===''||!Number.isInteger(talk)||talk<1||talk>120||
    !Number.isInteger(questions)||questions<0||questions>120){
    room.error='Indica entre 1 i 120 minuts d’exposició i entre 0 i 120 minuts de preguntes.';redraw();return;
   }
  }
  room.saving=true;redraw();
  try{
   const data=teacher?fields:{...fields,talk_minutes:Number(fields.talk_minutes),question_minutes:Number(fields.question_minutes)};
   const stored=await api.saveDefense(room.project,room.baseRevision,action,data);
   if(!ownsDefense(room))return;
   room.record=stored;room.baseRevision=stored.revision;room.draft=null;room.compare=false;
   pendingDefenses.delete(room.project);
   room.notice={save:'Esborrany desat a Quelcom.',submit:'Assaig enviat al tutor per revisar.',return:'Ajustos enviats a l’estudiant.',validate:'Retorn desat. L’assaig ha quedat revisat.'}[action];
  }catch(err){
   if(!ownsDefense(room))return;
   if(err.code==='denied'){room.ready=false;room.record=null;room.draft=null;pendingDefenses.delete(room.project);}
   else if(err.code!=='invalid')room.stale=true;
   room.error=err.message;
  }finally{if(ownsDefense(room)){room.saving=false;redraw();}}
 }
 function captureDefenseInput(ev){
  const form=ev.target.closest?.('#cp-defense-student,#cp-defense-teacher');
  if(form&&defense&&ownsDefense(defense)&&defense.ready&&!defense.saving)defense.draft=defenseDraft(form);
 }
 document.addEventListener('input',captureDefenseInput);
 document.addEventListener('change',captureDefenseInput);
 document.addEventListener('submit',ev=>{
  if(!['cp-defense-student','cp-defense-teacher'].includes(ev.target.id))return;
  ev.preventDefault();writeDefense(ev.target,ev.submitter?.value);
 });
 document.addEventListener('click',ev=>{
  const b=ev.target.closest?.('[data-defense-open],[data-defense-close],[data-defense-refresh],[data-defense-documents]');
  if(!b||busy)return;
  if('defenseOpen' in b.dataset){openDefense();return;}
  if(!defense||defense.saving||!ownsDefense(defense))return;
  if('defenseRefresh' in b.dataset){readDefense(defense);return;}
  leaveDefense(true);redraw();
  if('defenseDocuments' in b.dataset){
   const heading=document.querySelector?.('.cp-documents h2');
   heading?.focus();heading?.scrollIntoView({block:'start',behavior:'auto'});
  }else document.querySelector?.('[data-defense-open]')?.focus();
 });
 function academicGuide(kind,onboarding=false){
  return globalThis.CampusAcademicPath?.render({kind,role:onboarding?'student':member.role,onboarding})||'';
 }

 const guidance=window.QuelcomOrientation;
 const orientations=new Map();
 const maxAIBytes=10*1024*1024;
 let editorScope='campus';const editorCache=new Map();
 const selected=()=>location.hash.startsWith('#campus-treball/')?location.hash.split('/')[1]:null;
 const isPilot=()=>['#campus','#inici','#campus-biblioteca','#campus-universitat','#campus-lliuraments'].includes(location.hash)||location.hash.startsWith('#campus-treball/');
 function reset(){leaveDropbox();workspaceDeferred=false;universityView=null;canEvaluate=false;homeNeedsRefresh=false;homeRequest=null;clearProjectRoutes();leaveDefense();pendingDefenses.clear();feedback=null;orientations.clear();loadGeneration++;api=null;member=null;account=null;booted=false;booting=false;busy=false;projects=[];feed=[];work=null;tasks=[];historyRows=[];projectRows=[];proposals=[];loaded='';loadingWork='';editor=null;draft=null;newProject=false;newTask=false;newExcerpt=false;notice='';error='';documents=[];pendingFile=null;fileId=null;editorCache.clear();editorScope='campus';documentReviews=[];reviewError='';aiAvailability=null;aiStatusError='';aiDraft=null;uploadProgress=null;analysisDrafts.clear();}
 document.addEventListener('quelcom-account-change',reset);
 function redraw(){if(isPilot())render();}
 async function boot(){if(booting||booted)return;booting=true;const generation=loadGeneration;try{
  const auth=await QuelcomSession.ready(routes),user=await auth.user();if(!user){location.replace('#login');return;}
  const service=CampusPilotAPI.create({config:QuelcomAuthConfig,token:()=>auth.accessToken(),storage:auth.storageClient(),userId:user.id});
  const membership=await service.enroll();if(generation!==loadGeneration)return;
  api=service;account=user;member=membership;
  workspaceDeferred=academicMember()&&dropRoute();
  if(academicMember()&&!workspaceDeferred){const [p,f]=await Promise.all([api.projects(),api.library()]);if(generation!==loadGeneration)return;projects=p;feed=f;registerProjects();}
  booted=true;if(academicMember()&&!workspaceDeferred)refreshAI();
 }catch(err){if(generation===loadGeneration){error=err.message;booted=true;}}finally{if(generation===loadGeneration){booting=false;redraw();}}}
 function clearProjectRoutes(){for(const key of Object.keys(routes))if(key.startsWith('campus-treball/'))delete routes[key];}
 function registerProjects(){clearProjectRoutes();for(const p of projects)routes['campus-treball/'+p.id]=[p.title,page];}
 async function refreshHome(){
  if(!homeNeedsRefresh||homeRequest||!academicMember()||selected()||universityPage()||dropRoute())return;
  const request={service:api,generation:loadGeneration};homeRequest=request;homeNeedsRefresh=false;
  try{
   const rows=await request.service.projects();
   if(homeRequest===request&&request.generation===loadGeneration){projects=rows;registerProjects();}
  }catch(err){if(homeRequest===request){projects=[];error=err.message;}}
  finally{if(homeRequest===request){homeRequest=null;redraw();}}
 }
 async function loadWork(id,force=false){if(loadingWork===id||(!force&&loaded===id))return;loadingWork=id;const generation=loadGeneration;try{
  CampusPilotAPI.uuid(id);const [p,t,h,ph,l,d,reviews,evaluator]=await Promise.all([api.project(id),api.tasks(id),api.history(id),api.projectHistory(id),api.proposals(id),api.documents(id),api.documentReviews(id).then(rows=>({rows})).catch(err=>({error:err.message})),member.role==='teacher'?api.canEvaluate(id).catch(()=>false):false]);
  if(generation!==loadGeneration||selected()!==id)return;
  if(!p)throw Error('Aquest treball no existeix o no hi tens accés.');work=p;canEvaluate=evaluator===true;tasks=t;historyRows=h;projectRows=ph;proposals=l;documents=d;documentReviews=reviews.rows||[];reviewError=reviews.error||'';loaded=id;error='';
 }catch(err){if(generation===loadGeneration&&selected()===id){work=null;canEvaluate=false;tasks=[];proposals=[];documents=[];documentReviews=[];reviewError='';historyRows=[];projectRows=[];loaded=id;error=err.message;}}finally{if(generation===loadGeneration){loadingWork='';redraw();}}}
 const requiredMark='<span class="required-mark" aria-hidden="true">*</span>';
 const fieldLabel=(label,required)=>`<span>${label}${required?' '+requiredMark:''}</span>`;
 const input=(key,label,values,max=180,type='text',required=false)=>`<label>${fieldLabel(label,required)}<input type="${type}" name="${key}" maxlength="${max}" ${required?'required':''} value="${e(values[key])}"></label>`;
 const area=(key,label,values,max=6000,required=false)=>`<label>${fieldLabel(label,required)}<textarea name="${key}" maxlength="${max}" rows="4" ${required?'required':''}>${e(values[key])}</textarea></label>`;
 function frame(content){return `<div id="cp-root" class="cp-shell"><nav class="cp-nav" aria-label="Campus"><a href="#campus" class="cp-brand">quelcom <span>CAMPUS</span></a><div>${member?.role==='manager'?'':'<a href="#campus">Els treballs</a><a href="#campus-lliuraments">Lliuraments</a><a href="#campus-biblioteca">Biblioteca del pilot</a>'}${member?.institution?.id?`<a href="#campus-universitat">${e(member.institution.name)}</a>`:''}<a href="#login">El meu compte</a></div></nav><div class="cp-meta"><span>PILOT REAL · TFG / TFM / TR</span><span>${member?e(({teacher:'Docent assignat',student:'Estudiant',manager:'Gestor d’universitat'})[member.role]||'Participant'):'Accés per invitació'}</span></div>${error?`<p class="cp-alert" role="alert">${e(error)}</p>`:''}${notice?`<p class="cp-success" role="status">${e(notice)}</p>`:''}${content}<footer class="cp-footer">${member?'Treball privat a Quelcom. Només l’autoria i els docents assignats el poden consultar.':'Identifica’t amb el correu autoritzat al pilot.'} Les fitxes de biblioteca es comparteixen separadament i no s’utilitzen automàticament per entrenar IA.</footer></div>`;}
 function orientationState(key,kind,project){
  if(!orientations.has(key)){
   orientations.set(key,{flow:guidance.start(kind,project?.orientation_route,firstTaskTitle(project)),
    accepted:false,revision:project?.revision,dirty:false});
  }
  return orientations.get(key);
 }
 function firstTaskTitle(project){
  if(!project)return '';
  const card=tasks.find(task=>task.id===project.orientation_task_id&&task.project_id===project.id);
  return card?.title||project.orientation_first_step;
 }
 function orientationConfirmed(project){
  return Boolean(project?.orientation_route&&project.orientation_task_id);
 }
 function canAttach(){
  return !work?.drop_space_id&&work?.id===selected()&&loaded===selected()&&(member?.role==='teacher'||
   (member?.role==='student'&&work.owner_id===account?.id&&orientationConfirmed(work)));
 }
 function orientationSummary(route,task,editAction){
  return `<section class="cp-card cp-brief"><h2>Enfocament del treball</h2><h3>${e(guidance.label(route))}</h3><p>${e(task)}</p><button type="button" data-cp="${editAction}">Revisa l’orientació</button></section>`;
 }
 function creationPanel(){
  const state=orientationState('new','TFG');
  if(state.accepted){
   const choice=guidance.submission(state.flow);
   return orientationSummary(choice.route,choice.firstStep,'edit-orientation')+projectForm()+academicGuide(state.flow.kind,true);
  }
  const typeSelect=`<label>${fieldLabel('Tipus de treball',true)}<select id="cp-orientation-kind" required>${['TFG','TFM','TR'].map(kind=>
   `<option ${kind===state.flow.kind?'selected':''}>${kind}</option>`).join('')}</select></label>`;
  return `<section class="cp-form">${typeSelect}${guidance.render(state.flow,{busy,confirmLabel:'Continua amb la fitxa'})}
   <button type="button" data-cp="cancel">Cancel·la</button></section>`+academicGuide(state.flow.kind,true);
 }
 function detailOrientation(){
  if(work.drop_space_id)return '';
  if(!orientationConfirmed(work)&&member.role==='teacher'){
   return '<section class="cp-card cp-brief"><h2>Orientació pendent de l’estudiant</h2><p>Quan la confirmi, hi veuràs l’enfocament i la primera tasca.</p></section>';
  }
  if(orientationConfirmed(work)&&!orientations.has(work.id)){
   return orientationSummary(work.orientation_route,firstTaskTitle(work),'edit-orientation');
  }
  const state=orientationState(work.id,work.kind,work);
  return guidance.render(state.flow,{busy,confirmLabel:'Confirma l’orientació'})+
   (orientationConfirmed(work)?'<button type="button" data-cp="close-orientation">Tanca la revisió</button>':'');
 }
 function currentOrientation(){
  if(!member||!isPilot())return null;
  if(newProject&&!selected()&&member.role==='student')return orientations.get('new');
  if(work&&selected()===work.id&&loaded===work.id)return orientations.get(work.id);
  return null;
 }
 function focusOrientation(){
  document.querySelector?.('[data-orient-heading]')?.focus();
 }
 function confirmExistingOrientation(state,choice){
  const id=work.id,generation=loadGeneration,service=api;
  mutate(async()=>{
   const saved=await service.confirmOrientation(id,choice.route,choice.firstStep,state.revision);
   if(generation!==loadGeneration)return false;
   orientations.delete(id);
   if(selected()!==id)return false;
   work=saved;
   await loadWork(id,true);
   return selected()===id;
  },'Orientació desada. La primera tasca és al tauler i ja pots adjuntar documents.');
  redraw();
 }
 document.addEventListener('click',ev=>{
  const b=ev.target.closest?.('[data-orient-action]');
  if(!b?.dataset.orientAction||busy)return;
  const state=currentOrientation();if(!state)return;
  if(b.dataset.orientAction==='confirm'){
   const choice=guidance.submission(state.flow);
   if(!choice){error='';redraw();document.querySelector?.(state.flow.route?'[data-orient-task]':'[data-orient-route]')?.focus();return;}
   error='';
   if(!selected()){state.accepted=true;redraw();document.querySelector?.('#cp-project [name="title"]')?.focus();}
   else confirmExistingOrientation(state,choice);
  }else if(guidance.advance(state.flow,b.dataset.orientAction,b.dataset.orientValue)){
   state.dirty=true;redraw();focusOrientation();
  }
 });
 document.addEventListener('input',ev=>{
  if(ev.target.matches?.('[data-orient-task]')){
   const state=currentOrientation();if(state){state.flow.firstStep=ev.target.value;state.dirty=true;}
  }
 });
 document.addEventListener('change',ev=>{
  if(ev.target.id==='cp-orientation-kind'){
   const state=currentOrientation();if(state){state.flow.kind=ev.target.value;state.dirty=true;redraw();}return;
  }
  if(ev.target.matches?.('[data-orient-route]')){
   const state=currentOrientation();if(state&&guidance.advance(state.flow,'route',ev.target.value)){state.dirty=true;redraw();document.querySelector?.('[data-orient-route]')?.focus();}
  }
 });
 function projectForm(){const v=draft?.form==='project'?draft.values:newProject?{university:member.university,kind:'TFG'}:work||{};return `<form id="cp-project" class="cp-form"><h2>${newProject?'Comença el teu treball':'La fitxa del treball'}</h2>${newProject?`<input type="hidden" name="kind" value="${e(orientations.get('new').flow.kind)}">`:''}${input('title','Títol o idea',v,180,'text',true)}<div class="cp-grid">${input('university','Universitat o centre educatiu',v)}${input('degree','Titulació o curs',v)}</div>${area('objective','Què vols investigar o resoldre?',v)}${area('methodology','Com ho treballaràs?',v)}${area('next_step','Quin és el proper pas?',v,3000)}<div class="cp-actions"><button class="cp-primary" ${busy?'disabled':''}>${busy?'Desant…':'Desa a Quelcom'}</button><button type="button" data-cp="cancel">Cancel·la</button><button type="button" data-cp="export">Exporta el text pendent</button></div><p>Només el títol és obligatori. Pots completar la resta més endavant.</p></form>`;}
 function home(){return `<header class="cp-hero"><span>EL TEU ESPAI DE TREBALL</span><h1>${member.role==='teacher'?'Acompanya el següent pas':'El teu treball, al teu ritme'}</h1><p>${member.role==='teacher'?'Prepara un espai de lliurament per als teus estudiants o obre un treball per revisar-lo.':'Si el docent t’ha assignat un lliurament, obre’l i adjunta-hi el fitxer. També pots començar un treball propi.'}</p></header><div class="cp-actions"><a class="cp-drop-action" href="#campus-lliuraments">${member.role==='teacher'?'Gestiona els lliuraments':'Obre els meus lliuraments'}</a>${member.role==='student'?'<button data-cp="new-project">Nou TFG, TFM o TR</button>':''}<button data-cp="reload">Actualitza</button></div>${newProject?creationPanel():''}<div class="cp-projects">${projects.map(p=>`<a class="cp-card" href="#campus-treball/${e(p.id)}"><span>${e(p.kind)} · PRIVAT</span><h2>${e(p.title)}</h2><p>${e(p.university||'Centre pendent')}</p><small>${e(p.next_step||'Defineix el teu proper pas')}</small><p class="cp-date">Desat ${e(new Date(p.updated_at).toLocaleString('ca'))}</p></a>`).join('')||`<section class="cp-empty"><h2>${member.role==='teacher'?'Encara no tens treballs assignats':'Aquí comença el teu treball'}</h2><p>${member.role==='teacher'?'Quan es confirmi l’assignació, veuràs la fitxa, les tasques i l’historial.':'Els treballs que lliuris o creïs apareixeran aquí.'}</p></section>`}</div>`;}
 function taskForm(){const existing=tasks.find(t=>t.id===editor)||{};const v=draft?.form==='task'?draft.values:existing;return `<form id="cp-task" class="cp-form"><h2>${newTask?'Nova tasca o fita':'Edita la tasca'}</h2>${input('title','Què cal fer?',v,180,'text',true)}${area('why','Objectiu de la tasca',v,3000)}${area('how','Com la faràs?',v,3000)}${area('deliverable','Resultat o evidència que presentaràs',v,3000)}${area('criteria','Criteris per revisar-la',v,3000)}${area('blocker','Errors, dubtes o bloquejos',v,3000)}<div class="cp-grid">${input('owner_label','Responsable acordat',v)}${input('due','Data orientativa',v,30,'date')}</div><div class="cp-actions"><button class="cp-primary" ${busy?'disabled':''}>Desa a Quelcom</button><button type="button" data-cp="cancel">Cancel·la</button><button type="button" data-cp="export">Exporta el text pendent</button></div></form>`;}
 function excerptForm(){const v=draft?.form==='excerpt'?draft.values:{};return `<form id="cp-excerpt" class="cp-form"><h2>Prepara un aprenentatge per compartir</h2><p>Es compartirà només aquest extracte amb els participants del pilot, després de la revisió docent. No s’hi adjunta el treball privat, ni dades personals, ni documents.</p>${input('title','Títol de l’aprenentatge',v,180,'text',true)}${area('summary','Context i resultat, sense dades personals',v,3000,true)}${area('learning','Què pot aprofitar una altra persona?',v,3000,true)}<label class="cp-consent"><input type="checkbox" name="consent" required ${v.consent?'checked':''}> <span>Autoritzo compartir aquest extracte amb el pilot i confirmo que tinc dret a compartir-ne el contingut. ${requiredMark}</span></label><div class="cp-actions"><button class="cp-primary" ${busy?'disabled':''}>Envia a revisió docent</button><button type="button" data-cp="cancel">Cancel·la</button></div></form>`;}
 async function refreshAI(){const generation=loadGeneration,service=api;if(!service)return;try{const state=await service.aiAvailability();if(generation!==loadGeneration)return;aiAvailability=state;aiStatusError='';}catch(err){if(generation!==loadGeneration)return;aiAvailability=null;aiStatusError=err.message;}redraw();}
 const documentTitle=name=>String(name||'').split('--').slice(1).join('--');
 const tooLargeForAI=name=>Number(documents.find(d=>d.name===name)?.metadata?.size)>maxAIBytes;
 const formatBytes=bytes=>(Math.max(0,Number(bytes)||0)/1048576).toLocaleString('ca',{maximumFractionDigits:1})+' MB';
 function uploadProgressLabel(){if(!uploadProgress)return '';const {loaded,total,percent,status}=uploadProgress;if(status==='interrupted')return `Càrrega interrompuda al ${percent}%. Pots reintentar amb el mateix fitxer.`;if(status==='preparing')return 'Validant i preparant el document…';if(percent===100)return 'Fitxer transferit. Confirmant el desament…';return `Carregant: ${percent}% · ${formatBytes(loaded)} de ${formatBytes(total)}`;}
 function uploadProgressPanel(){return uploadProgress?`<div class="cp-upload-progress"><label id="cp-upload-progress-label" for="cp-upload-meter" role="status" aria-live="polite">${e(uploadProgressLabel())}</label><progress id="cp-upload-meter" max="100" value="${uploadProgress.percent}">${uploadProgress.percent}%</progress><p class="cp-hint">Conservem la selecció si la connexió falla. Mantén aquesta pàgina oberta per reprendre una càrrega interrompuda.</p></div>`:'';}
 function paintUploadProgress(){const label=document.getElementById('cp-upload-progress-label'),meter=document.getElementById('cp-upload-meter');if(label)label.textContent=uploadProgressLabel();if(meter&&uploadProgress)meter.value=uploadProgress.percent;}
 function documentCard(d){const large=Number(d.metadata?.size)>maxAIBytes;return `<article class="cp-card cp-document"><div class="cp-document-heading"><span class="cp-file-type">${e(d.name.split('.').pop().toUpperCase())}</span><span class="cp-date">${e(new Date(d.created_at).toLocaleDateString('ca'))}</span></div><h3>${e(documentTitle(d.name))}</h3><p class="cp-hint">Versió ${e(d.name.slice(0,8))} · Document privat${Number(d.metadata?.size)>0?' · '+e(formatBytes(d.metadata.size)):''}</p><div class="cp-actions"><button data-cp-download="${e(d.name)}">Descarrega</button><button data-cp-analyze="${e(d.name)}" ${large?`disabled aria-describedby="cp-ai-limit-${e(d.id)}"`:''}>Revisa amb l’assistent</button></div>${large?`<p id="cp-ai-limit-${e(d.id)}" class="cp-hint cp-ai-limit">La revisió assistida admet documents de fins a 10 MB. Adjunta un extracte o una versió reduïda per analitzar-lo; l’original continua disponible per descarregar.</p>`:''}</article>`;}

 function analysisForm(){if(!aiDraft)return '';const v=aiDraft;return `<form id="cp-analysis" class="cp-form cp-ai-form"><span class="cp-ai-label">REVISIÓ ASSISTIDA PRIVADA</span><h3>${e(documentTitle(v.storageName))}</h3><p>Analitzarem aquesta versió per resumir el contingut, detectar millores i explorar idees. Revisa les propostes amb el docent abans d’aplicar-les.</p>${area('question','Què vols que revisem? (opcional)',v,2000)}<label class="cp-consent"><input type="checkbox" name="consent" required ${v.consent?'checked':''}> <span>Autoritzo Quelcom a enviar aquest document i la pregunta al proveïdor extern d’intel·ligència artificial per fer aquesta anàlisi privada. ${requiredMark}</span></label><p class="cp-hint"><a href="https://openai.com/enterprise-privacy/" target="_blank" rel="noopener noreferrer">Consulta com tracta les dades el proveïdor de l’anàlisi</a></p><p class="cp-hint">Els resultats es desen dins del treball. No es publiquen a la biblioteca ni modifiquen les tasques automàticament.</p><div class="cp-actions"><button class="cp-primary" ${busy||aiAvailability?.available===false||tooLargeForAI(v.storageName)?'disabled':''}>${busy?'Analitzant el document…':'Analitza el document'}</button><button type="button" data-cp="cancel-analysis">Tanca</button></div></form>`;}
 function analysisResults(){return documentReviews.map(r=>{const result=r.result||{},complete=r.status==='completed';return `<article class="cp-card cp-ai-result"><div class="cp-document-heading"><span class="cp-ai-label">REVISIÓ ASSISTIDA · ${e(({processing:'EN CURS',completed:'PER REVISAR',failed:'NO COMPLETADA'})[r.status]||r.status)}</span><span class="cp-date">${e(new Date(r.created_at).toLocaleString('ca'))}</span></div><h3>${e(documentTitle(r.storage_name))}</h3>${r.question?`<p><b>La pregunta:</b> ${e(r.question)}</p>`:''}${complete?`<p>${e(result.summary)}</p>${['improvements','newIdeas'].map(kind=>`<h4>${kind==='improvements'?'Millores proposades':'Idees per explorar'}</h4>${(Array.isArray(result[kind])?result[kind]:[]).map((item,index)=>`<div class="cp-ai-suggestion"><h4>${e(item.title)}</h4><p>${e(item.detail)}</p><button data-cp-ai-task="${e(r.id)}" data-kind="${kind}" data-index="${index}">Prepara una tasca</button></div>`).join('')||'<p>No s’han proposat accions en aquest apartat.</p>'}`).join('')}${Array.isArray(result.questions)&&result.questions.length?`<h4>Preguntes per avançar</h4><ul>${result.questions.map(q=>`<li>${e(q)}</li>`).join('')}</ul>`:''}<details><summary>Font i límits de l’anàlisi</summary><p>Font: ${e(result.source?.name||documentTitle(r.storage_name))} · versió ${e(r.storage_name.slice(0,8))}</p><p>El document és la font de la revisió. Les afirmacions i les ubicacions suggerides per la IA s’han de contrastar amb l’original.</p>${result.source?.sha256?`<p class="cp-fingerprint">Empremta SHA-256: ${e(result.source.sha256)}</p>`:''}<ul>${(Array.isArray(result.limitations)?result.limitations:[]).map(x=>`<li>${e(x)}</li>`).join('')}</ul></details><button data-cp-download="${e(r.storage_name)}">Consulta el document original</button>`:r.status==='processing'?'<p role="status">La petició està en curs. Actualitza els resultats per comprovar si ha acabat. Si s’ha interromput, podràs iniciar una nova anàlisi més endavant.</p>':`<p>No s’ha pogut completar aquesta anàlisi. El document continua desat.</p><button data-cp-ai-retry="${e(r.id)}">Prepara un nou intent</button>`}</article>`;}).join('');}
 function documentPanel(){return `<section class="cp-section cp-documents"><div class="cp-document-heading"><div><span class="cp-ai-label">CONTINGUT DEL TREBALL</span><h2 tabindex="-1">Documents privats</h2></div><span class="cp-document-limit">50 MB per fitxer</span></div>${canAttach()?`<p>Adjunta un document de text, un full de càlcul, una presentació o un PDF. Cada càrrega conserva una versió nova, accessible només per als membres del treball.</p><form id="cp-upload" class="cp-upload"><label for="cp-file">${pendingFile?'Canvia el document seleccionat':'Selecciona el document '+requiredMark}</label><input type="file" id="cp-file" ${pendingFile?'':'required'} aria-describedby="cp-formats" ${busy?'disabled':''} accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"><p id="cp-formats" class="cp-hint">Formats PDF, DOC, DOCX, XLS, XLSX, PPT i PPTX. Sense fitxers protegits amb contrasenya.</p><button class="cp-primary" ${busy?'disabled':''}>${uploadProgress?.status==='interrupted'?'Reintenta la càrrega':uploadProgress&&busy?'Carregant el document…':'Desa el document privat'}</button>${uploadProgressPanel()}</form>`:work.drop_space_id?'<a href="#campus-lliuraments">Ves a l’espai de lliurament</a>':'<p class="cp-hint">Confirma l’orientació d’aquest treball per poder-hi adjuntar un fitxer.</p><button type="button" data-cp="go-orientation">Ves a l’orientador</button>'}${pendingFile?`<p>Selecció pendent: ${e(pendingFile.name)}</p>`:''}<div class="cp-document-list">${documents.map(documentCard).join('')||'<p class="cp-empty">Encara no hi ha documents. Pots començar amb l’esborrany, les dades o la presentació.</p>'}</div><div class="cp-ai-intro"><span class="cp-ai-label">REVISIÓ ASSISTIDA</span><h2>Del document al proper pas</h2><p class="cp-ai-size-note">Anàlisi IA: fins a 10 MB per document</p><p>Resum, millores concretes i noves idees. Tu decideixes quines propostes converteixes en tasques.</p>${aiAvailability?.available===false?'<p class="cp-alert" role="status">L’anàlisi de documents està pendent de configuració. Els documents desats continuen disponibles.</p>':aiAvailability?.available?'<p class="cp-hint">L’anàlisi està disponible. S’inicia quan autoritzes l’enviament del document al proveïdor extern.</p>':`<p class="cp-hint">${e(aiStatusError||'Comprovant la disponibilitat de l’anàlisi…')}</p>`}<details><summary>Què pot llegir aquesta revisió?</summary><p>En un PDF podem revisar el text i les pàgines. Dels documents de text i les presentacions en llegim el text. Per incloure imatges o gràfics, exporta el document a PDF. Dels fulls de càlcul en llegim fins a les primeres 1.000 files de cada full.</p></details><button data-cp="refresh-analysis" ${busy?'disabled':''}>Actualitza els resultats</button></div>${analysisForm()}${reviewError?`<p class="cp-alert" role="alert">No hem pogut recuperar les anàlisis: ${e(reviewError)}</p>`:''}${analysisResults()}</section>`;}
 function captureAnalysis(form){if(!aiDraft)return;const f=new FormData(form),question=String(f.get('question')||''),consent=f.has('consent');if(question!==aiDraft.question)aiDraft.requestId=crypto.randomUUID();aiDraft.question=question;aiDraft.consent=consent;}
 function feedbackForm(kind,id){
  if(!feedback||feedback.kind!==kind||feedback.id!==id)return '';
  const title=kind==='task'?'Retorn de la tasca':'Revisió de l’extracte';
  const label=kind==='task'?'Explica el retorn i el proper pas per a l’estudiant':'Explica la revisió de l’extracte, sense dades personals';
  return `<form id="cp-feedback" class="cp-form"><h4>${title}</h4>${area('comment',label,feedback,3000,true)}<div class="cp-actions"><button class="cp-primary" ${busy?'disabled':''}>Confirma la revisió</button><button type="button" data-cp="cancel-feedback">Cancel·la</button></div></form>`;
 }
 function openFeedback(kind,row,status){
  if(feedback?.id!==row.id||feedback?.status!==status){
   if(feedback?.comment&&!confirm('Vols descartar el comentari de revisió pendent?'))return;
   feedback={kind,id:row.id,status,revision:row.revision,projectId:work.id,comment:''};
  }
  error='';notice='';redraw();
  document.querySelector?.('#cp-feedback textarea')?.focus();
 }
 function submitFeedback(form){
  if(busy||!feedback||!canEvaluate||member?.role!=='teacher'||selected()!==feedback.projectId)return;
  feedback.comment=String(new FormData(form).get('comment')||'').trim();
  if(!feedback.comment){error='Escriu el comentari de revisió.';redraw();document.querySelector?.('#cp-feedback textarea')?.focus();return;}
  const entry=feedback,service=api,generation=loadGeneration;
  mutate(async()=>{
   const fields={status:entry.status,review_comment:entry.comment};
   if(entry.kind==='task')await service.saveTask(entry.id,entry.revision,fields);
   else await service.review(entry.id,entry.revision,fields);
   if(generation!==loadGeneration)return false;
   feedback=null;
   await loadWork(entry.projectId,true);
   if(entry.kind==='excerpt'){
    const updated=await service.library();if(generation===loadGeneration)feed=updated;
   }
  });
 }
 function detail(){if(loaded!==selected())return '<p role="status">Recuperant el teu treball…</p>';if(!work)return '<p><a href="#campus">Torna als treballs</a></p>';if(defense&&ownsDefense(defense))return defensePanel();const owner=work.owner_id===account.id;return `<a href="#campus" class="cp-back">Tots els treballs</a><header class="cp-hero"><span>${e(work.kind)} · TREBALL PRIVAT</span><h1>${e(work.title)}</h1><p>${e(work.university)}${work.degree?' · '+e(work.degree):''}</p><small>Desat ${e(new Date(work.updated_at).toLocaleString('ca'))} · versió ${work.revision+1}</small></header><div class="cp-actions"><button data-cp="edit-project">Edita la fitxa</button>${hasProjectAccess()&&globalThis.CampusDefense?'<button type="button" data-defense-open>Espai de presentacions</button>':''}<button data-cp="new-task">Afegeix una tasca</button><button data-cp="reload">Recupera la darrera versió</button>${owner?'<button data-cp="new-excerpt">Proposa un aprenentatge</button>':''}</div>${academicGuide(work.kind)}${detailOrientation()}${editor==='project'?projectForm():`<section class="cp-card cp-brief"><h2>La idea i el proper pas</h2><h3>Objectiu</h3><p>${e(work.objective||'Encara per concretar')}</p><h3>Mètode</h3><p>${e(work.methodology||'Encara per concretar')}</p><h3>Propera acció</h3><p>${e(work.next_step||'Encara per concretar')}</p></section>`}${newTask||(editor&&editor!=='project')?taskForm():''}<h2>Les tasques del treball</h2><p>Afegeix les tasques que siguin útils per a aquest treball, al teu ritme.</p><div class="cp-task-grid">${[...tasks].sort((a,b)=>Number(b.id===work.orientation_task_id)-Number(a.id===work.orientation_task_id)).map(t=>`<article class="cp-card"><span class="cp-status">${labels[t.status]}</span><h3>${e(t.title)}</h3><p>${e(t.why)}</p><details><summary>Com ho treballarem</summary><p>${e(t.how)}</p><h4>Entrega</h4><p>${e(t.deliverable||'Per acordar')}</p><h4>Criteris</h4><p>${e(t.criteria||'Per acordar')}</p><p>${e(t.owner_label)} ${e(t.due||'')}</p></details>${t.blocker?`<p class="cp-alert">${e(t.blocker)}</p>`:''}${t.review_comment?`<p class="cp-feedback"><b>Retorn docent</b><br>${e(t.review_comment)}</p>`:''}<div class="cp-actions">${!['review','done'].includes(t.status)?`<button data-cp-edit="${t.id}">Edita</button>`:''}${({prepare:[['active','Comença']],active:[['review','Demana revisió']],revise:[['active','Reprèn']],review:canEvaluate?[['revise','Demana ajustos'],['done','Marca revisada']]:[],done:canEvaluate?[['revise','Reobre']]:[]})[t.status].map(([s,label])=>`<button data-cp-move="${t.id}" data-status="${s}">${label}</button>`).join('')}</div>${feedbackForm('task',t.id)}</article>`).join('')||'<p class="cp-empty">Encara no hi ha tasques. Pots començar per la fitxa i afegir-ne després.</p>'}</div>${documentPanel()}${newExcerpt?excerptForm():''}<section class="cp-section"><h2>Aprenentatges per a la biblioteca</h2>${proposals.map(l=>`<article class="cp-card"><span>${e(({pending:'Pendent de revisió',published:'Compartit amb el pilot',changes:'Cal ajustar',withdrawn:'Retirat'})[l.status])}</span><h3>${e(l.title)}</h3><p>${e(l.summary)}</p><p>${e(l.learning)}</p>${l.review_comment?`<p class="cp-feedback">${e(l.review_comment)}</p>`:''}<div class="cp-actions">${owner&&l.status!=='withdrawn'?`<button data-cp-withdraw="${l.id}">Retira l’extracte</button>`:''}${canEvaluate&&l.status==='pending'?`<button data-cp-review="${l.id}" data-status="published">Aprova per a la biblioteca</button><button data-cp-review="${l.id}" data-status="changes">Demana ajustos</button>`:''}</div>${feedbackForm('excerpt',l.id)}</article>`).join('')||'<p>El treball és privat. Encara no se n’ha proposat cap extracte.</p>'}</section><details class="cp-section"><summary>Historial del treball i de les tasques</summary>${projectRows.map(r=>`<p>${e(new Date(r.happened_at).toLocaleString('ca'))} · ${r.actor_role==='teacher'?'Docent':'Estudiant'} · Fitxa v${r.snapshot.revision+1}: ${e(r.snapshot.title)}</p>`).join('')}${historyRows.map(r=>`<p>${e(new Date(r.happened_at).toLocaleString('ca'))} · ${r.actor_role==='teacher'?'Docent':'Estudiant'} · ${e(r.after_state.title)} · ${e(labels[r.after_state.status])}</p>`).join('')}</details>`;}
 function library(){return `<header class="cp-hero"><span>CONEIXEMENT COMPARTIT</span><h1>Biblioteca del pilot</h1><p>Extractes autoritzats per l’autoria i revisats pel docent. Els treballs complets continuen privats.</p></header><button data-cp="reload">Actualitza</button><div class="cp-projects">${feed.map(l=>`<article class="cp-card"><span>${e(l.kind)} · CAS REAL DEL PILOT</span><h2>${e(l.title)}</h2><p>${e(l.summary)}</p><h3>Què n’hem après</h3><p>${e(l.learning)}</p></article>`).join('')||'<section class="cp-empty"><h2>El primer aprenentatge està per arribar</h2><p>Des del treball, l’estudiant pot proposar un extracte. El docent el revisa abans de publicar-lo aquí.</p></section>'}</div>`;}
 function page(){if(!booted)return frame('<p role="status">Connectant amb el teu Campus…</p>');if(!member)return frame(`<header class="cp-hero"><h1>El teu accés al pilot</h1><p>${e(account?.email||'No hem pogut comprovar el compte.')}</p><p>${error?'Torna a comprovar la connexió.':'Aquest compte encara no té una invitació activa. Comunica aquest correu al coordinador perquè et doni d’alta com a estudiant o docent.'}</p></header><button data-cp="reload">Comprova l’accés</button> <a href="#login">Canvia de compte</a>`);if(universityPage())return frame(universityPanel());
  if(!academicMember()||location.hash==='#campus-universitat')return frame('<p>El compte no té cap centre assignat.</p>');
  if(dropRoute())return frame(dropPanel());
  return frame(location.hash==='#campus-biblioteca'?library():selected()?detail():home());}
 routes['campus-lliuraments']=['Lliuraments',page];
 routes['campus-universitat']=['La meva universitat',page];routes.campus=['Campus · Pilot real',page];routes.inici=routes.campus;routes['campus-biblioteca']=['Biblioteca del pilot',page];
 function capture(form){const f=new FormData(form);draft={form:form.id.replace('cp-',''),values:Object.fromEntries(f),id:draft?.id||crypto.randomUUID(),revision:draft?.revision??(form.id==='cp-project'?work?.revision:tasks.find(t=>t.id===editor)?.revision)};if(form.id==='cp-excerpt')draft.values.consent=f.has('consent');}
 const discard=()=>!draft||confirm('Hi ha text pendent de desar. Vols sortir sense desar-lo?');
 function closeEditors(){editorCache.delete(editorScope);editor=null;draft=null;newProject=false;newTask=false;newExcerpt=false;}
 document.addEventListener('input',ev=>{if(feedback&&ev.target.closest?.('#cp-feedback')){feedback.comment=ev.target.value;return;}const analysis=ev.target.closest?.('#cp-analysis');if(analysis){captureAnalysis(analysis);return;}const f=ev.target.closest?.('#cp-project,#cp-task,#cp-excerpt');if(f)capture(f);});
 document.addEventListener('change',ev=>{const analysis=ev.target.closest?.('#cp-analysis');if(analysis){captureAnalysis(analysis);return;}if(ev.target.id==='cp-file'){if(busy||!canAttach())return;uploadProgress=null;pendingFile=ev.target.files?.[0]||null;fileId=crypto.randomUUID();redraw();return;}const f=ev.target.closest?.('#cp-project,#cp-task,#cp-excerpt');if(f)capture(f);});
 document.addEventListener('click',ev=>{if(!isPilot())return;const link=ev.target.closest?.('a[href^="#"]');if(link&&(busy||defense?.saving||dropView?.busy()||universityView?.saving)){ev.preventDefault();ev.stopImmediatePropagation();return;}if(link&&feedback?.comment&&!confirm('Vols sortir sense desar el comentari de revisió?')){ev.preventDefault();ev.stopImmediatePropagation();return;}if(link&&draft){if(!discard()){ev.preventDefault();ev.stopImmediatePropagation();}else closeEditors();}},true);
 window.addEventListener('beforeunload',ev=>{if(draft||feedback?.comment||defense?.draft||defense?.saving||dropView?.busy()||universityView?.saving||pendingDefenses.size||aiDraft||pendingFile||busy||[...orientations.values()].some(s=>s.dirty)||analysisDrafts.size||[...editorCache.values()].some(v=>v.draft)){ev.preventDefault();ev.returnValue='';}});
 async function mutate(action,message='Canvis desats a Quelcom.'){if(busy||!api||!academicMember())return;const generation=loadGeneration;busy=true;error='';notice='';try{const outcome=await action();if(outcome!==false&&generation===loadGeneration)notice=message;}catch(err){if(generation===loadGeneration)error=err.message;}finally{if(generation===loadGeneration){busy=false;redraw();}}}
 document.addEventListener('submit',ev=>{if(ev.target.id==='cp-feedback'){ev.preventDefault();submitFeedback(ev.target);return;}if(ev.target.id==='cp-analysis'){ev.preventDefault();if(busy||!aiDraft||!work)return;if(tooLargeForAI(aiDraft.storageName)){error='La revisió assistida admet documents de fins a 10 MB. Adjunta un extracte o una versió reduïda.';redraw();return;}captureAnalysis(ev.target);const id=work.id,generation=loadGeneration,request={...aiDraft};mutate(async()=>{const review=await api.analyzeDocument(id,request.storageName,request.requestId,request.question,request.consent);if(generation!==loadGeneration)return;if(selected()===id){documentReviews=[review,...documentReviews.filter(r=>r.id!==review.id)];if(review.status==='completed'){aiDraft=null;analysisDrafts.delete(id);}if(review.status==='failed')throw Error('L’anàlisi no s’ha completat. Conservem la pregunta i el document per revisar-los.');}},'Petició confirmada. Consulta l’estat i les propostes a l’apartat de revisió.');redraw();return;}if(ev.target.id==='cp-upload'){ev.preventDefault();if(busy||!canAttach())return;if(!pendingFile){error='Selecciona un document per adjuntar-lo.';redraw();return;}const id=work.id,generation=loadGeneration,file=pendingFile,uploadId=fileId;const current=()=>generation===loadGeneration&&selected()===id&&pendingFile===file&&fileId===uploadId;uploadProgress={loaded:0,total:file?.size||0,percent:0,status:'preparing'};mutate(async()=>{try{await api.uploadDocument(id,file,uploadId,progress=>{if(!current())return;const total=Math.max(0,Number(progress.total)||file?.size||0),loaded=Math.max(0,Math.min(total,Number(progress.loaded)||0)),percent=Math.max(0,Math.min(100,Math.round(Number(progress.percent)||0)));const previous=uploadProgress?.percent;uploadProgress={loaded,total,percent,status:'uploading'};if(previous!==percent)paintUploadProgress();});}catch(err){if(!current())return false;uploadProgress={...uploadProgress,status:'interrupted'};throw err;}if(!current())return false;pendingFile=null;fileId=null;uploadProgress=null;await loadWork(id,true);},'Document privat desat a Quelcom.');redraw();return;}if(!['cp-project','cp-task','cp-excerpt'].includes(ev.target.id))return;ev.preventDefault();capture(ev.target);const f=draft,projectId=work?.id,projectKind=work?.kind,taskId=editor,creatingProject=newProject,creatingTask=newTask;mutate(async()=>{
  const v=f.values;
  const generation=loadGeneration,service=api;
  if(f.form==='project'){
   const row=Object.fromEntries(['title','university','degree','objective','methodology','next_step'].map(k=>[k,v[k]||'']));
   if(creatingProject){
    const state=orientations.get('new'),choice=state?.accepted&&guidance.submission(state.flow);
    if(!choice||member.role!=='student')throw Error('Completa l’orientació abans de desar el treball.');
    const saved=await service.createProject({...row,id:f.id,owner_id:account.id,kind:state.flow.kind});
    if(generation!==loadGeneration)return false;
    const entry={...state,revision:saved.revision,accepted:false};
    orientations.set(saved.id,entry);
    let confirmError;
    try{await service.confirmOrientation(saved.id,choice.route,choice.firstStep,saved.revision);}
    catch(err){confirmError=err;}
    if(generation!==loadGeneration)return false;
    if(!confirmError)orientations.delete(saved.id);
    orientations.delete('new');closeEditors();
    projects=[saved,...projects.filter(p=>p.id!==saved.id)];registerProjects();loaded='';
    location.hash='campus-treball/'+saved.id;
    if(confirmError){notice='Fitxa desada. Cal tornar a confirmar l’orientació abans de pujar fitxers.';return false;}
   }else{
    const saved=await service.saveProject(projectId,f.revision,row);
    if(generation!==loadGeneration||selected()!==projectId)return false;
    closeEditors();projects=await service.projects();if(generation!==loadGeneration)return false;
    registerProjects();loaded='';location.hash='campus-treball/'+saved.id;
   }
  }else if(f.form==='task'){
   const row=Object.fromEntries(['title','why','how','deliverable','criteria','blocker','owner_label'].map(k=>[k,v[k]||'']));row.due=v.due||null;
   if(creatingTask)await api.createTask({...row,id:f.id,project_id:projectId});else await api.saveTask(taskId,f.revision,row);
   closeEditors();await loadWork(projectId,true);
  }else{
   await api.propose({id:f.id,project_id:projectId,owner_id:account.id,kind:projectKind,title:v.title,summary:v.summary,learning:v.learning,consent:v.consent});closeEditors();await loadWork(projectId,true);
  }
 });});
 document.addEventListener('click',ev=>{const b=ev.target.closest?.('[data-cp],[data-cp-edit],[data-cp-move],[data-cp-review],[data-cp-withdraw],[data-cp-download],[data-cp-analyze],[data-cp-ai-task],[data-cp-ai-retry]');if(!b||busy)return;
  if(b.dataset.cp==='cancel-feedback'){feedback=null;error='';redraw();return;}
  if(b.dataset.cp==='academic-task'){
   if(!hasProjectAccess()||!discard())return;
   const values=globalThis.CampusAcademicPath?.taskTemplate({kind:work.kind,role:member.role});
   if(!values)return;
   closeEditors();newTask=true;draft={form:'task',id:crypto.randomUUID(),values};
   notice='Revisa la proposta de tasca i desa-la quan estigui a punt.';error='';redraw();
   document.querySelector?.('#cp-task [name="title"]')?.focus();return;
  }
  if(b.dataset.cp==='go-orientation'){focusOrientation();return;}
  if(b.dataset.cp==='edit-orientation'){
   if(!selected()&&newProject){const state=orientations.get('new');if(state)state.accepted=false;}
   else if(work&&selected()===work.id)orientationState(work.id,work.kind,work);
   error='';redraw();focusOrientation();return;
  }
  if(b.dataset.cp==='close-orientation'&&work){orientations.delete(work.id);redraw();return;}
  if(b.dataset.cpAiRetry){const review=documentReviews.find(r=>r.id===b.dataset.cpAiRetry&&r.status==='failed');if(!review)return;if(tooLargeForAI(review.storage_name)){error='La revisió assistida admet documents de fins a 10 MB.';redraw();return;}if(aiDraft?.question&&aiDraft.question!==review.question&&!confirm('Vols substituir la pregunta pendent per la d’aquesta anàlisi?'))return;aiDraft={storageName:review.storage_name,question:review.question||'',consent:false,requestId:crypto.randomUUID()};redraw();document.getElementById('cp-analysis')?.scrollIntoView({block:'center',behavior:'auto'});return;}
  if(b.dataset.cpAnalyze){if(!work||!documents.some(d=>d.name===b.dataset.cpAnalyze))return;if(tooLargeForAI(b.dataset.cpAnalyze)){error='La revisió assistida admet documents de fins a 10 MB. Adjunta un extracte o una versió reduïda.';redraw();return;}if(aiDraft?.storageName!==b.dataset.cpAnalyze){if(aiDraft?.question&&!confirm('Vols canviar de document i descartar aquesta pregunta pendent?'))return;aiDraft={storageName:b.dataset.cpAnalyze,question:'',consent:false,requestId:crypto.randomUUID()};}redraw();document.getElementById('cp-analysis')?.scrollIntoView({block:'center',behavior:'auto'});return;}
  if(b.dataset.cp==='cancel-analysis'){if(aiDraft?.question&&!confirm('Vols tancar i descartar la pregunta pendent?'))return;aiDraft=null;analysisDrafts.delete(selected());redraw();return;}
  if(b.dataset.cp==='refresh-analysis'){const projectId=work?.id,generation=loadGeneration;if(!projectId)return;mutate(async()=>{const rows=await api.documentReviews(projectId);if(generation!==loadGeneration)return;if(selected()===projectId){documentReviews=rows;reviewError='';}await refreshAI();},'Estat de les anàlisis actualitzat.');return;}
  if(b.dataset.cpAiTask){const r=documentReviews.find(x=>x.id===b.dataset.cpAiTask),kind=b.dataset.kind,index=Number(b.dataset.index);if(!r||r.status!=='completed'||!['improvements','newIdeas'].includes(kind)||!Number.isInteger(index)||index<0)return;const item=r.result?.[kind]?.[index];if(!item||!discard())return;closeEditors();newTask=true;draft={form:'task',id:crypto.randomUUID(),values:{title:String(item.title||'').slice(0,180),why:String(item.detail||'').slice(0,3000),how:'Proposta de l’assistent per contrastar amb '+documentTitle(r.storage_name)+' (versió '+r.storage_name.slice(0,8)+').',deliverable:'',criteria:'',blocker:'',owner_label:'',due:''}};notice='Proposta preparada com a esborrany. Revisa-la i desa-la quan estigui a punt.';redraw();document.getElementById('cp-task')?.scrollIntoView({block:'start',behavior:'auto'});return;}
  if(b.dataset.cpDownload){
   if(!hasProjectAccess())return;
   const name=b.dataset.cpDownload,projectId=work.id,generation=loadGeneration,service=api;
   mutate(async()=>{
    const blob=await service.downloadDocument(projectId,name);
    if(generation!==loadGeneration||selected()!==projectId||work?.id!==projectId)return false;
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=documentTitle(name);
    a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
   },'Document privat descarregat.');return;
  }
  if(b.dataset.cp==='export'){const blob=new Blob([JSON.stringify(draft||{},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='quelcom-text-pendent.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return;}
  if(b.dataset.cp==='reload'){if(!discard())return;closeEditors();error='';notice='';if(member){mutate(async()=>{const current=await api.enroll();if(!current){reset();boot();return;}if(selected()){const id=selected();await loadWork(id,true);const state=orientations.get(id);if(state&&work?.id===id){state.revision=work.revision;}}else{projects=await api.projects();feed=await api.library();registerProjects();}},'Dades actualitzades.');}else{booted=false;boot();}return;}
  if(['new-project','edit-project','new-task','new-excerpt','cancel'].includes(b.dataset.cp)||b.dataset.cpEdit){if(!discard())return;closeEditors();if(b.dataset.cp==='new-project'){orientations.delete('new');newProject=true;}if(b.dataset.cp==='cancel'&&!selected())orientations.delete('new');if(b.dataset.cp==='edit-project')editor='project';if(b.dataset.cp==='new-task')newTask=true;if(b.dataset.cp==='new-excerpt')newExcerpt=true;if(b.dataset.cpEdit)editor=b.dataset.cpEdit;error='';notice='';redraw();return;}
  if(b.dataset.cpMove){
   const projectId=work.id,t=tasks.find(x=>x.id===b.dataset.cpMove);if(!t)return;
   const status=b.dataset.status;
   if(['done','revise'].includes(status)){if(member.role==='teacher'&&canEvaluate)openFeedback('task',t,status);return;}
   mutate(async()=>{await api.saveTask(t.id,t.revision,{status});await loadWork(projectId,true);});
  }
  if(b.dataset.cpReview){
   const proposal=proposals.find(x=>x.id===b.dataset.cpReview);
   if(proposal&&member.role==='teacher'&&canEvaluate)openFeedback('excerpt',proposal,b.dataset.status);
   return;
  }
  if(b.dataset.cpWithdraw){
   const projectId=work.id,l=proposals.find(x=>x.id===b.dataset.cpWithdraw);if(!l)return;
   mutate(async()=>{await api.review(l.id,l.revision,{status:'withdrawn'});await loadWork(projectId,true);feed=await api.library();});
  }
 });
 const previous=render;
 render=function(){
  let key=location.hash.slice(1);
  // This release exposes only Campus to the pilot, including manually entered old URLs.
  if(key&&!['entrada','login','espai','campus','inici','campus-biblioteca','campus-universitat','campus-lliuraments'].includes(key)&&!/^campus-treball\/[0-9a-f-]{36}$/i.test(key)){history.replaceState(null,'','#campus');key='campus';}
  if(!dropRoute()){
   leaveDropbox();
   // A direct delivery link loads only enrollment and the private inbox.
   // Resume normal Campus startup on the first visit to the other academic views.
   if(workspaceDeferred&&isPilot()&&!universityPage()){workspaceDeferred=false;homeNeedsRefresh=false;booted=false;}
  }
  if(key.startsWith('campus-treball/'))routes[key]=['Treball acadèmic',page];
  const nextScope=selected()||key;if(nextScope!==editorScope){leaveDefense(true);
   if(universityView&&!universityPage())universityView=null;
   if(loaded&&loaded!==selected()){loaded='';work=null;canEvaluate=false;}
   feedback=null;pendingFile=null;fileId=null;uploadProgress=null;if(aiDraft)analysisDrafts.set(editorScope,aiDraft);else analysisDrafts.delete(editorScope);aiDraft=analysisDrafts.get(nextScope)||null;if(draft)editorCache.set(editorScope,{editor,draft,newProject,newTask,newExcerpt});({editor=null,draft=null,newProject=false,newTask=false,newExcerpt=false}=editorCache.get(nextScope)||{});editorScope=nextScope;}
  previous();document.body.classList.toggle('cp-active',isPilot());
  if(defense)globalThis.CampusDefense?.syncTimer();
  if(['login','espai'].includes(key))document.querySelectorAll('.qu-space-switch').forEach(x=>x.remove());
  if(isPilot()){document.querySelectorAll('.qu-space-switch,.dimension-guide').forEach(x=>x.remove());if(document.getElementById('cp-root')){boot();if(booted&&universityPage()){if(!universityView)readUniversity();}else if(academicMember()&&dropRoute()){mountDropbox();}else if(academicMember()){if(selected()&&loaded!==selected())loadWork(selected());else refreshHome();}}}
 };
 // Visibility rechecks authorization without overwriting an unsaved form.
 document.addEventListener('visibilitychange',async()=>{if(document.hidden||!api||!member||busy)return;try{const service=api,generation=loadGeneration,current=await service.enroll();
   if(generation!==loadGeneration||api!==service)return;
   if(!current||current.role!==member.role||current.institution?.id!==member.institution?.id||current.institution?.can_manage!==member.institution?.can_manage){reset();redraw();return;}
   if(universityPage())await readUniversity();
   else if(dropRoute())await dropView?.refresh?.();
   else if(academicMember()&&member.role==='teacher'){
    if(selected())await loadWork(selected(),true);
    else{homeNeedsRefresh=true;await refreshHome();}
   }}catch{notice='No hem pogut comprovar la connexió. Conserva el text pendent abans de sortir.';}});
 render();
})();
