/* Mobile presentation only: move existing nodes, never clone forms or alter data. */
(()=>{
 const media=matchMedia('(max-width: 800px)');
 let undo=[];
 function restore(){undo.reverse().forEach(fn=>fn());undo=[];}
 function move(node,parent,before=null){if(!node)return;const marker=document.createComment('mobile-layout');node.before(marker);parent.insertBefore(node,before);undo.push(()=>{marker.replaceWith(node);});}
 function disclosure(label,anchor){const d=document.createElement('details');d.className='mobile-campus-disclosure';const s=document.createElement('summary');s.textContent=label;d.append(s);anchor.before(d);undo.push(()=>d.remove());return d;}
 function adapt(){
  restore();if(!media.matches)return;
  const shell=document.querySelector('.uc-shell'),menu=shell?.querySelector('.uc-mobile-menu>div');
  if(!shell||!menu)return; // Academic workbench is addressed separately in #125/#126.
  shell.classList.add('mobile-campus-light');undo.push(()=>shell.classList.remove('mobile-campus-light'));
  const switcher=document.querySelector('.qu-space-switch');if(switcher)move(switcher,menu);
  const demo=shell.querySelector('.uc-demo'),context=shell.querySelector('.portal-context');
  if(demo){const role=demo.querySelector('select')?.selectedOptions[0]?.textContent?.split(' · ')[0]||'Perfil de prova';const d=disclosure('Demo local · '+role,demo);move(demo,d);if(context)move(context,d);const options=demo.querySelector('.uc-demo-options');if(options){const wasOpen=options.open;options.open=true;undo.push(()=>{options.open=wasOpen;});}}
  const academic=shell.querySelector('.uc-academic-access');
  if(academic){
   const hero=shell.querySelector('.campus-hero');if(hero)move(hero,shell,academic);
   const contextBlock=shell.querySelector('.uc-context'),tabs=shell.querySelector('.uc-tabs'),work=shell.querySelector('.uc-two');
   if(contextBlock){const d=disclosure('Comunitat i altres projectes',contextBlock);move(contextBlock,d);if(tabs)move(tabs,d);if(work)move(work,d);}
  }
 }
 const previous=render;render=function(){restore();previous();adapt();};
 media.addEventListener('change',adapt);
 adapt();
})();
