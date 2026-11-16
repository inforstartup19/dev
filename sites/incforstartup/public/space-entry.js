/* Animated entrance: no first-visit flag. Every root/#entrada visit shows it. */
(()=>{
 const previousRender=render;
 document.querySelector('aside .brand').href='#entrada';
 let dispose=()=>{};
 const words=['IDEES','CIÈNCIA','ART I CULTURA','PERSONES','UNIVERSITATS','TECNOLOGIA','PROJECTES','NOVES POSSIBILITATS'];
 function entrance(){return `<section class="space-scene" aria-label="Entrada a IncForStartUp"><canvas id="space-canvas" aria-hidden="true"></canvas><div class="space-concepts" aria-hidden="true">${words.map((w,i)=>`<span class="concept concept-${i}">${w}</span>`).join('')}</div><button id="space-orb" aria-label="Entra a IncForStartUp amb un viatge entre estrelles"><span class="orb-label">quelcom</span></button><div class="space-bottom"><span>UNA IDEA POT CANVIAR-HO TOT</span></div><p id="space-status" class="sr-only" role="status"></p></section>`;}
 routes.entrada=['Entra al teu univers',entrance];
 render=function(){dispose();const entry=!location.hash||location.hash==='#entrada';document.body.classList.toggle('space-entry-active',entry);if(entry){$('#view').innerHTML=entrance();document.title='IncForStartUp · Un univers de possibilitats';start();}else previousRender();};
 function start(){
 const canvas=$('#space-canvas'),orb=$('#space-orb');let ctx;try{ctx=canvas.getContext('2d')}catch{}if(!ctx){orb.onclick=()=>location.hash='inici';return;}
 document.querySelector('.space-scene').classList.add('has-canvas');
 const satellites=[...document.querySelectorAll('.space-concepts .concept')];
 // Independent orbital clocks, planes, eccentricities and slow precession.
 const orbits=satellites.map((_,i)=>({
   phase:i*Math.PI/4-i*.71, speed:(i%2?-1:1)*(.16+i*.014),
   tilt:[0,Math.PI/2,Math.PI/4,-Math.PI/4,.3,1.2,2.1,2.7][i], precession:0,
   inclination:1.18+(i%3)*.09,eccentricity:.58+i*.043, radialPhase:i*1.73, radialSpeed:.013+i*.0027
 }));

 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let width=0,height=0,dpr=1,frame=0,last=0,angle=0,speed=0.13,engagement=0,hover=false,paused=reduced.matches,travel=false,travelStart=0,alive=true,timer=0;
 const idleStarCount=innerWidth<=700?860:1250;
 const stars=Array.from({length:Math.round(idleStarCount*1.5)},()=>({x:Math.random()*2-1,y:Math.random()*2-1,z:Math.random(),r:Math.random()*1.4+0.3}));
 function resize(){const bounds=document.querySelector('.space-scene').getBoundingClientRect();width=bounds.width;height=bounds.height;dpr=Math.min(devicePixelRatio||1,2);canvas.width=width*dpr;canvas.height=height*dpr;canvas.style.width=width+'px';canvas.style.height=height+'px';ctx.setTransform(dpr,0,0,dpr,0,0);if(paused)draw(0);}
 // Curved highlights and split rim lighting give the live geometry a glass finish.
 function glassFinish(x,y,radius,phase,intensity=0,central=false){
  ctx.save();ctx.beginPath();ctx.arc(x,y,radius*.985,0,Math.PI*2);ctx.clip();
  const reflection=ctx.createRadialGradient(x-radius*.36,y-radius*.46,0,x-radius*.28,y-radius*.36,radius*.92);
  reflection.addColorStop(0,`rgba(209,249,255,${central?.19+intensity*.12:.14})`);reflection.addColorStop(.32,'rgba(111,211,246,.075)');reflection.addColorStop(1,'rgba(111,211,246,0)');ctx.fillStyle=reflection;ctx.fillRect(x-radius,y-radius,radius*2,radius*2);
  ctx.beginPath();ctx.ellipse(x-radius*.3,y-radius*.42,radius*.32,radius*.095,-.65,0,Math.PI*2);ctx.fillStyle='rgba(211,250,255,.075)';ctx.fill();
  ctx.restore();ctx.save();ctx.lineCap='round';
  const segments=[[-2.85,-1.1,'#d5faff',.8],[.12,1.12,'#b0a1ef',.48],[1.5,2.4,'#63dce8',.6]];
  for(const [start,end,color,alpha] of segments){ctx.beginPath();ctx.arc(x,y,radius*.995,start,end);ctx.strokeStyle=color;ctx.globalAlpha=alpha+intensity*.15;ctx.lineWidth=central?1.7:1;ctx.shadowColor=color;ctx.shadowBlur=central?10:4;ctx.stroke();}
  if(central){
   ctx.globalAlpha=.35+intensity*.3;ctx.shadowBlur=0;ctx.lineWidth=.6;ctx.strokeStyle='#a6ddf2';ctx.beginPath();ctx.arc(x,y,radius*1.035,0,Math.PI*2);ctx.stroke();
   for(let i=0;i<3;i++){const a=phase*.32+i*Math.PI*2/3,px=x+Math.cos(a)*radius*1.035,py=y+Math.sin(a)*radius*1.035;ctx.beginPath();ctx.arc(px,py,1.4+intensity*.6,0,Math.PI*2);ctx.fillStyle='#d6faff';ctx.shadowColor='#a1efff';ctx.shadowBlur=9;ctx.fill();}
  }
  ctx.restore();
 }
 function updatePause(){document.querySelector('.space-scene').classList.toggle('space-still',paused);}
 function draw(progress){
 ctx.clearRect(0,0,width,height);ctx.fillStyle='#030610';ctx.fillRect(0,0,width,height);
 const rect=orb.getBoundingClientRect(),surface=canvas.getBoundingClientRect(),cx=rect.x-surface.x+rect.width/2,cy=rect.y-surface.y+rect.height/2,r=rect.width*.43;
 const compact=width<=700;
 const projected=orbits.map((orbit,i)=>({...projectOrbit(orbit,{width,height},{x:cx,y:cy,radius:r},((compact?52:68)+words[i].length*(compact?2.2:3.2))/2),word:words[i],spin:orbit.phase*.4+i}));
 function paintSatellites(front){
  for(const satellite of projected.filter(s=>(s.z>=0)===front).sort((a,b)=>a.z-b.z)){
   const {x,y,radius:sr,scale,word,spin}=satellite;
   ctx.save();
   // Opaque interiors occlude farther objects; depth changes light, never transparency.
   const light=.68+(satellite.z+1)*.16;
   const glow=ctx.createRadialGradient(x,y,sr*.82,x,y,sr*1.24);
   glow.addColorStop(0,'#6dcce624');glow.addColorStop(1,'transparent');
   ctx.fillStyle=glow;ctx.fillRect(x-sr*1.25,y-sr*1.25,sr*2.5,sr*2.5);
   ctx.beginPath();ctx.arc(x,y,sr,0,Math.PI*2);ctx.fillStyle='#071527';ctx.shadowColor='#01040dcc';ctx.shadowBlur=front?7:3;ctx.shadowOffsetY=front?3:1;ctx.fill();ctx.shadowBlur=0;ctx.shadowOffsetY=0;
   ctx.save();ctx.clip();
   const glass=ctx.createRadialGradient(x-sr*.3,y-sr*.4,0,x,y,sr);
   glass.addColorStop(0,'#9eddf56b');glass.addColorStop(.45,'#193b56c9');glass.addColorStop(.8,'#0b1c32');glass.addColorStop(1,'#64cce39c');
   ctx.fillStyle=glass;ctx.beginPath();ctx.arc(x,y,sr,0,Math.PI*2);ctx.fill();
   for(let ring=0;ring<6;ring++){
    const rotation=spin+ring*Math.PI/6,tilt=ring*.53;
    ctx.beginPath();
    for(let point=0;point<=48;point++){
     const t=point/48*Math.PI*2,u=Math.cos(t)*sr*.96,v=Math.sin(t)*sr*.96;
     const px=x+Math.cos(rotation)*u*Math.cos(tilt)-v*Math.sin(tilt),py=y+Math.cos(rotation)*u*Math.sin(tilt)+v*Math.cos(tilt);
     if(point===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);
    }
    ctx.strokeStyle=ring%3===0?'#f4b6e18c':'#9ee6ff90';ctx.lineWidth=.65;ctx.stroke();
   }
   const ember=ctx.createRadialGradient(x,y,0,x,y,sr*.57);
   ember.addColorStop(0,'#fff7ce');ember.addColorStop(.08,'#ffdc8c');ember.addColorStop(.25,'#ff986899');ember.addColorStop(.6,'#d64b7933');ember.addColorStop(1,'transparent');ctx.fillStyle=ember;ctx.fillRect(x-sr,y-sr,sr*2,sr*2);
   ctx.fillStyle=`rgba(2,7,19,${(1-light)*.45})`;ctx.fillRect(x-sr,y-sr,sr*2,sr*2);
   ctx.restore();ctx.beginPath();ctx.arc(x,y,sr,0,Math.PI*2);ctx.strokeStyle=front?'#b4efffd9':'#8ab8d099';ctx.lineWidth=front?1.4:1;ctx.stroke();
   glassFinish(x,y,sr,spin,0,false);
   ctx.font=`${Math.max(9,(compact?10:11)*scale)}px system-ui,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#d9eaf7';
   const lines=[];let line='';
   for(const part of word.split(' ')){const next=line?line+' '+part:part;if(line&&ctx.measureText(next).width>sr*1.7){lines.push(line);line=part;}else line=next;}lines.push(line);
   lines.forEach((text,i)=>{const ty=y+(i-(lines.length-1)/2)*14*scale;ctx.strokeStyle='#071527cc';ctx.lineWidth=3;ctx.strokeText(text,x,ty,sr*1.8);ctx.fillText(text,x,ty,sr*1.8)});
   ctx.restore();
  }
 }
 const haze=ctx.createRadialGradient(cx,cy,10,cx,cy,Math.max(width,height)*.65);haze.addColorStop(0,'#192341');haze.addColorStop(.3,'#0b1226');haze.addColorStop(.7,'#070b18');haze.addColorStop(1,'#030610');ctx.fillStyle=haze;ctx.fillRect(0,0,width,height);
 const boost=travel?Math.pow(Math.min(progress/.7,1),2):0;
 const settle=travel?1-Math.max(0,(progress-.85)/.15)*.6:1;
 // Light behind the trails: no opaque centre masking stars or creating a dark disc.
 if(travel){const tunnel=ctx.createRadialGradient(cx,cy,0,cx,cy,Math.max(width,height)*.65);tunnel.addColorStop(0,`rgba(139,204,255,${boost*.32*settle})`);tunnel.addColorStop(.12,`rgba(82,159,255,${boost*.22*settle})`);tunnel.addColorStop(.4,`rgba(85,82,210,${boost*.08*settle})`);tunnel.addColorStop(1,'transparent');ctx.fillStyle=tunnel;ctx.fillRect(0,0,width,height);}
 const visibleStarCount=travel?Math.round(idleStarCount*(1+.5*Math.min(progress/.35,1))):idleStarCount;
 for(let i=0;i<visibleStarCount;i++){const s=stars[i];
   const z=Math.max(.04,s.z),x=cx+s.x*width*.38/z,y=cy+s.y*height*.38/z;
   const tail=travel?(.025+boost*.34)*(1-z*.6):0;
   ctx.strokeStyle=`rgba(${travel?'170,222,255':'182,204,237'},${Math.min(.95,.22+(1-z)*.65)*settle})`;
   ctx.lineWidth=s.r*(travel?1.3:.65);ctx.beginPath();ctx.moveTo(cx+(x-cx)*(1-tail),cy+(y-cy)*(1-tail));ctx.lineTo(x+.5,y+.5);ctx.stroke();
 }
 if(travel)return;
 paintSatellites(false);
 // Luminous glass shell and orbit paths, all rendered as live geometry.
 const halo=ctx.createRadialGradient(cx,cy,r*.65,cx,cy,r*1.5);halo.addColorStop(0,`rgba(79,183,225,${.13+engagement*.13})`);halo.addColorStop(.65,`rgba(68,115,210,${.07+engagement*.07})`);halo.addColorStop(1,'transparent');ctx.fillStyle=halo;ctx.beginPath();ctx.arc(cx,cy,r*1.5,0,Math.PI*2);ctx.fill();
 ctx.save();ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fillStyle='#071527';ctx.fill();ctx.clip();const body=ctx.createRadialGradient(cx-r*.35,cy-r*.45,r*.03,cx,cy,r);body.addColorStop(0,'#9bdcf36b');body.addColorStop(.45,'#1b3d59cc');body.addColorStop(.8,'#0a1b30');body.addColorStop(1,'#66cde3a6');ctx.fillStyle=body;ctx.fillRect(cx-r,cy-r,r*2,r*2);
 for(let i=0;i<12;i++){ctx.beginPath();for(let j=0;j<=150;j++){const t=j/150*Math.PI*2,a=angle+i*Math.PI/12;const x=Math.cos(t)*r*.96,y=Math.sin(t)*r*.96;const depth=Math.sin(a)*x;const px=cx+Math.cos(a)*x*Math.cos(i*.43)-y*Math.sin(i*.43),py=cy+Math.cos(a)*x*Math.sin(i*.43)+y*Math.cos(i*.43);if(j===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);}ctx.strokeStyle=i%3===0?'#dcc0ee99':'#a8eaffaa';ctx.lineWidth=i%3===0?.9:.6;ctx.shadowBlur=3+engagement*4;ctx.shadowColor='#72ccff';ctx.stroke();}
 ctx.shadowBlur=0;const core=ctx.createRadialGradient(cx,cy,0,cx,cy,r*.53);core.addColorStop(0,'#fff9e7');core.addColorStop(.06,'#ffe2b3');core.addColorStop(.2,`rgba(255,173,134,${.62+engagement*.2})`);core.addColorStop(.5,'#b974b23b');core.addColorStop(1,'transparent');ctx.fillStyle=core;ctx.fillRect(cx-r,cy-r,r*2,r*2);ctx.restore();ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.strokeStyle='#9ddcfb88';ctx.lineWidth=1.3;ctx.shadowBlur=14;ctx.shadowColor='#7bdfff';ctx.stroke();ctx.shadowBlur=0;
 glassFinish(cx,cy,r,angle,engagement,true);
 // The centre word belongs to the same depth layer as the central sphere.
 ctx.save();ctx.font=`600 ${compact?44:Math.max(42,Math.min(width*.034,60))}px system-ui,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#f5faff';ctx.shadowColor='#bdeeff';ctx.shadowBlur=3+engagement*12;ctx.fillText('quelcom',cx,cy-3,r*1.65);ctx.restore();
 paintSatellites(true);
 }
 function navigate(){if(!alive)return;clearTimeout(timer);location.hash='inici';requestAnimationFrame(()=>{window.scrollTo({top:0,left:0,behavior:'instant'});const heading=$('#view h1');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true})}})}
 function tick(now){if(!alive||document.hidden||paused)return;const dt=Math.min((now-last)/1000||0,.05);last=now;
 const p=travel?Math.min((now-travelStart)/1050,1):0;
 const velocity=travel?.12+Math.pow(Math.min(p/.65,1),2)*3.8:.008;
 for(const s of stars){s.z-=dt*velocity;if(s.z<=.035){s.z=1;s.x=Math.random()*2-1;s.y=Math.random()*2-1;}}
 if(!travel){engagement+=((hover?1:0)-engagement)*Math.min(dt*5,1);speed+=((hover?.58:.13)-speed)*Math.min(dt*3,1);angle+=dt*speed;for(const orbit of orbits){orbit.phase+=dt*orbit.speed;orbit.tilt+=dt*orbit.precession;orbit.radialPhase+=dt*orbit.radialSpeed;}}draw(p);frame=requestAnimationFrame(tick);}
 function resume(){cancelAnimationFrame(frame);last=0;if(!paused&&!document.hidden)frame=requestAnimationFrame(tick);else if(!document.hidden)draw(0)}
 function enter(){if(travel)return;if(reduced.matches||paused){navigate();return;}travel=true;travelStart=performance.now();timer=setTimeout(navigate,1050);orb.disabled=true;document.querySelector('.space-scene').classList.add('space-travelling');$('#space-status').textContent='Entrant al teu espai de treball…';}
 function escape(e){if(e.key==='Escape'&&travel)navigate()}document.addEventListener('keydown',escape);document.addEventListener('visibilitychange',resume);
 orb.addEventListener('pointerenter',()=>hover=true);orb.addEventListener('pointerleave',()=>hover=false);orb.addEventListener('focus',()=>hover=true);orb.addEventListener('blur',()=>hover=false);orb.addEventListener('click',enter);
 function motionChanged(){paused=reduced.matches;updatePause();resume();if(travel&&paused)navigate();}reduced.addEventListener('change',motionChanged);window.addEventListener('resize',resize);updatePause();resize();resume();
 dispose=()=>{alive=false;clearTimeout(timer);cancelAnimationFrame(frame);document.removeEventListener('keydown',escape);document.removeEventListener('visibilitychange',resume);window.removeEventListener('resize',resize);reduced.removeEventListener('change',motionChanged);};
 }
 render();
})();
