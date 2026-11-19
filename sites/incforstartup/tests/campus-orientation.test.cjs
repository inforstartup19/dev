const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = {window: {}};
const js = fs.readFileSync(path.join(__dirname, '../public/campus-orientation.js'), 'utf8');
vm.runInNewContext(js, context);
const orientation = context.window.QuelcomOrientation;

test('every recommended route has a reason, an editable first task and a deliverable', () => {
  const guided = {
    apply: ['applied_real', 'prototype'],
    research: ['literature', 'research_plan', 'empirical']
  };
  for (const kind of ['TR', 'TFG', 'TFM']) {
    for (const [branch, routes] of Object.entries(guided)) {
      for (const route of routes) {
        const flow = orientation.start(kind);
        assert.match(orientation.render(flow), new RegExp(kind));
        assert.equal(orientation.submission(flow), null);
        assert.ok(orientation.advance(flow, 'choose', branch));
        assert.ok(orientation.advance(flow, 'choose', route));
        const html = orientation.render(flow);
        assert.ok(html.includes(orientation.label(route)));
        assert.ok(html.includes('Per a la tutoria'));
        const submission = orientation.submission(flow);
        assert.equal(submission.route, route);
        assert.ok(submission.firstStep.length > 0 && submission.firstStep.length <= 180);
      }
    }
  }
});

test('uncertain students can explore two alternatives and preserve the draft when going back', () => {
  const flow = orientation.start('TR');
  orientation.advance(flow, 'choose', 'examples');
  assert.match(orientation.render(flow), /residus/);
  orientation.advance(flow, 'choose', 'apply');
  orientation.advance(flow, 'choose', 'prototype');
  flow.firstStep = ' Fer un esbós de la senyalització. ';
  orientation.advance(flow, 'back');
  orientation.advance(flow, 'back');
  assert.equal(flow.stage, 'examples');
  orientation.advance(flow, 'choose', 'research');
  orientation.advance(flow, 'choose', 'empirical');
  assert.equal(orientation.submission(flow).route, 'empirical');
  orientation.advance(flow, 'route', 'prototype');
  assert.equal(orientation.submission(flow).firstStep, 'Fer un esbós de la senyalització.');
});

test('choosing a route directly still requires a valid first task and explicit confirmation', () => {
  const flow = orientation.start('TFM');
  assert.ok(orientation.advance(flow, 'direct'));
  assert.equal(orientation.submission(flow), null);
  assert.match(orientation.render(flow), /role="alert"/);
  assert.equal(orientation.advance(flow, 'route', 'constructor'), false);
  orientation.advance(flow, 'route', 'literature');
  flow.firstStep = '  ';
  assert.equal(orientation.submission(flow), null);
  flow.firstStep = 'a'.repeat(181);
  assert.equal(orientation.submission(flow), null);
  flow.firstStep = 'a'.repeat(180);
  assert.equal(orientation.submission(flow).firstStep.length, 180);
});

test('saved routes reopen for review, and user content stays plain text', () => {
  const flow = orientation.start('TFG', 'research_plan', '</textarea><img src=x>');
  const html = orientation.render(flow, {busy: true});
  assert.equal(flow.stage, 'review');
  assert.ok(html.includes('&lt;/textarea&gt;&lt;img src=x&gt;'));
  assert.ok(!html.includes('<img src=x>'));
  assert.match(html, /data-orient-action="confirm" disabled/);
  assert.equal(orientation.label('__proto__'), '');
});
