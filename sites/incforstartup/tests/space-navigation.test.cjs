const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createSpaceNavigation}=require('../public/space-navigation.js');
function harness(reduced=false){let calls=0,starts=0,stops=0;const pending=new Map();let id=0;const c=createSpaceNavigation({navigate:()=>calls++,reduced:()=>reduced,start:()=>starts++,stop:()=>stops++,schedule:(fn,ms)=>{assert.equal(ms,1250);pending.set(++id,fn);return id},cancel:id=>pending.delete(id)});return {c,pending,get calls(){return calls},get starts(){return starts},get stops(){return stops}}}
test('every entry runs animation including return visits',()=>{const h=harness();h.c.enter();[...h.pending.values()][0]();h.c.enter();assert.equal(h.starts,2);[...h.pending.values()][0]();assert.equal(h.calls,2)});
test('double activation navigates only once',()=>{const h=harness();h.c.enter();h.c.enter();assert.equal(h.pending.size,1);const finish=[...h.pending.values()][0];finish();finish();assert.equal(h.calls,1)});
test('reduced motion or pause bypasses the timer',()=>{const h=harness(true);h.c.enter();assert.equal(h.calls,1);assert.equal(h.starts,0);assert.equal(h.pending.size,0)});
test('Escape finishes once and cancels the deadline',()=>{const h=harness();h.c.enter();h.c.skip();assert.equal(h.calls,1);assert.equal(h.pending.size,0);h.c.skip();assert.equal(h.calls,1)});
test('unmount/external navigation prevents a late redirect',()=>{const h=harness();h.c.enter();const stale=[...h.pending.values()][0];h.c.dispose();stale();h.c.enter();assert.equal(h.calls,0);assert.equal(h.pending.size,0)});
