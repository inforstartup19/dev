export const SPACE_TRAVEL_MS = 1100;
const smooth = (value: number) => value * value * (3 - 2 * value);

// Public geometry only. No project, identity or session data enters the renderer.
export function startSpaceRenderer(canvas: HTMLCanvasElement, orb: HTMLElement) {
  let ctx: CanvasRenderingContext2D | null;
  try { ctx = canvas.getContext("2d"); } catch { return null; }
  if (!ctx) return null;
  const context = ctx;
  let frame = 0, last = 0, angle = 0, speed = .13, hover = false;
  let paused = false, travelling = false, started = 0, disposed = false;
  let width = 0, height = 0, cx = 0, cy = 0, radius = 0;
  const stars = Array.from({length: 240}, () => ({x: Math.random()*2-1, y: Math.random()*2-1, z: Math.random(), size: Math.random()+.3}));
  function draw(now: number) {
    const dt = Math.min((now-last)/1000 || 0, .05); last = now;
    if (!paused) { speed += ((hover ? .48 : .13)-speed)*Math.min(dt*3,1); angle += dt*speed; }
    const progress = travelling ? Math.max(0, Math.min((now-started)/SPACE_TRAVEL_MS,1)) : 0;
    // Continuous launch, acceleration and settling; no white flash at the destination.
    const acceleration = smooth(Math.min(progress / .8, 1));
    const settling = 1 - smooth(Math.max(0, (progress - .78) / .22));
    const shell = 1 - smooth(Math.min(progress / .3, 1));
    context.clearRect(0,0,width,height);
    const haze = context.createRadialGradient(cx,cy,0,cx,cy,Math.max(width,height));
    haze.addColorStop(0,"#18243e"); haze.addColorStop(.5,"#080e20"); haze.addColorStop(1,"#030610");
    context.fillStyle=haze; context.fillRect(0,0,width,height);
    for (const star of stars) {
      const scale=(1+acceleration*6)/(.4+star.z), x=cx+star.x*width*.7*scale, y=cy+star.y*height*.7*scale;
      context.strokeStyle=`rgba(180,220,255,${(.2+(1-star.z)*.6)*(.25+.75*settling)})`; context.lineWidth=star.size*(1+acceleration*.5);
      context.beginPath(); context.moveTo(x,y); context.lineTo(x+(x-cx)*acceleration*.32*settling+.5,y+(y-cy)*acceleration*.32*settling+.5); context.stroke();
    }
    if (shell <= 0) return;
    context.save();
    context.globalAlpha=shell;
    context.translate(cx,cy); context.scale(.8+.2*shell,.8+.2*shell); context.translate(-cx,-cy);
    const halo=context.createRadialGradient(cx,cy,radius*.8,cx,cy,radius*1.45);
    halo.addColorStop(0,"#6cbfe52b"); halo.addColorStop(1,"transparent");
    context.fillStyle=halo; context.fillRect(cx-radius*1.5,cy-radius*1.5,radius*3,radius*3);
    const body=context.createRadialGradient(cx-radius*.35,cy-radius*.4,0,cx,cy,radius);
    body.addColorStop(0,"#8fcfe666"); body.addColorStop(.5,"#17354c"); body.addColorStop(.85,"#09182c"); body.addColorStop(1,"#77dbef99");
    context.fillStyle=body; context.beginPath(); context.arc(cx,cy,radius,0,Math.PI*2); context.fill();
    context.save(); context.beginPath(); context.arc(cx,cy,radius,0,Math.PI*2); context.clip();
    // Split the far and near hemispheres so orbits read as depth, not a flat mesh.
    for (const front of [false, true]) {
      for(let i=0;i<10;i++) {
        const tilt=i*Math.PI/10, rotation=angle+i*.37;
        context.beginPath(); let drawing=false;
        for(let j=0;j<=96;j++) {
          const t=j/96*Math.PI*2, x=Math.cos(t)*radius*.96;
          const y=Math.sin(t)*radius*.96*Math.cos(rotation), z=Math.sin(t)*Math.sin(rotation);
          if ((z>=0)!==front) { drawing=false; continue; }
          const px=cx+x*Math.cos(tilt)-y*Math.sin(tilt), py=cy+x*Math.sin(tilt)+y*Math.cos(tilt);
          if(!drawing) context.moveTo(px,py); else context.lineTo(px,py);
          drawing=true;
        }
        context.strokeStyle=front?(i%3===0?"#f4b6e1b3":"#b5ecffb8"):"#68a5c52e";
        context.lineWidth=front?1.1:.7; context.stroke();
      }
    }
    const core=context.createRadialGradient(cx,cy,0,cx,cy,radius*.6);
    core.addColorStop(0,"#fff7ce"); core.addColorStop(.12,"#ffdc8c"); core.addColorStop(.3,"#ff9868bb"); core.addColorStop(.6,"#d64b7955"); core.addColorStop(1,"transparent");
    context.fillStyle=core; context.fillRect(cx-radius,cy-radius,radius*2,radius*2); context.restore();
    context.beginPath(); context.arc(cx,cy,radius,0,Math.PI*2);
    context.strokeStyle="#a2e4f6aa"; context.lineWidth=1.3; context.stroke();
    context.beginPath(); context.ellipse(cx-radius*.35,cy-radius*.55,radius*.24,radius*.07,-.6,0,Math.PI*2);
    context.fillStyle="#c5f4ff26"; context.fill();
    context.restore();
  }
  function tick(now: number) { frame=0; if(disposed || paused || document.hidden) return; draw(now); frame=requestAnimationFrame(tick); }
  function sync() { cancelAnimationFrame(frame); frame=0; last=0; if(!disposed && !document.hidden) { draw(performance.now()); if(!paused) frame=requestAnimationFrame(tick); } }
  function resize() {
    const bounds=canvas.getBoundingClientRect(), target=orb.getBoundingClientRect(), dpr=Math.min(devicePixelRatio||1,2);
    width=bounds.width; height=bounds.height; cx=target.x-bounds.x+target.width/2; cy=target.y-bounds.y+target.height/2; radius=target.width*.43;
    canvas.width=Math.round(width*dpr); canvas.height=Math.round(height*dpr); context.setTransform(dpr,0,0,dpr,0,0); sync();
  }
  const observer=new ResizeObserver(resize); observer.observe(canvas); window.addEventListener("resize",resize); document.addEventListener("visibilitychange",sync); resize();
  return {
    pause(value: boolean) { paused=value; sync(); },
    hover(value: boolean) { hover=value; },
    travel(value: boolean) { travelling=value; started=performance.now(); sync(); },
    dispose() { disposed=true; cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener("resize",resize); document.removeEventListener("visibilitychange",sync); },
  };
}
