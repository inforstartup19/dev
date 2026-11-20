/* UI gate only. Project data authorization belongs to Supabase RLS. */
(function(root){
 'use strict';
 const names=new Set(['inici','campus','campus-demo','espai-demo','coworking','sala-materials','biblioteca','biblioteca-projecte','universitats','circuit-pilot','demo-tfg','demo-tfm','treball-tfg','treball-tfm','campus-biblioteca','campus-universitat']);
 function protectedRoute(route,known){return names.has(route)||/^(campus-treball|uni-|recurs-|befirst-tfg|befirst-tfm)/.test(route)||(!!route&&!Object.hasOwn(known,route));}
 root.CampusAccess={protectedRoute};
 if(typeof module!=='undefined'){module.exports=root.CampusAccess;return;}
 let adapter,pending,identity=null,verified=false;
 function sdk(){return new Promise((resolve,reject)=>{if(root.supabase)return resolve(root.supabase);const script=document.createElement('script');script.src='vendor/supabase-2.119.0.js';script.onload=()=>resolve(root.supabase);script.onerror=reject;document.head.append(script);});}
 async function ready(known){
  if(!pending)pending=(async()=>{
   const lib=await sdk();
   adapter=QuelcomAuth.create({config:QuelcomAuthConfig,sdk:lib,storage:sessionStorage,fetcher:fetch,origin:location.origin,known});
   identity=await adapter.user();verified=true;return adapter;
  })().catch(error=>{pending=null;identity=null;verified=false;throw error;});
  return pending;
 }
 function remember(route,known){sessionStorage.setItem('quelcom.auth.return',QuelcomAuth.destination(route,known));sessionStorage.setItem('quelcom.auth.routes',JSON.stringify(Object.fromEntries(Object.keys(known).map(k=>[k,true]))));}
 function redirect(){location.replace('#login');}
 root.QuelcomSession={ready,clear(){identity=null;verified=false;pending=null;document.dispatchEvent(new Event("quelcom-account-change"));},async refresh(){if(!adapter)return;const previous=identity;try{identity=await adapter.user();}catch{identity=null;}finally{verified=true;if(Boolean(previous)!==Boolean(identity)||previous?.id!==identity?.id){document.dispatchEvent(new Event("quelcom-account-change"));render();}}}};
 root.CampusAccess.allow=function(route,known){
  if(!protectedRoute(route,known))return true;
  if(verified&&identity)return true;
  document.querySelector('#view').innerHTML='<section class="ql-page"><p role="status">Comprovant l’accés a Campus…</p></section>';
  try{remember(route,known);}catch{redirect();return false;}
  if(verified){redirect();return false;}
  ready(known).then(()=>{if(!protectedRoute(location.hash.slice(1),known))return;if(identity)render();else redirect();}).catch(()=>{if(protectedRoute(location.hash.slice(1),known))redirect();});
  return false;
 };
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&adapter)root.QuelcomSession.refresh().catch(()=>{});});
})(globalThis);
