// Approved Site geometry, source 9d6bcaf.
/** @param {number} time @param {boolean | "satellite"} compact @param {number} intensity */
export function geometry(time=0,compact=false,intensity=0){
  const energy=Math.max(0,Math.min(1,intensity));
  const paths=[],rows=compact==='satellite'?12:compact?24:36,cols=compact==='satellite'?8:compact?14:22,steps=compact==='satellite'?32:compact?64:96;
  function point(lat,lon){const wave=(.095+energy*.065)*Math.sin(lon*5+lat*3+time*1.7)+(.045+energy*.035)*Math.sin(lat*8-lon*3-time);const radius=.84+wave,x=Math.cos(lat)*Math.cos(lon)*radius,y=Math.sin(lat)*radius,z=Math.cos(lat)*Math.sin(lon)*radius;const a=time*.23,xx=x*Math.cos(a)+z*Math.sin(a),zz=-x*Math.sin(a)+z*Math.cos(a);return [xx,y*.94+zz*.2,zz];}
  function curve(fn,color){let d='',depth=0;for(let j=0;j<=steps;j++){const p=fn(j/steps);d+=(j?'L':'M')+(p[0]*100).toFixed(2)+','+(p[1]*100).toFixed(2);depth+=p[2];}paths.push({d,color,opacity:.22+(depth/(steps+1)+1)*.22});}
  for(let i=1;i<rows;i++){const lat=-Math.PI/2+i/rows*Math.PI;curve(t=>point(lat,t*Math.PI*2),i%3===0?'#be65f5':'#53e7ee');}
  for(let i=0;i<cols;i++){const lon=i/cols*Math.PI*2;curve(t=>point(-Math.PI/2+t*Math.PI,lon),i%2?'#9566ec':'#5af4ec');}
  return paths;
 }
