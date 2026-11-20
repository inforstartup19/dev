const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('../public/campus-academic-path.js');

test('orientation describes all six phases without exposing task actions during creation', () => {
  for (const kind of ['TR', 'TFG', 'TFM']) {
    const html = path.render({ kind, role: 'student', onboarding: true });
    assert.equal((html.match(/<li>/g) || []).length, 6);
    assert.ok(html.includes('Com començaràs el ' + kind));
    assert.ok(!html.includes('data-cp="academic-task"'));
  }
});

test('each member sees their next step and the centre decides the formal qualification', () => {
  assert.match(path.render({ kind: 'TR', role: 'teacher' }), /criteris del centre de batxillerat/);
  assert.match(path.render({ kind: 'TFG', role: 'student' }), /Prepara la proposta de tema/);
  assert.match(path.render({ kind: 'TFM', role: 'teacher' }), /Prepara una tutoria de seguiment/);
  assert.equal(path.render({ kind: 'TFM', role: 'visitor' }), '');
  assert.equal(path.taskTemplate({ kind: 'TR', role: 'visitor' }), null);
  assert.equal(path.taskTemplate({ kind: 'TR', role: 'teacher' }).title, 'Tutoria de seguiment');
  assert.match(path.taskTemplate({ kind: 'TFM', role: 'student' }).why, /treball de fi de màster/);
});
