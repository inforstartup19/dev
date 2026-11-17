/* Shared academic domain. Demo roles are not authentication. Server must recheck permissions. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AcademicWorkspace=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 const statuses=['prepare','active','review','revise','done'];
 const labels={prepare:'Per preparar',active:'En curs',review:'En revisió',revise:'Cal revisar',done:'Completat'};
 const copy=x=>JSON.parse(JSON.stringify(x));
 function text(x,max,required=false){if(typeof x!=='string'||x.length>max||(required&&!x.trim()))throw Error('Revisa els camps obligatoris i la seva longitud.');return x.trim();}
 function valid(s){
  if(!s||s.schema!==1||!['TFG','TFM'].includes(s.kind)||!Number.isInteger(s.revision)||s.revision<0||!Array.isArray(s.tasks)||!Array.isArray(s.history)||!Array.isArray(s.submissions))throw Error('Format de treball no reconegut. Conserva una còpia abans de recuperar-lo.');
  const ids=new Set();
  for(const t of s.tasks){text(t.id,100,true);if(ids.has(t.id))throw Error('Tasca duplicada.');ids.add(t.id);text(t.title,180,true);for(const f of ['why','how','deliverable','criteria','blocker'])text(t[f],3000);text(t.owner,180);if(t.evidence!==undefined)text(t.evidence,3000);if(t.requireEvidence!==undefined&&typeof t.requireEvidence!=='boolean')throw Error('Requisit d’evidència no vàlid.');if(!statuses.includes(t.status)||typeof t.milestone!=='boolean'||!Array.isArray(t.dependencies)||!/^$|^\d{4}-\d{2}-\d{2}$/.test(t.due))throw Error('Tasca no vàlida.');}
  if(s.sequence!==undefined&&(!Array.isArray(s.sequence)||s.sequence.length!==s.tasks.length||new Set(s.sequence).size!==s.sequence.length||s.sequence.some(id=>!ids.has(id))))throw Error('Seqüència de tasques no vàlida.');
  for(const t of s.tasks)if(t.dependencies.some(id=>!ids.has(id)))throw Error('Dependència inexistent.');
  const visiting=new Set(),visited=new Set();function visit(id){if(visiting.has(id))throw Error('Les dependències formen un cercle.');if(visited.has(id))return;visiting.add(id);s.tasks.find(t=>t.id===id).dependencies.forEach(visit);visiting.delete(id);visited.add(id);}s.tasks.forEach(t=>visit(t.id));
  for(const h of s.history)if(!h||typeof h.message!=='string'||!['student','teacher'].includes(h.actor)||typeof h.at!=='string')throw Error('Historial no vàlid.');
  for(const sub of s.submissions)if(!sub||!ids.has(sub.taskId)||!Number.isInteger(sub.version)||!sub.snapshot||typeof sub.at!=='string')throw Error('Entrega no vàlida.');
  return s;
 }
 function blockedBy(s,id){if(!s.sequence)return [];const index=s.sequence.indexOf(id);return s.sequence.slice(0,index<0?s.sequence.length:index).filter(previous=>s.tasks.find(t=>t.id===previous)?.status!=='done');}
 function create(kind){return valid({schema:1,kind,revision:0,tasks:[],history:[],submissions:[]});}
 function apply(current,action,actor,at=new Date().toISOString()){
  valid(current);if(!['student','teacher'].includes(actor))throw Error('Perfil desconegut.');
  const s=copy(current);let message;
  if(s.sequence){const id=action.id||action.task?.id;if(!s.sequence.includes(id))throw Error('Aquest recorregut té una seqüència fixa de tasques.');const waiting=blockedBy(s,id);if(waiting.length)throw Error('Tasca bloquejada. Abans cal la validació docent de: '+waiting.map(id=>s.tasks.find(t=>t.id===id).title).join(', ')+'.');}
  if(action.type==='save'){
   const old=s.tasks.find(t=>t.id===action.task.id);const input=action.task;
   if(old&&['review','done'].includes(old.status))throw Error('Reobre la tasca abans de modificar-la.');
   const task={id:text(input.id,100,true),title:text(input.title,180,true),status:old?.status||'prepare',milestone:input.milestone===true,dependencies:input.dependencies||[],due:text(input.due||'',10),owner:text(input.owner||'',180)};
   task.requireEvidence=old?old.requireEvidence===true:input.requireEvidence===true;task.evidence=text(input.evidence||'',3000);
   for(const f of ['why','how','deliverable','criteria','blocker'])task[f]=text(input[f]||'',3000);
   if(old)s.tasks[s.tasks.indexOf(old)]=task;else s.tasks.push(task);
   message=(old?'Tasca editada: ':'Tasca creada: ')+task.title;
  }else if(action.type==='move'){
   const t=s.tasks.find(t=>t.id===action.id);if(!t)throw Error('Tasca no trobada.');
   const transitions={prepare:['active'],active:['prepare','review'],review:['revise','done'],revise:['active'],done:['revise']};
   if(!transitions[t.status].includes(action.status))throw Error('Transició no permesa.');
   if(['review','done'].includes(t.status)&&actor!=='teacher')throw Error('Cal revisió docent.');
   if(['revise','done'].includes(action.status))text(action.comment||'',3000,true);
   if(['review','done'].includes(action.status)){
    if(t.blocker||t.dependencies.some(id=>s.tasks.find(x=>x.id===id).status!=='done'))throw Error('Resol el bloqueig i les dependències abans de presentar la tasca.');
    text(t.deliverable,3000,true);text(t.criteria,3000,true);if(t.requireEvidence)text(t.evidence||'',3000,true);
   }
   if(action.status==='review')s.submissions.push({taskId:t.id,version:s.submissions.filter(x=>x.taskId===t.id).length+1,snapshot:copy(t),at});
   t.status=action.status;message=t.title+': '+labels[t.status]+(action.comment?' · '+text(action.comment,3000):'');
  }else throw Error('Acció desconeguda.');
  s.revision++;s.history.push({actor,at,message,taskId:action.id||action.task?.id});return valid(s);
 }
 function save(storage,key,state,expected){valid(state);if(storage.getItem(key)!==expected)throw Error('Hi ha canvis en una altra pestanya. Exporta el que tens i recarrega abans de continuar.');const raw=JSON.stringify(state);storage.setItem(key,raw);return raw;}
 return {statuses,labels,create,valid,blockedBy,apply,save};
});
