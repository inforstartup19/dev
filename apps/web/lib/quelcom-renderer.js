// Lifecycle-isolated port of approved Quelcom v57 (9d6bcaf), replacing global render patches.
import { geometry } from './quelcom-geometry.js';
import { projectOrbit } from './quelcom-orbit.js';
const QuelcomEnergy={geometry};
const accents=['#c6a4ff','#82e7f1','#c6a4ff','#f2ce97','#f2ce97','#82e7f1','#82e7f1','#c6a4ff'];
export const words=['IDEES','CIÈNCIA','ART I CULTURA','PERSONES','UNIVERSITATS','TECNOLOGIA','PROJECTES','NOVES POSSIBILITATS'];
/** @param {HTMLElement} scene @param {()=>void} navigateTo */
export function startQuelcom(scene, navigateTo){
 const $ = selector => scene.querySelector(selector);
 const canvas=$('#space-canvas'),orb=$('#space-orb');let ctx;try{ctx=canvas.getContext('2d')}catch{}if(!ctx){orb.addEventListener('click',navigateTo);return ()=>orb.removeEventListener('click',navigateTo);}
 scene.classList.add('has-canvas');
 const satellites=[...scene.querySelectorAll('.space-concepts .concept')];
 // Independent orbital clocks, planes, eccentricities and slow precession.
 const orbits=satellites.map((_,i)=>({
   energy:0,meshTime:i*.8,phase:i*Math.PI/4-i*.71, speed:(i%2?-1:1)*(.16+i*.014),
   tilt:[0,Math.PI/2,Math.PI/4,-Math.PI/4,.3,1.2,2.1,2.7][i], precession:0,
   inclination:1.18+(i%3)*.09,eccentricity:.58+i*.043, radialPhase:i*1.73, radialSpeed:.013+i*.0027
 }));

 let pointer=null,hoveredSatellite=-1,attractX=0,attractY=0;
 function trackPointer(e){if(e.pointerType==='touch')return;const b=canvas.getBoundingClientRect();pointer={x:e.clientX-b.left,y:e.clientY-b.top};}
 function leavePointer(){pointer=null;hoveredSatellite=-1;}
 scene.addEventListener('pointermove',trackPointer);scene.addEventListener('pointerleave',leavePointer);
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let width=0,height=0,dpr=1,frame=0,last=0,angle=0,meshTime=0,speed=0.13,engagement=0,hover=false,paused=reduced.matches,travel=false,travelStart=0,alive=true,timer=0;
 const idleStarCount=innerWidth<=700?860:1250;
 const stars=Array.from({length:Math.round(idleStarCount*1.5)},()=>({x:Math.random()*2-1,y:Math.random()*2-1,z:Math.random(),r:Math.random()*1.4+0.3}));
 function resize(){const bounds=scene.getBoundingClientRect();width=bounds.width;height=bounds.height;dpr=Math.min(devicePixelRatio||1,2);canvas.width=width*dpr;canvas.height=height*dpr;canvas.style.width=width+'px';canvas.style.height=height+'px';ctx.setTransform(dpr,0,0,dpr,0,0);if(paused)draw(0);}
 function updatePause(){scene.classList.toggle('space-still',paused);}
 function draw(progress){
 ctx.clearRect(0,0,width,height);ctx.fillStyle='#030610';ctx.fillRect(0,0,width,height);
 const rect=orb.getBoundingClientRect(),surface=canvas.getBoundingClientRect(),cx=rect.x-surface.x+rect.width/2,cy=rect.y-surface.y+rect.height/2,r=rect.width*.43;
 const compact=width<=700;
 const projected=orbits.map((orbit,i)=>({...projectOrbit(orbit,{width,height},{x:cx,y:cy,radius:r},((compact?52:68)+words[i].length*(compact?2.2:3.2))/2),word:words[i],index:i,spin:orbit.phase*.4+i}));
 hoveredSatellite=-1;
 if(pointer&&!travel){const candidates=projected.filter(s=>Math.hypot(pointer.x-s.x,pointer.y-s.y)<=s.radius).sort((a,b)=>b.z-a.z);const centralHit=Math.hypot(pointer.x-cx,pointer.y-cy)<r;const target=candidates.find(s=>s.z>=0||!centralHit);if(target)hoveredSatellite=target.index;}
 function paintSatellites(front){
  for(const satellite of projected.filter(s=>(s.z>=0)===front).sort((a,b)=>a.z-b.z)){
   const {x,y,radius:sr,scale,word,spin}=satellite;
   ctx.save();
   const orbit=orbits[satellite.index],energy=orbit.energy,accent=accents[satellite.index];
   const glow=ctx.createRadialGradient(x,y,sr*.65,x,y,sr*1.32);glow.addColorStop(0,'#34edcf00');glow.addColorStop(.6,`rgba(45,238,210,${.12+energy*.2})`);glow.addColorStop(1,'#34edcf00');ctx.fillStyle=glow;ctx.fillRect(x-sr*1.35,y-sr*1.35,sr*2.7,sr*2.7);
   ctx.beginPath();ctx.arc(x,y,sr,0,Math.PI*2);ctx.fillStyle='#09132b';ctx.fill();
   ctx.save();ctx.clip();ctx.translate(x,y);ctx.scale(sr/100,sr/100);
   for(const mesh of QuelcomEnergy.geometry(orbit.meshTime,'satellite',energy)){ctx.strokeStyle=mesh.color;ctx.globalAlpha=mesh.opacity*(satellite.z>=0?1:.75);ctx.lineWidth=.8+energy*.25;ctx.stroke(new Path2D(mesh.d));}ctx.restore();
   ctx.beginPath();ctx.arc(x,y,sr,0,Math.PI*2);ctx.strokeStyle=accent;ctx.globalAlpha=satellite.z>=0?1:.7;ctx.lineWidth=1+energy*.65;ctx.shadowColor=accent;ctx.shadowBlur=4+energy*9;ctx.stroke();ctx.shadowBlur=0;ctx.globalAlpha=1;
   // Soft oval contrast field: no hard label box, mesh remains visible around it.
   ctx.save();ctx.beginPath();ctx.arc(x,y,sr*.98,0,Math.PI*2);ctx.clip();ctx.translate(x,y);ctx.scale(1,.58);const labelShade=ctx.createRadialGradient(0,0,0,0,0,sr*.96);labelShade.addColorStop(0,`rgba(4,10,25,${.74+energy*.15})`);labelShade.addColorStop(.6,`rgba(4,10,25,${.55+energy*.2})`);labelShade.addColorStop(1,'rgba(4,10,25,0)');ctx.fillStyle=labelShade;ctx.fillRect(-sr,-sr,sr*2,sr*2);ctx.restore();
   ctx.font=`600 ${Math.max(10,(compact?10.5:11.5)*scale)*(1+energy*.035)}px system-ui,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#f1f4f7';
   const lines=[];let line='';
   for(const part of word.split(' ')){const next=line?line+' '+part:part;if(line&&ctx.measureText(next).width>sr*1.7){lines.push(line);line=part;}else line=next;}lines.push(line);
   lines.forEach((text,i)=>{const ty=y+(i-(lines.length-1)/2)*14*scale;ctx.strokeStyle='#060d20';ctx.lineWidth=2.5;ctx.strokeText(text,x,ty,sr*1.8);ctx.shadowColor=accent;ctx.shadowBlur=energy*3;ctx.fillText(text,x,ty,sr*1.8);ctx.shadowBlur=0});
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
 // Vector plasma sphere: original cyan corona and slowly folding violet mesh.
 ctx.save();
 const aura=ctx.createRadialGradient(cx,cy,r*.7,cx,cy,r*1.38);aura.addColorStop(0,'#2eeed000');aura.addColorStop(.55,`rgba(38,238,211,${.23+engagement*.12})`);aura.addColorStop(1,'#23bbd000');ctx.fillStyle=aura;ctx.fillRect(cx-r*1.4,cy-r*1.4,r*2.8,r*2.8);
 // A continuous, softly varying corona rather than flashing rays.
 for(let i=0;i<(compact?72:108);i++){const a=i/(compact?72:108)*Math.PI*2,flow=(Math.sin(a*7+angle*1.3)+Math.sin(a*11-angle*.7)+2)/4,len=r*(.035+flow*.15);ctx.beginPath();ctx.moveTo(cx+Math.cos(a)*r*.98,cy+Math.sin(a)*r*.98);ctx.lineTo(cx+Math.cos(a)*(r+len),cy+Math.sin(a)*(r+len));ctx.strokeStyle=`rgba(67,249,218,${.06+flow*.17+engagement*.06})`;ctx.lineWidth=compact?1.2:1.6;ctx.stroke();}
 ctx.beginPath();ctx.arc(cx,cy,r*.985,0,Math.PI*2);ctx.fillStyle='#080e25';ctx.fill();
 const interior=ctx.createRadialGradient(cx-r*.25+attractX*r*.13,cy-r*.25+attractY*r*.13,0,cx,cy,r);interior.addColorStop(0,'#181130');interior.addColorStop(.65,'#11162f');interior.addColorStop(1,'#17627b');ctx.fillStyle=interior;ctx.fill();
 ctx.save();ctx.clip();ctx.translate(cx,cy);ctx.scale(r/100,r/100);
 for(const mesh of QuelcomEnergy.geometry(meshTime,compact,engagement)){ctx.strokeStyle=mesh.color;ctx.globalAlpha=mesh.opacity;ctx.lineWidth=.34+engagement*.12;ctx.stroke(new Path2D(mesh.d));}
 ctx.restore();
 // The luminous nucleus follows the visitor, while the label and hit area stay stable.
 ctx.save();ctx.beginPath();ctx.arc(cx,cy,r*.97,0,Math.PI*2);ctx.clip();const nx=cx+attractX*r*.13,ny=cy+attractY*r*.13;
 const nucleus=ctx.createRadialGradient(nx,ny,0,nx,ny,r*.62);nucleus.addColorStop(0,`rgba(170,224,247,${.08+engagement*.12})`);nucleus.addColorStop(.4,'rgba(125,107,228,.07)');nucleus.addColorStop(1,'rgba(82,167,232,0)');ctx.fillStyle=nucleus;ctx.fillRect(cx-r,cy-r,r*2,r*2);ctx.restore();
 ctx.beginPath();ctx.arc(cx,cy,r*.985,0,Math.PI*2);ctx.strokeStyle='#43f4d4';ctx.lineWidth=2+engagement;ctx.shadowColor='#2ef7d2';ctx.shadowBlur=18+engagement*8;ctx.stroke();ctx.shadowBlur=5;ctx.lineWidth=.8;ctx.strokeStyle='#a3ffef';ctx.stroke();ctx.restore();
 // The centre word belongs to the same depth layer as the central sphere.
 ctx.save();ctx.font=`600 ${compact?44:Math.max(42,Math.min(width*.034,60))}px system-ui,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#f5faff';ctx.shadowColor='#bdeeff';ctx.shadowBlur=3+engagement*12;ctx.fillText('quelcom',cx,cy-3,r*1.65);ctx.restore();
 paintSatellites(true);
 }
 function navigate(){if(!alive)return;clearTimeout(timer);navigateTo();}

 function tick(now){if(!alive||document.hidden||paused)return;const dt=Math.min((now-last)/1000||0,.05);last=now;
 const p=travel?Math.min((now-travelStart)/1050,1):0;
 const velocity=travel?.12+Math.pow(Math.min(p/.65,1),2)*3.8:.008;
 for(const s of stars){s.z-=dt*velocity;if(s.z<=.035){s.z=1;s.x=Math.random()*2-1;s.y=Math.random()*2-1;}}
 if(!travel){const centralHover=hover&&hoveredSatellite===-1;const bounds=orb.getBoundingClientRect(),surface=canvas.getBoundingClientRect(),ox=bounds.x-surface.x+bounds.width/2,oy=bounds.y-surface.y+bounds.height/2,reach=Math.max(bounds.width,1);const targetX=pointer&&centralHover?Math.max(-1,Math.min(1,(pointer.x-ox)/reach)):0,targetY=pointer&&centralHover?Math.max(-1,Math.min(1,(pointer.y-oy)/reach)):0;attractX+=(targetX-attractX)*Math.min(dt*3,1);attractY+=(targetY-attractY)*Math.min(dt*3,1);engagement+=((centralHover?1:0)-engagement)*Math.min(dt*5,1);speed+=((centralHover?.58:.13)-speed)*Math.min(dt*3,1);angle+=dt*speed;meshTime+=dt*(.52+engagement*1.65);for(const [index,orbit] of orbits.entries()){orbit.energy+=((hoveredSatellite===index?1:0)-orbit.energy)*Math.min(dt*5,1);orbit.meshTime+=dt*(.52+orbit.energy*1.65);orbit.phase+=dt*orbit.speed;orbit.tilt+=dt*orbit.precession;orbit.radialPhase+=dt*orbit.radialSpeed;}}draw(p);frame=requestAnimationFrame(tick);}
 function resume(){cancelAnimationFrame(frame);last=0;if(!paused&&!document.hidden)frame=requestAnimationFrame(tick);else if(!document.hidden)draw(0)}
 function enter(){if(travel)return;if(reduced.matches||paused){navigate();return;}travel=true;travelStart=performance.now();timer=setTimeout(navigate,1050);orb.disabled=true;scene.classList.add('space-travelling');$('#space-status').textContent='Entrant al teu espai de treball…';}
 function escape(e){if(e.key==='Escape'&&travel)navigate()}document.addEventListener('keydown',escape);document.addEventListener('visibilitychange',resume);
 const hoverOn=()=>hover=true,hoverOff=()=>hover=false;
 orb.addEventListener('pointerenter',hoverOn);orb.addEventListener('pointerleave',hoverOff);orb.addEventListener('focus',hoverOn);orb.addEventListener('blur',hoverOff);orb.addEventListener('click',enter);
 function motionChanged(){paused=reduced.matches;updatePause();resume();if(travel&&paused)navigate();}reduced.addEventListener('change',motionChanged);window.addEventListener('resize',resize);updatePause();resize();resume();
 return ()=>{orb.disabled=false;scene.classList.remove("space-travelling","has-canvas","space-still");orb.removeEventListener("pointerenter",hoverOn);orb.removeEventListener("pointerleave",hoverOff);orb.removeEventListener("focus",hoverOn);orb.removeEventListener("blur",hoverOff);orb.removeEventListener("click",enter);scene.removeEventListener('pointermove',trackPointer);scene.removeEventListener('pointerleave',leavePointer);alive=false;clearTimeout(timer);cancelAnimationFrame(frame);document.removeEventListener('keydown',escape);document.removeEventListener('visibilitychange',resume);window.removeEventListener('resize',resize);reduced.removeEventListener('change',motionChanged);};
 }
