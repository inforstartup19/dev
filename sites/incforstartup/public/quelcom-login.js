/* Real identity and local demonstrations are deliberately separate experiences. */
(()=>{
 const methods=[['google','G','Google'],['github','GH','GitHub'],['azure','M','Microsoft'],['apple','A','Apple']];
 const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let auth,loading,checked=false,enabled={},account=null,busy=false,message='',previousRoute='campus',returnRoute='campus';
 const isLogin=()=>['login','espai'].includes(location.hash.slice(1));
 function sdk(){return new Promise((resolve,reject)=>{if(globalThis.supabase)return resolve(globalThis.supabase);const script=document.createElement('script');script.src='vendor/supabase-2.119.0.js';script.onload=()=>resolve(globalThis.supabase);script.onerror=reject;document.head.append(script);});}
 function update(){if(isLogin())render();}
 async function initialize(){
  try{
   const lib=await sdk();
   auth=QuelcomAuth.create({config:QuelcomAuthConfig,sdk:lib,storage:sessionStorage,fetcher:fetch,origin:location.origin,known:routes});
   // The per-tab return map contains route names only, never draft contents or roles.
   sessionStorage.setItem('quelcom.auth.routes',JSON.stringify(Object.fromEntries(Object.keys(routes).map(k=>[k,true]))));
   if(returnRoute!=='campus')auth.remember(returnRoute);else returnRoute=auth.target();
   enabled=await auth.settings(); account=await auth.user();
  }catch{message='No podem comprovar la connexió. Pots continuar amb la demostració local.';}
  checked=true;update();
 }
 function page(){
  const target=QuelcomAuth.destination(returnRoute,routes),label=escape(routes[target]?.[0]||'Campus');
  return `<section class="ql-page"><a class="ql-back" href="#${target}">Torna a ${label}</a><div class="ql-layout"><div class="ql-story"><span class="qc-eyebrow">QUELCOM · EL TEU ESPAI</span><h1>La teva idea.<br>El teu següent pas.</h1><p>Un lloc per investigar, construir i créixer amb altres persones.</p><div class="ql-trust"><span>01</span><p>Entra amb el compte que et sigui més còmode.</p><span>02</span><p>Recupera el punt del recorregut on eres.</p><span>03</span><p>Els projectes mantenen els seus permisos.</p></div><div class="ql-context"><small>CONTINUARÀS A</small><strong>${label}</strong><p>Els esborranys de la demo continuen en aquest navegador. Iniciar sessió no els sincronitza.</p></div></div><div class="ql-panel"><span class="ql-status">${account?'IDENTITAT VERIFICADA':checked?(Object.values(enabled).some(Boolean)?'ACCÉS DISPONIBLE':'ACCÉS EN PREPARACIÓ'):'COMPROVANT LA CONNEXIÓ'}</span><h2>${account?'Ja tens sessió':'Entra a Quelcom'}</h2>${account?`<p class="ql-subtitle">${escape(account.email)}</p><a class="ql-demo" href="#${target}">Continua el recorregut</a><p class="ql-help">La sessió identifica el teu compte. La demostració continua sent local; no atorga permisos de docent ni de projecte.</p><button class="ql-secondary" id="ql-logout" ${busy?'disabled':''}>Tanca la sessió en aquest navegador</button>`:`<p class="ql-subtitle">Tria el teu accés. Aquí no et demanarem la contrasenya del proveïdor.</p><div class="ql-methods">${methods.map(([id,icon,name])=>`<button type="button" data-ql-provider="${id}" ${!enabled[id]||busy?'disabled':''} aria-describedby="ql-unavailable"><span class="ql-icon">${icon}</span><span><strong>Continua amb ${name}</strong><small>${id==='azure'?'Personal o institucional, segons configuració':id==='apple'?'Compatible amb l’adreça privada d’Apple':'El teu compte '+name}</small></span><span class="ql-pending">${enabled[id]?'Disponible':'En preparació'}</span></button>`).join('')}</div><form id="ql-email"><label for="ql-email-address">O continua amb correu electrònic</label><div class="ql-email-row"><input id="ql-email-address" type="email" name="email" autocomplete="email" placeholder="tu@universitat.cat" required ${!enabled.email?'disabled':''}><button type="submit" ${!enabled.email||busy?'disabled':''}>Envia l’enllaç</button></div><small>Accés per invitació. L’enllaç s’ha d’obrir al mateix navegador.</small></form><p id="ql-unavailable" class="ql-help">${Object.values(enabled).some(Boolean)?'Els mètodes disponibles estan connectats a Supabase.':'Estem preparant els accessos. Els botons s’activaran quan la configuració de cada proveïdor estigui verificada.'} El compte universitari no concedeix automàticament accés a una universitat.</p>`}<p id="ql-feedback" role="status" aria-live="polite">${escape(message||'Pots provar el recorregut sense iniciar sessió.')}</p><div class="ql-demo-path"><span>MENTRESTANT, EXPLORA LA DEMO</span><a class="ql-demo" href="#${target}">Reprèn el teu recorregut</a><div class="ql-demo-grid"><a href="#befirst-tfg-recorregut">Demo TFG</a><a href="#befirst-tfm-recorregut">Demo TFM</a></div><small>Estudiant, docent i mentoria · dades simulades</small></div></div></div></section>`;
 }
 routes.login=['Accés a Quelcom',page];routes.espai=['Accés a Quelcom',page];routes['espai-demo']=['Demostració local',workspaceHome];
 const previous=render;
 render=function(){
  const key=location.hash.slice(1);
  if(isLogin()){
   if(previousRoute!=='login'&&previousRoute!=='espai'){returnRoute=QuelcomAuth.destination(previousRoute,routes);try{auth?.remember(returnRoute);}catch{}}
   previousRoute=key;
  }else previousRoute=QuelcomAuth.destination(key,routes);
  previous();document.body.classList.toggle('quelcom-login',isLogin());
  if(isLogin()){document.querySelectorAll('.dimension-guide').forEach(el=>el.remove());if(!loading)loading=initialize();}
 };
 async function act(action){if(busy||!auth)return;busy=true;message='Un moment…';update();try{await action();message='';}catch{message='No s’ha pogut completar l’accés. Torna-ho a provar o escull una altra opció disponible.';}finally{busy=false;update();}}
 document.addEventListener('click',event=>{
  const button=event.target.closest('[data-ql-provider],#ql-logout');if(!button||button.disabled)return;
  if(button.id==='ql-logout')act(async()=>{await auth.logout();account=null;});
  else act(()=>auth.oauth(button.dataset.qlProvider));
 });
 document.addEventListener('submit',event=>{if(event.target.id!=='ql-email')return;event.preventDefault();if(!enabled.email)return;const address=new FormData(event.target).get('email');act(async()=>{await auth.email(address);setTimeout(()=>{message='Si el compte té accés, rebràs un enllaç. Revisa el correu i obre’l en aquest navegador.';update();},0);});});
 render();
})();
