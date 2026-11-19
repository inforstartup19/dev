(function(root){
 'use strict';
 const formats=root.CampusDocumentFormats||(typeof module!=='undefined'?require('./campus-document-formats.js'):null);
 const uuid=value=>{if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))throw Error('Identificador no vàlid.');return value;};
 function create({config,token,storage,fetcher=fetch}){
  async function request(path,{method='GET',body}={}){
   const access=await token();if(!access)throw Error('La sessió ha caducat. Torna a iniciar sessió.');
   let response;try{response=await fetcher(config.url+'/rest/v1/'+path,{method,headers:{apikey:config.publishableKey,Authorization:'Bearer '+access,'Content-Type':'application/json',Prefer:'return=representation'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});}catch{throw Error('No hem pogut confirmar el desament. Conservem el text; comprova la connexió abans de reintentar.');}
   if(!response.ok){let detail={};try{detail=await response.json();}catch{}
    if(response.status===401)throw Error('La sessió ha caducat. Torna a iniciar sessió.');
    if(response.status===403)throw Error('No tens accés a aquesta acció. Revisa la invitació i l’assignació docent.');
    if(detail.message?.includes('Teacher review required'))throw Error('Aquesta acció requereix el docent assignat.');
    if(detail.message?.includes('Reopen before editing'))throw Error('Cal demanar al docent que reobri la tasca abans d’editar-la.');
    throw Error('No s’han desat els canvis. Revisa els camps, els permisos i l’estat de la tasca.');
   }
   return response.status===204?null:response.json();
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
    if(data.error==='not_configured')throw Error('La IA de documents està pendent de configuració. Els adjunts continuen desats i disponibles.');
    if(response.status===429)throw Error('Has arribat al límit temporal d’anàlisis. Prova-ho més endavant.');
    if(response.status===409)throw Error('Ja hi ha una anàlisi en curs o la petició ha canviat. Actualitza els resultats abans de reintentar.');
    throw Error(typeof data.message==='string'?data.message:'No s’ha completat l’anàlisi. Conservem la pregunta; revisa el fitxer i reintenta.');
   }
   return data;
  }
  return {
   async documents(project){const {data,error}=await bucket().list(uuid(project),{limit:100,sortBy:{column:'created_at',order:'desc'}});if(error)throw Error('No hem pogut recuperar els documents.');return data.filter(x=>x.id);},
   async uploadDocument(project,file,id){
    if(!formats)throw Error('No hem pogut carregar el validador de documents. Recarrega la pàgina.');
    const {filename,mime}=await formats.validate(file);
    const path=filePath(project,uuid(id)+'--'+filename);
    const {error}=await bucket().upload(path,file,{contentType:mime,upsert:false});
    if(error){if(String(error.statusCode)!=='409')throw Error('No hem pogut confirmar la càrrega. Conserva el fitxer i reintenta amb la mateixa selecció.');const {data,error:readError}=await bucket().list(uuid(project),{search:uuid(id)+'--',limit:10});if(readError||!data.some(x=>x.name===path.split('/')[1]))throw Error('No hem pogut confirmar la versió del document.');}
    return path;
   },
   async downloadDocument(project,name){const {data,error}=await bucket().download(filePath(project,name));if(error)throw Error('No tens accés al document o la sessió ha caducat.');return data;},
   aiAvailability:()=>aiRequest(),
   documentReviews:project=>request('qc_document_reviews?project_id=eq.'+uuid(project)+'&select=*&order=created_at.desc&limit=30'),
   async analyzeDocument(project,storageName,requestId,question='',consent=false){
    filePath(project,storageName);uuid(requestId);
    if(consent!==true)throw Error('Cal autoritzar l’enviament d’aquest document a OpenAI per analitzar-lo.');
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
