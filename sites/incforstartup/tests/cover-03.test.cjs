const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require('node:path').join(__dirname, '../public/space-entry.js'), 'utf8');
function harness({ hash = '', reduced = false, noCanvas = false } = {}) {
  const listeners = {}, events = {}, timers = new Map(), frames = new Map();
  let count = 0, legacy = 0;
  const classes = new Set();
  const classList = {add: x => classes.add(x), toggle: (x, on) => on ? classes.add(x) : classes.delete(x)};
  const ctx = new Proxy({}, {get: (_, k) => k.startsWith('create') ? () => ({addColorStop(){}}) : k === 'measureText' ? () => ({width: 30}) : () => {}});
  const rect = () => ({x: 0, y: 0, width: 390, height: 844});
  const orb = {getBoundingClientRect: rect, addEventListener: (name, fn) => events[name] = fn};
  const canvas = {style: {}, getContext: () => noCanvas ? null : ctx, getBoundingClientRect: rect};
  const scene = {classList, getBoundingClientRect: rect};
  const view = {}, status = {}, location = {hash};
  const nodes = {'#space-canvas': canvas, '#space-orb': orb, '#view': view, '#space-status': status};
  const context = {render: () => legacy++, routes: {}, location, $: s => nodes[s],
    document: {hidden: false, body: {classList}, querySelector: s => s === '.space-scene' ? scene : {}, querySelectorAll: () => Array(8).fill({}), addEventListener: (n,f) => listeners[n]=f, removeEventListener: n => delete listeners[n]},
    matchMedia: () => ({matches: reduced, addEventListener(){},removeEventListener(){}}),
    window: {addEventListener(){},removeEventListener(){},scrollTo(){}}, innerWidth:390,devicePixelRatio:1,
    performance:{now:()=>0}, requestAnimationFrame: f => {frames.set(++count,f);return count}, cancelAnimationFrame: id=>frames.delete(id),
    setTimeout: (f, ms)=>{timers.set(++count,{f,ms});return count},clearTimeout:id=>timers.delete(id),
    projectOrbit:require('../public/orbit-layout.js')};
  vm.createContext(context);vm.runInContext(source,context);
  return {context,events,listeners,timers,location,orb,view,classes,get legacy(){return legacy}};
}
test('root is the 0.3 cover; deep links retain campus and allow reentry',()=>{
  const h=harness(); assert.match(h.view.innerHTML,/quelcom/); assert.ok(h.classes.has('space-entry-active'));
  h.location.hash='#projectes';h.context.render();assert.equal(h.legacy,1);assert.ok(!h.classes.has('space-entry-active'));
  h.location.hash='#entrada';h.context.render();assert.match(h.view.innerHTML,/UNA IDEA POT CANVIAR-HO TOT/);
});
test('travel deadline, double activation, Escape and cleanup',()=>{
  const h=harness();h.events.click();h.events.click();assert.equal(h.timers.size,1);assert.equal([...h.timers.values()][0].ms,1050);
  h.listeners.keydown({key:'Escape'});assert.equal(h.location.hash,'inici');assert.equal(h.timers.size,0);
  const other=harness();other.events.click();other.location.hash='#projectes';other.context.render();assert.equal(other.timers.size,0);
});
test('reduced motion and unavailable canvas preserve immediate entry',()=>{
  const reduced=harness({reduced:true});reduced.events.click();assert.equal(reduced.location.hash,'inici');assert.equal(reduced.timers.size,0);
  const fallback=harness({noCanvas:true});fallback.orb.onclick();assert.equal(fallback.location.hash,'inici');
});
