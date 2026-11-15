/* Navigation independent of animation frames; reusable by the future React adapter. */
(function (root) {
  function createSpaceNavigation({ navigate, reduced, start, stop, schedule = setTimeout, cancel = clearTimeout }) {
    let active = false, disposed = false, timer;
    const abort = () => { active = false; if (timer !== undefined) cancel(timer); timer = undefined; stop(); };
    const finish = () => { if (!active || disposed) return; abort(); navigate(); };
    return {
      enter() {
        if (active || disposed) return;
        active = true;
        if (reduced()) { finish(); return; }
        start();
        timer = schedule(finish, 1250);
      },
      skip: finish,
      dispose() { disposed = true; abort(); },
    };
  }
  if (typeof module !== 'undefined') module.exports = { createSpaceNavigation };
  else root.createSpaceNavigation = createSpaceNavigation;
})(typeof globalThis !== 'undefined' ? globalThis : this);
