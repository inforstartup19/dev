/* Real identity and local demonstrations are deliberately separate experiences. */
(()=>{
 const methods=[
  {id:'google',icon:'google',name:'Google',label:'Correu i serveis en línia'},
  {id:'github',icon:'github',name:'GitHub',label:'Compte de desenvolupament'},
  {id:'azure',icon:'microsoft',name:'Microsoft',label:'Correu i ofimàtica'},
  {id:'apple',icon:'apple',name:'Apple',label:'Serveis del dispositiu'}
 ];
 const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let auth,loading,checked=false,enabled={},account=null,busy=false,message='',previousRoute='campus',returnRoute='campus';
 const isLogin=()=>['login','espai'].includes(location.hash.slice(1));
 function update(){if(isLogin())render();}
 async function initialize(){
  try{
   auth=await QuelcomSession.ready(routes);
   // The per-tab return map contains route names only, never draft contents or roles.
   sessionStorage.setItem('quelcom.auth.routes',JSON.stringify(Object.fromEntries(Object.keys(routes).map(k=>[k,true]))));
   returnRoute='campus';auth.remember('campus');
   account=await auth.user(); enabled=await auth.settings();
  }catch{message='No podem comprovar la connexió. Recarrega la pàgina per tornar-ho a provar. Campus requereix una sessió verificada.';}
  checked=true;update();
 }
 function page(){
  const target=QuelcomAuth.destination(returnRoute,routes),label=escape(routes[target]?.[0]||'Campus');
  return `<section class="ql-page"><a class="ql-back" href="#entrada">Entrada a Quelcom</a><div class="ql-layout"><div class="ql-story"><span class="qc-eyebrow">QUELCOM · EL TEU ESPAI</span><h1>La teva idea.<br>El teu següent pas.</h1><p>Un lloc per investigar, construir i créixer amb altres persones.</p><div class="ql-trust"><span>01</span><p>Entra amb el compte que et sigui més còmode.</p><span>02</span><p>Recupera el punt del recorregut on eres.</p><span>03</span><p>Els projectes mantenen els seus permisos.</p></div><div class="ql-context"><small>CONTINUARÀS A</small><strong>${label}</strong><p>El pilot dona accés al Campus. Els teus treballs es desen a Quelcom. Els esborranys de la demo es conserven en aquest navegador.</p></div></div><div class="ql-panel"><span class="ql-status">${account?'IDENTITAT VERIFICADA':checked?(Object.values(enabled).some(Boolean)?'ACCÉS DISPONIBLE':'ACCÉS EN PREPARACIÓ'):'COMPROVANT LA CONNEXIÓ'}</span><h2>${account?'Ja tens sessió':'Entra a Quelcom'}</h2>${account?`<p class="ql-subtitle">${escape(account.email)}</p><a class="ql-demo" href="#${target}">Continua el recorregut</a><p class="ql-help">L’accés al pilot i el rol docent depenen de la invitació i de les assignacions confirmades.</p><button class="ql-secondary" id="ql-logout" ${busy?'disabled':''}>Tanca la sessió en aquest navegador</button>`:`<p class="ql-subtitle">Tria el compte amb què vols entrar. Et redirigirem al seu servei per iniciar la sessió.</p><div class="ql-methods">${methods.map(({id,icon,name,label})=>`<button type="button" data-ql-provider="${id}" ${!enabled[id]||busy?'disabled':''} aria-describedby="ql-unavailable"><span class="ql-icon ql-icon--${id}"><img src="assets/providers/${icon}.svg" width="22" height="22" alt="${name}" decoding="async"></span><span><strong>${label}</strong></span><span class="ql-pending">${enabled[id]?'Disponible':'En preparació'}</span></button>`).join('')}</div><form id="ql-email"><label for="ql-email-address">O continua amb correu electrònic${enabled.email?'<span class="required-mark" aria-hidden="true">*</span>':''}</label><div class="ql-email-row"><input id="ql-email-address" type="email" name="email" autocomplete="email" placeholder="tu@universitat.cat" required ${!enabled.email?'disabled':''}><button type="submit" ${!enabled.email||busy?'disabled':''}>Envia l’enllaç</button></div><small>Accés per invitació. L’enllaç s’ha d’obrir al mateix navegador.</small></form><p id="ql-unavailable" class="ql-help">${Object.values(enabled).some(Boolean)?'Pots triar qualsevol opció disponible.':'Estem preparant els accessos. Podràs entrar quan s’activi un dels mètodes.'} El compte universitari no concedeix automàticament accés a una universitat.</p>`}<p id="ql-feedback" role="status" aria-live="polite">${escape(message||'Inicia sessió per treballar al Campus amb TFG, TFM o TR.')}</p></div></div></section>`;
 }
 routes.login=['Accés a Quelcom',page];routes.espai=['Accés a Quelcom',page];routes['espai-demo']=['Demostració local',workspaceHome];
 const previous=render;
 render=function(){
  const key=location.hash.slice(1);
  if(isLogin()){
   try{returnRoute=QuelcomAuth.destination(sessionStorage.getItem('quelcom.auth.return')||previousRoute,routes);}catch{}
   previousRoute=key;
  }else previousRoute=QuelcomAuth.destination(key,routes);
  previous();document.body.classList.toggle('quelcom-login',isLogin());
  if(isLogin()){document.querySelectorAll('.dimension-guide').forEach(el=>el.remove());if(!loading)loading=initialize();}
 };
 async function act(action){if(busy||!auth)return;busy=true;message='Un moment…';update();try{await action();message='';}catch{message='No s’ha pogut completar l’accés. Torna-ho a provar o escull una altra opció disponible.';}finally{busy=false;update();}}
 document.addEventListener('click',event=>{
  const button=event.target.closest('[data-ql-provider],#ql-logout');if(!button||button.disabled)return;
  if(button.id==='ql-logout')act(async()=>{await auth.logout();account=null;QuelcomSession.clear();loading=null;});
  else act(()=>auth.oauth(button.dataset.qlProvider));
 });
 document.addEventListener('submit',event=>{if(event.target.id!=='ql-email')return;event.preventDefault();if(!enabled.email)return;const address=new FormData(event.target).get('email');act(async()=>{await auth.email(address);setTimeout(()=>{message='Si el compte té accés, rebràs un enllaç. Revisa el correu i obre’l en aquest navegador.';update();},0);});});
 render();
})();
