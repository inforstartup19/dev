/* Preparatory sidecar only: never changes Projecte Viu identity, stage or permissions. */
(function(root){
 const catalog=typeof module==='object'&&module.exports?require('./startup-catalog.js'):root.QuelcomStartupCatalog;
 const noteKeys=new Set(['campus','mentoria',...catalog.tracks.flatMap(t=>t.steps.map(s=>t.id+'/'+s.id))]);
 const text=(v,max=3000)=>{if(typeof v!=='string'||v.length>max)throw Error('El text supera el límit o té un format invàlid.');return v;};
 function exact(value,keys){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!keys.includes(k))||keys.some(k=>!(k in value)))throw Error('Format de preparació no compatible.');}
 function recommend(answers){exact(answers,['need','mvp','evidence']);if(Object.values(answers).some(v=>typeof v!=='boolean'))throw Error('Respostes no vàlides.');return answers.need&&answers.mvp&&answers.evidence?{track:'enlaira',reason:'Has indicat necessitat contrastada, MVP i evidències. Pots proposar Enlaira per a una revisió inicial; encara no és una admissió.'}:{track:'crea-i-creix',reason:'Encara hi ha hipòtesis inicials per contrastar. Crea i creix t’ajuda a preparar una primera prova; pots explorar també Enlaira.'};}
 function create(projectId){if(!text(projectId,100))throw Error('Tria un projecte.');return {schemaVersion:1,projectId,revision:0,notes:{},diagnosis:null,financing:'pendent'};}
 function valid(value,projectId){exact(value,['schemaVersion','projectId','revision','notes','diagnosis','financing']);if(value.schemaVersion!==1||value.projectId!==projectId||!Number.isSafeInteger(value.revision)||value.revision<0)throw Error('Preparació d’un altre projecte o versió no compatible.');create(value.projectId);if(!value.notes||typeof value.notes!=='object'||Array.isArray(value.notes))throw Error('Notes no vàlides.');for(const [key,note] of Object.entries(value.notes)){if(!noteKeys.has(key))throw Error('Etapa desconeguda.');exact(note,['goal','action','evidence','question','updatedAt']);for(const f of ['goal','action','evidence','question'])text(note[f]);text(note.updatedAt,40);if(!Number.isFinite(Date.parse(note.updatedAt)))throw Error('Data no vàlida.');}if(value.diagnosis!==null)recommend(value.diagnosis);if(!catalog.financing.some(f=>f.id===value.financing))throw Error('Via de recursos no vàlida.');return value;}
 function apply(value,action,at=new Date().toISOString()){
  valid(value,value.projectId);const next=JSON.parse(JSON.stringify(value));
  if(action.type==='note'){if(!noteKeys.has(action.key))throw Error('Etapa desconeguda.');exact(action.fields,['goal','action','evidence','question']);next.notes[action.key]={...action.fields,updatedAt:at};}
  else if(action.type==='diagnosis'){recommend(action.answers);next.diagnosis={...action.answers};}
  else if(action.type==='financing'){next.financing=action.value;}
  else throw Error('Acció no disponible.');
  next.revision++;return valid(next,next.projectId);
 }
 function parse(raw,projectId){if(raw===null)return create(projectId);if(raw.length>250000)throw Error('Les dades superen el límit.');return valid(JSON.parse(raw),projectId);}
 function save(storage,key,value,baseline){valid(value,value.projectId);if(storage.getItem(key)!==baseline)throw Error('Una altra pestanya ha canviat aquesta preparació. Exporta els camps pendents abans de recarregar.');const raw=JSON.stringify(value);storage.setItem(key,raw);return raw;}
 const api={create,parse,valid,apply,save,recommend};if(typeof module==='object'&&module.exports)module.exports=api;else root.QuelcomStartup=api;
})(typeof globalThis!=='undefined'?globalThis:this);
