(function(root){
 'use strict';
 const formats=root.CampusDocumentFormats||(typeof module!=='undefined'?require('./campus-document-formats.js'):null);
 const resumable=root.CampusResumableUpload||(typeof module!=='undefined'?require('./campus-resumable-upload.js'):null);
 const uuid=value=>{if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))throw Error('Identificador no vàlid.');return value;};
 function create({config,token,storage,userId,fetcher=fetch}){
  let resumableClient;
  async function request(path,{method='GET',body}={}){
   const access=await token();
   if(!access){const error=new Error('La sessió ha caducat. Torna a iniciar sessió.');error.code='denied';throw error;}
   let response;try{response=await fetcher(config.url+'/rest/v1/'+path,{method,headers:{apikey:config.publishableKey,Authorization:'Bearer '+access,'Content-Type':'application/json',Prefer:'return=representation'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});}catch{throw Error('No hem pogut confirmar el desament. Conservem el text; comprova la connexió abans de reintentar.');}
   if(!response.ok){let detail={};try{detail=await response.json();}catch{}
    if(path==='rpc/qc_defense_get'||path==='rpc/qc_defense_save'){
     const denied=[401,403].includes(response.status)||detail.code==='42501';
     const conflict=detail.code==='40001';
     const message=denied?'No tens accés a l’assaig amb aquest compte.':
      conflict?'L’assaig ha canviat. Recupera la versió desada abans de continuar.':
      detail.code==='22023'?'Revisa els camps, el fitxer i l’estat de l’assaig.':
      path.endsWith('_get')?'No hem pogut recuperar l’assaig. Torna-ho a provar.':'No hem pogut confirmar el desament. Actualitza l’assaig abans de reintentar.';
     const error=new Error(message);
     error.code=denied?'denied':conflict?'conflict':detail.code==='22023'?'invalid':'unknown';
     throw error;
    }
    if(response.status===401)throw Error('La sessió ha caducat. Torna a iniciar sessió.');
    if(response.status===403)throw Error('No tens accés a aquesta acció. Revisa la invitació i l’assignació docent.');
    if(detail.code==='40001')throw Error('La fitxa ha canviat. Recupera la darrera versió, revisa la proposta i torna-la a confirmar.');
    if(detail.message?.includes('Teacher review required'))throw Error('Aquesta acció requereix el docent assignat.');
    if(detail.message?.includes('Reopen before editing'))throw Error('Cal demanar al docent que reobri la tasca abans d’editar-la.');
    throw Error('No s’han desat els canvis. Revisa els camps, els permisos i l’estat de la tasca.');
   }
   return response.status===204?null:response.json();
  }
  function defenseRecord(project,row,allowEmpty=false){
   if(allowEmpty&&row===null)return null;
   if(!row||row.project_id!==project||!Number.isInteger(row.revision)||row.revision<1||
    !['draft','submitted','changes_requested','rehearsed'].includes(row.status)){
    throw Error('No hem pogut confirmar la versió de l’assaig. Recupera-la abans de continuar.');
   }
   return row;
  }
  async function patch(table,id,revision,fields){if(!Number.isInteger(revision)||revision<0)throw Error('Versió no vàlida.');const rows=await request(table+'?id=eq.'+uuid(id)+'&revision=eq.'+revision,{method:'PATCH',body:fields});if(rows.length!==1)throw Error('Hi ha una versió més recent o l’accés ha canviat. El text es conserva; exporta’l abans de recarregar.');return rows[0];}
  async function insert(table,row){const existing=await request(table+'?id=eq.'+uuid(row.id)+'&select=*');if(existing.length){if(Object.entries(row).some(([key,value])=>JSON.stringify(existing[0][key])!==JSON.stringify(value)))throw Error('El registre ja es va crear amb un altre contingut. Conservem el text; exporta’l abans de recuperar la versió desada.');return existing[0];}const rows=await request(table,{method:'POST',body:row});return rows[0];}
  const bucket=()=>storage.from('qc-campus-documents');
  const filePath=(project,name)=>{uuid(project);if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}--[A-Za-z0-9_.-]+\.(pdf|doc|docx|xls|xlsx|ppt|pptx)$/.test(name))throw Error('Document no vàlid.');return project+'/'+name;};
  async function aiRequest(body){
   const access=await token();if(!access)throw Error('La sessió ha caducat. Torna a iniciar sessió.');
   let response;try{response=await fetcher(config.url+'/functions/v1/campus-document-review',{method:body?'POST':'GET',headers:{apikey:config.publishableKey,Authorization:'Bearer '+access,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(body?115000:15000)});}catch{throw Error('No hem pogut confirmar l’anàlisi. Conservem la pregunta. Actualitza els resultats abans de reintentar.');}
   let data={};try{data=await response.json();}catch{}
   if(!response.ok){
    if(response.status===401)throw Error('La sessió ha caducat. Torna a iniciar sessió.');
    if(response.status===403)throw Error('No tens accés a l’anàlisi d’aquest treball.');
    if(data.error==='not_configured')throw Error('La revisió assistida està pendent de configuració. Els adjunts continuen desats i disponibles.');
    if(response.status===429)throw Error('Has arribat al límit temporal d’anàlisis. Prova-ho més endavant.');
    if(response.status===409)throw Error('Ja hi ha una anàlisi en curs o la petició ha canviat. Actualitza els resultats abans de reintentar.');
    if(data.error==='ai_file_too_large')throw Error('La revisió assistida admet documents de fins a 10 MB. Adjunta un extracte o una versió reduïda.');
    if(data.error==='invalid_request')throw Error('Revisa el document, la pregunta i el consentiment d’anàlisi.');
    if(data.error==='provider_failed')throw Error('El servei de revisió no ha pogut completar l’anàlisi. El document continua desat. Torna-ho a provar més endavant.');
    if(data.error==='invalid_document')throw Error('No s’ha pogut llegir el document. Comprova el format o prova una versió en PDF.');
    if(data.error==='invalid_analysis')throw Error('No s’ha pogut validar el resultat de l’anàlisi. El document continua desat.');
    if(response.status===503)throw Error('El servei no respon. Conservem la pregunta. Actualitza els resultats abans de reintentar.');
    throw Error('No s’ha completat l’anàlisi. Conservem la pregunta. Revisa el fitxer i torna-ho a provar.');
   }
   return data;
  }
  return {
   async documents(project){const {data,error}=await bucket().list(uuid(project),{limit:100,sortBy:{column:'created_at',order:'desc'}});if(error)throw Error('No hem pogut recuperar els documents.');return data.filter(x=>x.id);},
   async uploadDocument(project,file,id,onProgress=()=>{}){
    if(!formats)throw Error('No hem pogut carregar el validador de documents. Recarrega la pàgina.');
    const {filename,mime}=await formats.validate(file);
    const path=filePath(project,uuid(id)+'--'+filename);
    let error;
    if(file.size>6*1024*1024){
     if(!resumable)throw Error('No hem pogut carregar el servei de càrrega recuperable. Recarrega la pàgina.');
     resumableClient??=resumable.create({config,token,userId,fetcher});
     try{await resumableClient.upload({file,path,mime,onProgress});}catch(err){error=err;}
    }else{
     onProgress({loaded:0,total:file.size,percent:0});
     ({error}=await bucket().upload(path,file,{contentType:mime,upsert:false}));
    }
    if(error){
     if(!['400','409'].includes(String(error.statusCode))){
      if(resumable?.isUploadError?.(error))throw error;
      throw Error('No hem pogut confirmar la càrrega. Conserva el fitxer i reintenta amb la mateixa selecció.');
     }
     const {data,error:readError}=await bucket().list(uuid(project),{search:uuid(id)+'--',limit:10});
     if(readError||!data?.some(x=>x.name===path.split('/')[1]&&Number(x.metadata?.size)===file.size&&x.metadata?.mimetype===mime))throw Error('No hem pogut confirmar la versió del document. Conserva la selecció i comprova els documents desats.');
    }
    onProgress({loaded:file.size,total:file.size,percent:100});
    return path;
   },
   async downloadDocument(project,name){const {data,error}=await bucket().download(filePath(project,name));if(error)throw Error('No tens accés al document o la sessió ha caducat.');return data;},
   aiAvailability:()=>aiRequest(),
   documentReviews:project=>request('qc_document_reviews?project_id=eq.'+uuid(project)+'&select=*&order=created_at.desc&limit=30'),
   async analyzeDocument(project,storageName,requestId,question='',consent=false){
    filePath(project,storageName);uuid(requestId);
    if(consent!==true)throw Error('Cal autoritzar l’enviament d’aquest document al proveïdor extern per analitzar-lo.');
    if(typeof question!=='string'||question.length>2000)throw Error('La pregunta ha de tenir com a màxim 2.000 caràcters.');
    const data=await aiRequest({projectId:project,storageName,requestId,question,consent:true});
    if(!data.review||!['processing','completed','failed'].includes(data.review.status))throw Error('No hem pogut confirmar el resultat. Actualitza l’historial abans de reintentar.');
    return data.review;
   },
   enroll:()=>request('rpc/qc_accept_pilot',{method:'POST',body:{}}),
   projects:()=>request('qc_projects?select=*&order=updated_at.desc&limit=100'),
   project:async id=>(await request('qc_projects?id=eq.'+uuid(id)+'&select=*'))[0],
   createProject:row=>insert('qc_projects',row),
   saveProject:(id,revision,row)=>patch('qc_projects',id,revision,row),
   async confirmOrientation(id,route,firstStep,revision){
    const saved=await request('rpc/qc_confirm_orientation',{method:'POST',body:{
     p_project_id:uuid(id),p_route:route,p_first_step:firstStep,p_expected_revision:revision
    }});
    if(saved?.id!==id||saved.orientation_route!==route||!saved.orientation_task_id)throw Error('No hem pogut confirmar l’orientació. Recupera la darrera versió abans de tornar-ho a provar.');
    return saved;
   },
   async defense(project){
    const row=await request('rpc/qc_defense_get',{method:'POST',body:{p_project_id:uuid(project)}});
    return defenseRecord(project,row,true);
   },
   async saveDefense(project,revision,action,fields){
    if(!Number.isInteger(revision)||revision<0||!['save','submit','return','validate'].includes(action))throw Error('Versió o acció de l’assaig no vàlida.');
    const teacher=action==='return'||action==='validate';
    const body={p_project_id:uuid(project),p_revision:revision,p_action:action,
     p_outline:teacher?null:fields.outline,p_questions:teacher?null:fields.questions,
     p_attachment:teacher?null:fields.attachment||null,p_talk_minutes:teacher?null:fields.talk_minutes,
     p_question_minutes:teacher?null:fields.question_minutes,p_feedback:teacher?fields.feedback:null};
    const row=await request('rpc/qc_defense_save',{method:'POST',body});
    return defenseRecord(project,row);
   },
   tasks:id=>request('qc_tasks?project_id=eq.'+uuid(id)+'&select=*&order=id'),
   createTask:row=>insert('qc_tasks',row),saveTask:(id,revision,row)=>patch('qc_tasks',id,revision,row),
   history:id=>request('qc_task_events?project_id=eq.'+uuid(id)+'&select=*&order=id.desc&limit=50'),
   projectHistory:id=>request('qc_project_events?project_id=eq.'+uuid(id)+'&select=*&order=id.desc&limit=30'),
   proposals:id=>request('qc_learning_proposals?project_id=eq.'+uuid(id)+'&select=*&order=created_at.desc'),
   propose:row=>insert('qc_learning_proposals',row),review:(id,revision,row)=>patch('qc_learning_proposals',id,revision,row),
   library:()=>request('rpc/qc_library_feed',{method:'POST',body:{}})
  };
 }
 root.CampusPilotAPI={create,uuid};if(typeof module!=='undefined')module.exports=root.CampusPilotAPI;
})(globalThis);
