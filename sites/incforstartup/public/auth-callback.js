(async()=>{
 const params=new URLSearchParams(location.search),code=params.get('code');
 // Remove sensitive/third-party callback values from history before any UI rendering.
 history.replaceState(null,'',location.pathname);
 try{
  if(params.has('error')||!code)throw Error('callback');
  const known=JSON.parse(sessionStorage.getItem('quelcom.auth.routes')||'{}');
  const auth=QuelcomAuth.create({config:QuelcomAuthConfig,sdk:supabase,storage:sessionStorage,fetcher:fetch,origin:location.origin,known});
  const route=await auth.finish(code);
  location.replace('./#'+route);
 }catch{
  document.getElementById('auth-status').textContent='No hem pogut completar l’entrada. Torna-ho a provar des del mateix navegador. Els teus esborranys locals es conserven.';
 }
})();
