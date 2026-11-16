/* Original parametric vector mesh. Shared geometry for live Canvas and SVG. */
(function(root){
 function geometry(time=0,compact=false){
  const paths=[],rows=compact?24:36,cols=compact?14:22,steps=compact?64:96;
  function point(lat,lon){const wave=.065*Math.sin(lon*5+lat*3+time*1.7)+.035*Math.sin(lat*8-lon*3-time);const radius=.9+wave,x=Math.cos(lat)*Math.cos(lon)*radius,y=Math.sin(lat)*radius,z=Math.cos(lat)*Math.sin(lon)*radius;const a=time*.23,xx=x*Math.cos(a)+z*Math.sin(a),zz=-x*Math.sin(a)+z*Math.cos(a);return [xx,y*.94+zz*.2,zz];}
  function curve(fn,color){let d='',depth=0;for(let j=0;j<=steps;j++){const p=fn(j/steps);d+=(j?'L':'M')+(p[0]*100).toFixed(2)+','+(p[1]*100).toFixed(2);depth+=p[2];}paths.push({d,color,opacity:.22+(depth/(steps+1)+1)*.22});}
  for(let i=1;i<rows;i++){const lat=-Math.PI/2+i/rows*Math.PI;curve(t=>point(lat,t*Math.PI*2),i%3===0?'#be65f5':'#53e7ee');}
  for(let i=0;i<cols;i++){const lon=i/cols*Math.PI*2;curve(t=>point(-Math.PI/2+t*Math.PI,lon),i%2?'#9566ec':'#5af4ec');}
  return paths;
 }
 function svg(time=0){return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-140 -140 280 280"><defs><radialGradient id="halo"><stop offset="0.5" stop-color="#0b1030" stop-opacity="0"/><stop offset="0.71" stop-color="#40f8de" stop-opacity="0.5"/><stop offset="1" stop-color="#27c7cc" stop-opacity="0"/></radialGradient><filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter></defs><circle r="138" fill="url(#halo)"/><circle r="98" fill="#080c23"/><circle r="99" fill="none" stroke="#45fce0" stroke-width="5" filter="url(#glow)"/>${geometry(time).map(p=>`<path d="${p.d}" fill="none" stroke="${p.color}" stroke-opacity="${p.opacity}" stroke-width=".4"/>`).join('')}<circle r="99" fill="none" stroke="#6cfce9" stroke-width=".8"/></svg>`;}
 const api={geometry,svg};if(typeof module==='object'&&module.exports)module.exports=api;else root.QuelcomEnergy=api;
})(typeof globalThis!=='undefined'?globalThis:this);
