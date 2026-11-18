/* Local simulation only. Academic approval, continuity and mentor review are separate decisions. */
(function(root){
  const A=typeof module==='object'&&module.exports?require('./academic-workspace-model.js'):root.AcademicWorkspace;
  const S=typeof module==='object'&&module.exports?require('./startup-model.js'):root.QuelcomStartup;
  const C=typeof module==='object'&&module.exports?require('./startup-catalog.js'):root.QuelcomStartupCatalog;
  const clone=x=>JSON.parse(JSON.stringify(x));
  const text=(x,max=3000)=>{if(typeof x!=='string'||!x.trim()||x.length>max)throw Error('Completa els camps amb un text vàlid.');return x.trim();};
  function kind(k){if(!['TFG','TFM'].includes(k))throw Error('Tipus de treball desconegut.');return k;}
  const id=k=>'demo-befirst-'+kind(k).toLowerCase();
  const key=k=>'quelcom.befirst-journey.'+kind(k)+'.v1';
  function create(k){return {schema:1,kind:kind(k),projectId:id(k),revision:0,closures:[],academicReviews:[],agreements:[],withdrawn:false,packets:[],mentorReviews:[],decisions:[],history:[]};}
  function fields(value,names){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!names.includes(k)))throw Error('Camps no reconeguts.');for(const n of names)text(value[n]);return clone(value);}
  function date(v){if(typeof v!=='string'||!Number.isFinite(Date.parse(v)))throw Error('Data no vàlida.');}
  function valid(s,k){
    if(!s||s.schema!==1||s.kind!==kind(k)||s.projectId!==id(k)||!Number.isSafeInteger(s.revision)||s.revision<0||typeof s.withdrawn!=='boolean')throw Error('Recorregut no compatible. Conserva una còpia.');
    for(const n of ['closures','academicReviews','agreements','packets','mentorReviews','decisions','history'])if(!Array.isArray(s[n]))throw Error('Historial no compatible.');
    for(const [i,c] of s.closures.entries()){if(c.version!==i+1)throw Error('Versió acadèmica no vàlida.');fields(c.fields,['summary','limitations','defense']);text(c.sourceSignature,500000);date(c.at);}
    for(const r of s.academicReviews){if(!s.closures[r.version-1]||!['changes','accepted'].includes(r.decision))throw Error('Revisió acadèmica no vàlida.');text(r.comment);date(r.at);}
    for(const [i,a] of s.agreements.entries()){if(a.version!==i+1||!s.closures[a.closureVersion-1])throw Error('Acord no vàlid.');fields(a.fields,['team','materials','authorship','audience']);text(a.sourceSignature,500000);date(a.at);}
    for(const [i,p] of s.packets.entries()){if(p.version!==i+1||!s.agreements[p.agreementVersion-1]||!p.snapshot||p.snapshot.projectId!==s.projectId||!Number.isSafeInteger(p.startupRevision)||p.startupRevision<0||typeof p.includeGrowth!=='boolean'||typeof p.includeAcademic!=='boolean')throw Error('Paquet de prova no compatible.');text(p.request);text(p.sourceSignature,500000);text(p.snapshot.title);if(p.snapshot.kind!==s.kind)throw Error('Origen del paquet no vàlid.');fields(p.snapshot.summary,['summary','limitations','defense']);if(!C.financing.some(f=>f.id===p.snapshot.financing))throw Error('Recursos no vàlids.');if(!Array.isArray(p.snapshot.notes)||!Array.isArray(p.snapshot.academicTasks))throw Error('Materials no compatibles.');for(const t of p.snapshot.academicTasks){text(t.id,100);text(t.title,180);text(t.evidence);text(t.criteria);}for(const n of p.snapshot.notes){text(n.key,100);if(!C.tracks.some(t=>t.steps.some(step=>t.id+'/'+step.id===n.key))&&n.key!=='mentoria')throw Error('Material no permès.');fields(n.fields,['goal','action','evidence','question']);}date(p.at);}
    for(const r of s.mentorReviews){if(!s.packets[r.version-1]||!['revise','continue'].includes(r.decision))throw Error('Retorn de mentor no vàlid.');fields(r.fields,['strengths','changes','nextStep']);date(r.at);}
    for(const d of s.decisions){if(!s.mentorReviews[d.reviewIndex]||!['continue','reformulate','pause'].includes(d.decision))throw Error('Decisió no vàlida.');fields(d.fields,['action','criterion']);date(d.at);}
    for(const h of s.history){if(!['student','teacher','mentor'].includes(h.actor))throw Error('Rol no vàlid.');text(h.message);date(h.at);}
    return s;
  }
  function parse(raw,k){if(raw===null)return create(k);if(raw.length>4000000)throw Error('Recorregut massa gran. Exporta abans de recuperar-lo.');return valid(JSON.parse(raw),k);}
  function source(proposalRaw,boardRaw,k){
    kind(k);const missing=[];let proposal=null,board=null,record=null;
    if(proposalRaw!==null){const all=JSON.parse(proposalRaw);record=all?.[k];if(!record||!Array.isArray(record.versions)||!Array.isArray(record.reviews))throw Error('No podem llegir la proposta acadèmica.');for(const v of record.versions){for(const f of ['title','objective','method','milestone'])text(v[f]);date(v.at);}for(const r of record.reviews){if(!Number.isInteger(r.version)||r.version<1||r.version>record.versions.length||!['changes','accepted'].includes(r.decision))throw Error('Retorn docent no compatible.');text(r.comment);date(r.at);}proposal=record.versions.at(-1)||null;}
    if(!proposal)missing.push('Presenta una proposta acadèmica.');
    const review=record?.reviews.filter(r=>r.version===record.versions.length).at(-1);
    if(proposal&&review?.decision!=='accepted')missing.push('Cal el retorn favorable del docent sobre la darrera proposta.');
    if(proposal&&record.draft&&['title','objective','method','milestone'].some(f=>record.draft[f]!==proposal[f]))missing.push('Hi ha canvis de proposta pendents de presentar.');
    if(boardRaw!==null){board=A.valid(JSON.parse(boardRaw));if(board.kind!==k||board.tasks.length!==5||board.tasks.some((t,i)=>t.id!=='bf-'+(i+1)))throw Error('Tauler BeFirst no compatible.');}
    if(!board||board.tasks.some(t=>t.status!=='done'||!t.evidence?.trim()||!board.submissions.some(x=>x.taskId===t.id)))missing.push('Completa les cinc tasques amb evidència i validació docent.');
    return {kind:k,projectId:id(k),proposal,board,missing,ready:missing.length===0,signature:JSON.stringify({kind:k,proposal,review,board})};
  }
  function closureReady(s,src){const c=s.closures.at(-1),r=s.academicReviews.filter(r=>r.version===c?.version).at(-1);return !!(src.ready&&c&&c.sourceSignature===src.signature&&r?.decision==='accepted');}
  function agreementReady(s,src){const a=s.agreements.at(-1);return !!(closureReady(s,src)&&a&&!s.withdrawn&&a.sourceSignature===src.signature&&a.closureVersion===s.closures.at(-1).version);}
  function prepared(p,track){return C.tracks.find(t=>t.id===track).steps.every(step=>{const n=p.notes[track+'/'+step.id];return n&&['goal','action','evidence','question'].every(f=>typeof n[f]==='string'&&n[f].trim());});}
  function packetCurrent(s,src,p){const packet=s.packets.at(-1);return !!(packet&&agreementReady(s,src)&&packet.agreementVersion===s.agreements.at(-1).version&&packet.sourceSignature===src.signature&&packet.startupRevision===p.revision);}
  function apply(current,action,actor,src,preparation,at=new Date().toISOString()){
    valid(current,current.kind);if(!['student','teacher','mentor'].includes(actor))throw Error('Perfil desconegut.');if(src.kind!==current.kind||src.projectId!==current.projectId)throw Error('Origen incompatible.');
    const s=clone(current);date(at);let message='';const requireRole=r=>{if(actor!==r)throw Error('Aquesta acció correspon al perfil '+r+'.');};
    if(action.type==='closure'){
      requireRole('student');if(!src.ready)throw Error('Acaba la proposta i les cinc tasques abans de preparar la defensa.');
      s.closures.push({version:s.closures.length+1,fields:fields(action.fields,['summary','limitations','defense']),sourceSignature:src.signature,at});message='Síntesi i defensa de prova presentades';
    }else if(action.type==='academic-review'){
      requireRole('teacher');const c=s.closures.at(-1);if(!src.ready||!c||c.sourceSignature!==src.signature)throw Error('Presenta una síntesi actualitzada abans de revisar-la.');if(!['changes','accepted'].includes(action.decision))throw Error('Retorn no vàlid.');
      s.academicReviews.push({version:c.version,decision:action.decision,comment:text(action.comment),at});message='Retorn docent sobre la síntesi: '+action.decision;
    }else if(action.type==='agree'){
      requireRole('student');if(!closureReady(s,src))throw Error('Cal la revisió docent de la síntesi i defensa actualitzades.');if(action.confirmed!==true)throw Error('Confirma els materials i els rols de la simulació.');
      s.agreements.push({version:s.agreements.length+1,closureVersion:s.closures.at(-1).version,fields:fields(action.fields,['team','materials','authorship','audience']),sourceSignature:src.signature,at});s.withdrawn=false;message='Continuïtat voluntària confirmada a la demo';
    }else if(action.type==='withdraw'){
      requireRole('student');if(!s.agreements.length||s.withdrawn)throw Error('No hi ha cap continuïtat activa.');s.withdrawn=true;message='Continuïtat retirada; dades i historial conservats';
    }else if(action.type==='packet'){
      requireRole('student');if(!agreementReady(s,src))throw Error('Revisa la continuïtat i l’origen acadèmic abans de presentar materials.');S.valid(preparation,s.projectId);
      if(!prepared(preparation,'crea-i-creix'))throw Error('Prepara les cinc etapes de Crea i creix amb acció, evidència i pregunta.');if(action.confirmed!==true)throw Error('Confirma la selecció de materials de prova.');if(action.includeGrowth&&!prepared(preparation,'enlaira'))throw Error('Completa la preparació de les cinc etapes d’Enlaira o exclou-les del paquet.');
      const notes=Object.entries(preparation.notes).filter(([k])=>k.startsWith('crea-i-creix/')||(action.includeGrowth&&k.startsWith('enlaira/'))).map(([key,n])=>({key,fields:{goal:n.goal,action:n.action,evidence:n.evidence,question:n.question}}));
      const closure=s.closures.at(-1);s.packets.push({version:s.packets.length+1,agreementVersion:s.agreements.at(-1).version,sourceSignature:src.signature,startupRevision:preparation.revision,includeGrowth:action.includeGrowth===true,includeAcademic:action.includeAcademic===true,request:text(action.request),snapshot:{projectId:s.projectId,kind:s.kind,title:src.proposal.title,summary:clone(closure.fields),notes,financing:preparation.financing,academicTasks:action.includeAcademic?src.board.tasks.map(t=>({id:t.id,title:t.title,evidence:t.evidence,criteria:t.criteria})):[]},at});message='Paquet de mentorització de prova presentat, versió '+s.packets.length;
    }else if(action.type==='mentor-review'){
      requireRole('mentor');S.valid(preparation,s.projectId);if(!packetCurrent(s,src,preparation))throw Error('Aquest paquet ha quedat desactualitzat o la continuïtat s’ha retirat. Cal una nova presentació.');if(!['revise','continue'].includes(action.decision))throw Error('Retorn no vàlid.');
      s.mentorReviews.push({version:s.packets.at(-1).version,decision:action.decision,fields:fields(action.fields,['strengths','changes','nextStep']),at});message='Retorn del mentor de prova: '+action.decision;
    }else if(action.type==='decision'){
      requireRole('student');S.valid(preparation,s.projectId);const r=s.mentorReviews.at(-1);if(!packetCurrent(s,src,preparation)||!r||r.version!==s.packets.at(-1).version)throw Error('Cal un retorn sobre el paquet actual.');if(!['continue','reformulate','pause'].includes(action.decision))throw Error('Decisió no vàlida.');if(r.decision==='revise'&&action.decision==='continue')throw Error('El mentor ha demanat canvis. Reformula i presenta una nova versió abans de continuar.');
      s.decisions.push({reviewIndex:s.mentorReviews.length-1,decision:action.decision,fields:fields(action.fields,['action','criterion']),at});message='Decisió de continuïtat: '+action.decision;
    }else throw Error('Acció no disponible.');
    s.revision++;s.history.push({actor,at,message});return valid(s,s.kind);
  }
  function save(storage,k,s,expected){valid(s,s.kind);if(storage.getItem(k)!==expected)throw Error('Una altra pestanya ha canviat el recorregut. Exporta els camps pendents abans de recarregar.');const raw=JSON.stringify(s);if(raw.length>4000000)throw Error('El recorregut supera el límit local. Exporta una còpia.');storage.setItem(k,raw);return raw;}
  const api={id,key,create,valid,parse,source,closureReady,agreementReady,prepared,packetCurrent,apply,save};if(typeof module==='object'&&module.exports)module.exports=api;else root.BFJourney=api;
})(typeof globalThis!=='undefined'?globalThis:this);
