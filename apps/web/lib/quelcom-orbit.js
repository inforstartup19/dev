// Approved Site orbital projection, source 9d6bcaf.
export function projectOrbit(orbit,bounds,centre,radius){
  const p=orbit.phase,tilt=orbit.tilt,inclination=orbit.inclination;
  const a=Math.cos(p),b=Math.sin(p)*Math.cos(inclination),z=Math.sin(p)*Math.sin(inclination);
  const x=a*Math.cos(tilt)-b*Math.sin(tilt),y=a*Math.sin(tilt)+b*Math.cos(tilt);
  const scale=.76+(z+1)*.18;
  const margin=radius*1.12+12;
  const rx=Math.max(0,Math.min((centre.radius||Math.min(bounds.width,bounds.height)*.2)+radius+28,centre.x-margin,bounds.width-centre.x-margin));
  const ry=Math.max(0,Math.min((centre.radius||Math.min(bounds.width,bounds.height)*.2)+radius+28,centre.y-margin,bounds.height-centre.y-margin-50));
  return {x:centre.x+x*rx,y:centre.y+y*ry,z,scale,radius:radius*scale};
 }
