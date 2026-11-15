/* Animated entrance: no first-visit flag. Every root/#entrada visit shows it. */
(()=>{
 const previousRender=render;
 document.querySelector('aside .brand').href='#entrada';
 let dispose=()=>{};
 const words=['IDEES','CIÈNCIA','ART I CULTURA','PERSONES','UNIVERSITATS','TECNOLOGIA','PROJECTES','NOVES POSSIBILITATS'];
 function entrance(){return `<section class="space-scene" aria-labelledby="space-title"><canvas id="space-canvas" aria-hidden="true"></canvas><div class="space-top"><a href="#entrada" class="space-brand" aria-label="IncForStartUp">inc<span>.</span></a><span>UN UNIVERS DE POSSIBILITATS</span><a href="#inici" class="space-skip">Entra directament ↗</a></div><div class="space-heading"><p>LES IDEES NO TENEN LÍMITS</p><h1 id="space-title">Tot comença amb<br>una <em>connexió.</em></h1><p class="space-subtitle">Persones, coneixement i idees. Un espai per fer-los créixer.</p></div><div class="space-concepts" aria-hidden="true">${words.map((w,i)=>`<span class="concept concept-${i}">${w}</span>`).join('')}</div><button id="space-orb" aria-label="Entra a IncForStartUp amb un viatge entre estrelles"><span class="orb-label">inc.</span><span class="orb-action">ENTRA AL TEU UNIVERS <b>↗</b></span></button><div class="space-bottom"><span>UNA IDEA POT CANVIAR-HO TOT.</span><span class="space-hint">Acosta’t. Explora. Entra.</span><button id="space-pause" aria-pressed="false">Pausa el moviment</button></div><p id="space-status" class="sr-only" role="status"></p></section>`;}
 routes.entrada=['Entra al teu univers',entrance];
 render=function(){dispose();const entry=!location.hash||location.hash==='#entrada';document.body.classList.toggle('space-entry-active',entry);if(entry){$('#view').innerHTML=entrance();document.title='IncForStartUp · Un univers de possibilitats';start();}else previousRender();};
 function start(){
 const canvas=$('#space-canvas'),orb=$('#space-orb'),pause=$('#space-pause');
 let ctx;try{ctx=canvas.getContext('2d')}catch{}
 if(!ctx){orb.onclick=()=>{location.hash='inici'};pause.hidden=true;dispose=()=>{orb.onclick=null};return;}
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let width=0,height=0,dpr=1,frame=0,last=0,angle=0,speed=0.13,hover=false,paused=reduced.matches,travel=false,travelStart=0,alive=true;
 const stars=Array.from({length:360},()=>({x:Math.random()*2-1,y:Math.random()*2-1,z:Math.random(),r:Math.random()*1.4+0.3}));
 function resize(){width=innerWidth;height=innerHeight;dpr=Math.min(devicePixelRatio||1,2);canvas.width=width*dpr;canvas.height=height*dpr;canvas.style.width=width+'px';canvas.style.height=height+'px';ctx.setTransform(dpr,0,0,dpr,0,0);if(paused)draw(0);}
 function updatePause(){pause.textContent=paused?'Activa el moviment':'Pausa el moviment';pause.setAttribute('aria-pressed',String(paused));document.querySelector('.space-scene').classList.toggle('space-still',paused);}
 function draw(progress){
 ctx.clearRect(0,0,width,height);ctx.fillStyle='#030610';ctx.fillRect(0,0,width,height);
 const rect=orb.getBoundingClientRect(),cx=rect.x+rect.width/2,cy=rect.y+rect.height/2,r=rect.width*.43;
 const haze=ctx.createRadialGradient(cx,cy,10,cx,cy,Math.max(width,height)*.65);haze.addColorStop(0,'#192341');haze.addColorStop(.3,'#0b1226');haze.addColorStop(.7,'#070b18');haze.addColorStop(1,'#030610');ctx.fillStyle=haze;ctx.fillRect(0,0,width,height);
 for(const s of stars){const z=Math.max(.035,s.z),scale=travel?1+progress*9:1;const x=cx+s.x*width*.7*scale/(.4+z),y=cy+s.y*height*.7*scale/(.4+z);const length=travel?progress*.42:0;ctx.strokeStyle=`rgba(${travel?'177,218,255':'182,204,237'},${.2+(1-z)*.65})`;ctx.lineWidth=s.r*(travel?1.1:.65);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+(x-cx)*length+0.5,y+(y-cy)*length+0.5);ctx.stroke();}
 if(travel){const tunnel=ctx.createRadialGradient(cx,cy,0,cx,cy,r*(1+progress*3));tunnel.addColorStop(0,`rgba(196,229,255,${progress*.6})`);tunnel.addColorStop(.25,`rgba(62,139,241,${progress*.15})`);tunnel.addColorStop(1,'transparent');ctx.fillStyle=tunnel;ctx.fillRect(0,0,width,height);return;}
 // Luminous glass shell and orbit paths, all rendered as live geometry.
 const halo=ctx.createRadialGradient(cx,cy,r*.65,cx,cy,r*1.5);halo.addColorStop(0,'#559cd31c');halo.addColorStop(.65,'#326fcd15');halo.addColorStop(1,'transparent');ctx.fillStyle=halo;ctx.beginPath();ctx.arc(cx,cy,r*1.5,0,Math.PI*2);ctx.fill();
 ctx.save();ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.clip();const body=ctx.createRadialGradient(cx-r*.35,cy-r*.45,r*.03,cx,cy,r);body.addColorStop(0,'#88cbdf55');body.addColorStop(.45,'#16324fbb');body.addColorStop(.8,'#071527');body.addColorStop(1,'#57bed98c');ctx.fillStyle=body;ctx.fillRect(cx-r,cy-r,r*2,r*2);
 for(let i=0;i<12;i++){ctx.beginPath();for(let j=0;j<=150;j++){const t=j/150*Math.PI*2,a=angle+i*Math.PI/12;const x=Math.cos(t)*r*.96,y=Math.sin(t)*r*.96;const px=cx+Math.cos(a)*x*Math.cos(i*.43)-y*Math.sin(i*.43),py=cy+Math.cos(a)*x*Math.sin(i*.43)+y*Math.cos(i*.43);if(j===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);}ctx.strokeStyle=i%3===0?'#f4b6e18c':'#9ee6ff90';ctx.lineWidth=i%3===0?1.1:.65;ctx.shadowBlur=8;ctx.shadowColor='#72ccff';ctx.stroke();}
 ctx.shadowBlur=0;const core=ctx.createRadialGradient(cx,cy,0,cx,cy,r*.53);core.addColorStop(0,'#fff7ce');core.addColorStop(.06,'#ffdc8c');core.addColorStop(.2,'#ff9868ba');core.addColorStop(.5,'#d64b7940');core.addColorStop(1,'transparent');ctx.fillStyle=core;ctx.fillRect(cx-r,cy-r,r*2,r*2);ctx.restore();ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.strokeStyle='#9ddcfb88';ctx.lineWidth=1.3;ctx.shadowBlur=14;ctx.shadowColor='#7bdfff';ctx.stroke();ctx.shadowBlur=0;
 }
 function tick(now){if(!alive)return;const dt=Math.min((now-last)/1000||0,.05);last=now;if(travel){const p=Math.min((now-travelStart)/1250,1);draw(p);}else{if(!paused){speed+=( (hover?.48:.13)-speed)*Math.min(dt*3,1);angle+=dt*speed;for(const s of stars){s.z-=dt*.008;if(s.z<=0)s.z=1;}}draw(0);}frame=requestAnimationFrame(tick);}
 const navigation=createSpaceNavigation({
 navigate(){location.hash='inici';requestAnimationFrame(()=>{const heading=$('#view h1');if(heading){heading.setAttribute('tabindex','-1');heading.focus({preventScroll:true})}})},
 reduced:()=>reduced.matches||paused,
 start(){travel=true;travelStart=performance.now();orb.disabled=true;document.querySelector('.space-scene').classList.add('space-travelling');$('#space-status').textContent='Entrant al teu espai de treball…'},
 stop(){travel=false;}
 });
 const enter=()=>navigation.enter();
 const escape=e=>{if(e.key==='Escape')navigation.skip()};
 document.addEventListener('keydown',escape);
 orb.addEventListener('pointerenter',()=>hover=true);orb.addEventListener('pointerleave',()=>hover=false);orb.addEventListener('focus',()=>hover=true);orb.addEventListener('blur',()=>hover=false);orb.addEventListener('click',enter);pause.addEventListener('click',()=>{paused=!paused;updatePause()});
 function motionChanged(){paused=reduced.matches;updatePause();if(travel&&paused)navigation.skip();}reduced.addEventListener('change',motionChanged);window.addEventListener('resize',resize);updatePause();resize();frame=requestAnimationFrame(tick);
 dispose=()=>{navigation.dispose();document.removeEventListener('keydown',escape);alive=false;cancelAnimationFrame(frame);window.removeEventListener('resize',resize);reduced.removeEventListener('change',motionChanged);};
 }
 render();
})();
