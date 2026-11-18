/* Supabase owns PKCE, tokens and refresh. This adapter never grants project roles. */
(function(root){
 'use strict';
 const providers=['google','github','azure','apple'];
 function destination(value,known){return typeof value==='string' && value.length<=240 && /^[a-z0-9-]+(?:\/[a-z0-9-]+){0,3}$/.test(value) && !['login','espai','espai-demo'].includes(value) && Object.hasOwn(known,value) ? value : 'campus';}
 function create({config,sdk,storage,fetcher,origin,known}){
  let client,external={};
  const clientFor=()=>client||(client=sdk.createClient(config.url,config.publishableKey,{auth:{flowType:'pkce',detectSessionInUrl:false,persistSession:true,autoRefreshToken:true,storage,storageKey:'quelcom.auth.v1'}}));
  const target=()=>destination(storage.getItem('quelcom.auth.return'),known);
  function remember(route){storage.setItem('quelcom.auth.return',destination(route,known));}
  async function settings(){
   external={};
   const response=await fetcher(config.url+'/auth/v1/settings',{headers:{apikey:config.publishableKey},signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw Error('unavailable');
   external=(await response.json()).external||{};
   return Object.fromEntries([...providers,'email'].map(p=>[p,external[p]===true && config.redirectReady===true && (p!=='email'||config.emailReady===true)]));
  }
  const callback=()=>origin+'/auth-callback.html';
  async function oauth(provider){
   if(!providers.includes(provider)||!(await settings())[provider])throw Error('pending');
   const {error}=await clientFor().auth.signInWithOAuth({provider,options:{redirectTo:callback(),...(provider==='azure'?{scopes:'email'}:{})}});
   if(error)throw Error('unavailable');
  }
  async function email(address){
   if(!(await settings()).email)throw Error('pending');
   const {error}=await clientFor().auth.signInWithOtp({email:address,options:{emailRedirectTo:callback(),shouldCreateUser:false}});
   if(error)throw Error('unavailable');
  }
  async function user(){const {data,error}=await clientFor().auth.getUser();return !error&&data?.user?{email:data.user.email||'Compte verificat'}:null;}
  async function finish(code){
   if(typeof code!=='string'||!code||code.length>4096)throw Error('callback');
   const {error}=await clientFor().auth.exchangeCodeForSession(code);
   if(error||!await user())throw Error('callback');
   return target();
  }
  async function logout(){const {error}=await clientFor().auth.signOut({scope:'local'});if(error)throw Error('unavailable');}
  return {settings,remember,target,oauth,email,user,finish,logout};
 }
 root.QuelcomAuth={create,destination,providers};
 if(typeof module!=='undefined')module.exports=root.QuelcomAuth;
})(globalThis);
