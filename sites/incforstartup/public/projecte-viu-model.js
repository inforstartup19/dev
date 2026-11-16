/* Pure local Projecte Viu transitions; no sharing/authentication side effects. */
(function(root){
 const decisions=['Continuar','Reformular','Demanar ajuda','Pausar','Tancar'];
 function text(value,max=3000){return String(value??'').trim().slice(0,max)}
 function create(data,id,at){const question=text(data.question);if(!question)throw Error('Escriu una pregunta o idea per començar.');return {id,title:text(data.title,120)||question.slice(0,80),description:question,domain:text(data.domain,100),stage:'Idea',team:'',history:[],live:{intention:text(data.intention),origin:text(data.origin,200),status:'En curs',active:null,experiments:[],decisions:[],needs:'',updatedAt:at,createdAt:at}}}
 function evolve(project,action,data,at){const p=JSON.parse(JSON.stringify(project));p.live={intention:'',origin:'',status:'En curs',active:null,experiments:[],decisions:[],needs:'',...p.live};const before={description:p.description,intention:p.live.intention,status:p.live.status,active:p.live.active,needs:p.live.needs};
 if(action==='idea'){const q=text(data.question);if(!q)throw Error('La pregunta no pot quedar buida.');p.description=q;p.title=text(data.title,120)||q.slice(0,80);p.live.intention=text(data.intention);p.live.origin=text(data.origin,200);}
 else if(action==='proof'){if(['Pausat','Tancat'].includes(p.live.status))throw Error('Reprèn el projecte abans de preparar una prova.');const task=text(data.task);if(!task)throw Error('Descriu la prova que vols fer.');p.live.active={task,criterion:text(data.criterion),createdAt:p.live.active?.createdAt||at};p.stage='Prova';}
 else if(action==='result'){if(!p.live.active)throw Error('Prepara una prova abans de registrar-ne el resultat.');if(['Pausat','Tancat'].includes(p.live.status))throw Error('Reprèn el projecte abans de registrar un resultat.');const result=text(data.result);if(!result)throw Error('Explica què has observat.');p.live.experiments.push({...p.live.active,result,evidence:text(data.evidence),completedAt:at});p.live.active=null;p.stage='Iteració';}
 else if(action==='decision'){if(!decisions.includes(data.decision))throw Error('Tria una decisió vàlida.');const reason=text(data.reason);if(!reason)throw Error('Explica per què prens aquesta decisió.');p.live.decisions.push({decision:data.decision,reason,at});p.live.status=data.decision==='Pausar'?'Pausat':data.decision==='Tancar'?'Tancat':'En curs';}
 else if(action==='needs'){p.live.needs=text(data.needs);}
 else throw Error('Acció no disponible.');
 p.live.updatedAt=at;p.history=Array.isArray(p.history)?p.history:[];p.history.push({at,stage:p.stage,title:p.title,description:p.description,action,before});return p;
 }
 const api={create,evolve,decisions};if(typeof module==='object'&&module.exports)module.exports=api;else root.QuelcomProject=api;
})(typeof window==='undefined'?globalThis:window);
