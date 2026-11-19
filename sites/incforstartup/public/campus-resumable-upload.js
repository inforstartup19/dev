(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CampusResumableUpload=api;})(globalThis,function(){
 'use strict';
 const chunkSize=6*1024*1024,maxFileSize=50*1024*1024;
 const error=(code,message,status)=>Object.assign(new Error(message),{code,...(status?{statusCode:String(status)}:{})});
 const metadata=value=>btoa(String.fromCharCode(...new TextEncoder().encode(value)));
 function create({config,token,userId,fetcher=fetch,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))}){
  const match=/^https:\/\/([a-z0-9-]+)\.supabase\.co\/?$/.exec(config.url||'');
  if(!match)throw error('CONFIG','No hem pogut configurar la càrrega recuperable.');
  const endpoint='https://'+match[1]+'.storage.supabase.co/storage/v1/upload/resumable',base=new URL(endpoint),states=new WeakMap();
  async function headers(){
   const access=await token();if(!access)throw error('SESSION','La sessió ha caducat. Torna a iniciar sessió.');
   let subject;try{const payload=access.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');subject=JSON.parse(atob(payload)).sub;}catch{}
   // This is only an account-change guard, never authorization. Storage validates
   // the JWT and RLS on every request. userId came from the verified Auth user.
   if(!userId||subject!==userId)throw error('SESSION_CHANGED','El compte ha canviat. Torna a seleccionar el document des de la sessió correcta.');
   return {Authorization:'Bearer '+access,apikey:config.publishableKey,'Tus-Resumable':'1.0.0'};
  }
  async function request(url,method,extra={},body){
   const auth=await headers();let response;
   try{response=await fetcher(url,{method,headers:{...auth,...extra},...(body!==undefined?{body}:{}),redirect:'error',signal:AbortSignal.timeout(90000)});}catch{throw error('NETWORK','La càrrega s’ha interromput. Mantén la pàgina oberta i reintenta amb la mateixa selecció per reprendre-la.');}
   if(response.status===401||response.status===403)throw error('SESSION','La sessió ha caducat o l’accés al treball ha canviat. Torna a comprovar l’accés.',response.status);
   return response;
  }
  function uploadUrl(location){
   let url;try{url=new URL(location,endpoint+'/');}catch{throw error('INVALID_LOCATION','El servidor no ha retornat una adreça de càrrega vàlida.');}
   if(!location||url.origin!==base.origin||!url.pathname.startsWith(base.pathname+'/')||url.username||url.password||url.hash)throw error('INVALID_LOCATION','El servidor no ha retornat una adreça de càrrega segura.');
   return url.href;
  }
  function offsetOf(response,size){
   const raw=response.headers.get('Upload-Offset');
   if(!/^\d+$/.test(raw||''))throw error('INVALID_OFFSET','No hem pogut confirmar el progrés de la càrrega.');
   const offset=Number(raw);
   if(!Number.isSafeInteger(offset)||offset<0||offset>size)throw error('INVALID_OFFSET','El servidor ha retornat un progrés de càrrega no vàlid.');
   return offset;
  }
  async function inspect(state,file){
   const response=await request(state.url,'HEAD');
   if(response.status===404||response.status===410)throw error('UPLOAD_EXPIRED','La càrrega pendent ha caducat. Reintenta per començar una versió nova.');
   if(!response.ok)throw error('HEAD_FAILED','No hem pogut recuperar la càrrega pendent. Mantén la selecció i torna-ho a provar.',response.status);
   if(response.headers.get('Upload-Length')!==String(file.size))throw error('INVALID_LENGTH','La càrrega pendent no correspon a aquest document.');
   return offsetOf(response,file.size);
  }
  async function upload({file,path,mime,onProgress=()=>{}}){
   if(!file||!Number.isSafeInteger(file.size)||file.size<1||file.size>maxFileSize||typeof file.slice!=='function')throw error('FILE_SIZE','Selecciona un document de com a màxim 50 MB.');
   if(!/^[0-9a-f-]{36}\/[0-9a-f-]{36}--[A-Za-z0-9_.-]+\.(pdf|docx?|xlsx?|pptx?)$/.test(path))throw error('PATH','Document no vàlid.');
   let state=states.get(file);
   if(state&&state.path!==path)throw error('FILE_SCOPE','Aquesta selecció ja està vinculada a un altre treball. Torna a seleccionar el document.');
   if(state?.busy)throw error('UPLOAD_BUSY','Aquest document ja s’està carregant.');
   if(!state){state={path,url:null,busy:false};states.set(file,state);}state.busy=true;
   const progress=loaded=>{try{onProgress({loaded,total:file.size,percent:Math.floor(loaded/file.size*100)});}catch{/* UI callback cannot interrupt the protocol. */}};
   try{
    if(!state.url){
     const response=await request(endpoint,'POST',{'Upload-Length':String(file.size),'Upload-Metadata':Object.entries({bucketName:'qc-campus-documents',objectName:path,contentType:mime,cacheControl:'3600'}).map(([key,value])=>key+' '+metadata(value)).join(',')});
     if(response.status!==201)throw error('CREATE_FAILED','No hem pogut iniciar la càrrega. Conserva la selecció i torna-ho a provar.',response.status);
     state.url=uploadUrl(response.headers.get('Location'));
    }
    let offset=await inspect(state,file);progress(offset);
    while(offset<file.size){
     const end=Math.min(offset+chunkSize,file.size);let attempts=0;
     for(;;){
      let response,problem;
      try{response=await request(state.url,'PATCH',{'Content-Type':'application/offset+octet-stream','Upload-Offset':String(offset)},file.slice(offset,end));}
      catch(err){if(err.code!=='NETWORK')throw err;problem=err;}
      if(response?.status===204){const confirmed=offsetOf(response,file.size);if(confirmed!==end)throw error('INVALID_OFFSET','No hem pogut confirmar el fragment enviat.');offset=confirmed;progress(offset);break;}
      if(response&&![408,409,423,429,500,502,503,504].includes(response.status))throw error('PATCH_FAILED','No hem pogut completar la càrrega. Conserva el fitxer i comprova els permisos.',response.status);
      if(attempts++>=2)throw problem||error('RETRY_LATER','La càrrega s’ha interromput. Mantén la pàgina oberta i reintenta amb la mateixa selecció per reprendre-la.',response?.status);
      await wait(attempts*500);
      // A timed-out PATCH may already be committed. HEAD is mandatory before
      // retrying, so acknowledged chunks are not duplicated or overwritten.
      const confirmed=await inspect(state,file);
      if(confirmed<offset||confirmed>end)throw error('INVALID_OFFSET','El progrés ha canviat de manera inesperada. No hem continuat la càrrega.');
      if(confirmed>offset){offset=confirmed;progress(offset);break;}
     }
    }
    states.delete(file);return path;
   }catch(err){if(['SESSION_CHANGED','UPLOAD_EXPIRED','INVALID_OFFSET','INVALID_LENGTH','INVALID_LOCATION'].includes(err.code))states.delete(file);throw err;}
   finally{state.busy=false;}
  }
  return {upload};
 }
 return Object.freeze({create,chunkSize,maxFileSize});
});
