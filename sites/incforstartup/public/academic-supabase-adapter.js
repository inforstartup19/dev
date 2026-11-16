/* Prepared transport; intentionally not loaded by index.html until DEV RLS verification. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AcademicSupabase=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 function create({url,publishableKey,getAccessToken,fetchImpl=fetch}){
  const origin=new URL(url);if(origin.protocol!=='https:'||!origin.hostname.endsWith('.supabase.co')||origin.pathname!=='/')throw Error('Cal una URL HTTPS de projecte Supabase.');
  if(!publishableKey?.startsWith('sb_publishable_'))throw Error('Cal una clau publicable. No utilitzis una clau secreta.');
  async function request(path,options={}){const token=await getAccessToken();if(!token)throw Error('Inicia sessió abans de continuar.');const response=await fetchImpl(origin.origin+'/rest/v1/'+path,{...options,headers:{apikey:publishableKey,Authorization:'Bearer '+token,'Content-Type':'application/json',Prefer:'return=representation'}});if(!response.ok)throw Error(response.status===401?'La sessió ha caducat.':response.status===403?'No tens permís per fer aquesta acció.':'No s’han desat els canvis. Revisa la connexió o els criteris de la tasca.');return response.status===204?null:response.json();}
  function id(value){if(!/^[0-9a-f-]{36}$/i.test(value))throw Error('Identificador no vàlid.');return encodeURIComponent(value);}
  return {
   projects:()=>request('qc_projects?select=id,title,kind,owner_id&order=created_at.desc'),
   tasks:project=>request('qc_tasks?project_id=eq.'+id(project)+'&select=*&order=id'),
   dependencies:project=>request('qc_dependencies?project_id=eq.'+id(project)+'&select=*'),
   createTask:task=>request('qc_tasks',{method:'POST',body:JSON.stringify(task)}),
   async updateTask(project,task,revision,patch){if(!Number.isInteger(revision)||revision<0)throw Error('Revisió no vàlida.');const rows=await request('qc_tasks?id=eq.'+id(task)+'&project_id=eq.'+id(project)+'&revision=eq.'+revision,{method:'PATCH',body:JSON.stringify(patch)});if(rows.length!==1)throw Error('La tasca ha canviat o ja no hi tens accés. Recarrega abans de continuar.');return rows[0];}
  };
 }
 return {create};
});
