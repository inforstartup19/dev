const test=require('node:test'),assert=require('node:assert/strict');
const project=require('../public/orbit-layout.js');
for(const [width,height] of [[360,640],[390,844],[417,716],[768,1024],[1366,768],[568,320]])test(`full 3D orbit stays moving and bounded: ${width}x${height}`,()=>{
 for(let i=0;i<8;i++){
  let front=false,back=false,previous=null,distance=0;
  for(let step=0;step<=360;step++){
   const p=project({phase:step*Math.PI/180,tilt:[0,Math.PI/2,Math.PI/4,-Math.PI/4,.3,1.2,2.1,2.7][i],inclination:1.18+(i%3)*.09},{width,height},{x:width/2,y:height*.46},(width<=700?45:65));
   front ||= p.z>.1;back ||=p.z<-.1;
   assert.ok(p.x-p.radius>=0&&p.x+p.radius<=width);
   assert.ok(p.y-p.radius>=0&&p.y+p.radius<=height-40);
   if(previous){const delta=Math.hypot(p.x-previous.x,p.y-previous.y);assert.ok(delta>.01,'no stuck frames');distance+=delta;}
   previous=p;
  }
  assert.ok(front&&back,'passes in front and behind');assert.ok(distance>100);
 }
});
