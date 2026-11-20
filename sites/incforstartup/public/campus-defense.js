/* Private, formative defence rehearsal. Record access and transitions are checked by the Campus. */
(function(root){
  'use strict';

  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const mark = '<span class="required-mark" aria-hidden="true">*</span>';
  const statuses = {
    draft: 'Esborrany', submitted: 'En revisió de la tutoria',
    changes_requested: 'Ajustos demanats', rehearsed: 'Assaig validat'
  };
  const prompts = {
    TR: 'Quina pregunta t’has fet, què has observat i què has après?',
    TFG: 'Quin problema has abordat, com l’has treballat i què demostren els resultats?',
    TFM: 'Quina aportació defenses, quina metodologia l’avala i quines limitacions té?'
  };
  const criteria = [
    ['Definició del problema', 15], ['Revisió bibliogràfica', 15], ['Metodologia', 20],
    ['Resultats', 20], ['Conclusions', 10], ['Presentació oral', 10], ['Defensa', 10]
  ];
  function documentLabel(name) {
    const text = String(name ?? '');
    const separator = text.indexOf('--');
    return separator < 0 ? text : text.slice(separator + 2);
  }
  const allowedFile = name => typeof name === 'string' && !/[\\/]/.test(name) && /\.(pdf|pptx?)$/i.test(name);
  const validMinutes = (value, min, fallback) => value !== '' && Number.isInteger(Number(value)) && Number(value) >= min && Number(value) <= 120 ? Number(value) : fallback;

  function materialSelect(documents, current) {
    const files = documents.filter(doc => allowedFile(doc.name));
    const selectedOutsideList = current && allowedFile(current) && !files.some(doc => doc.name === current);
    const options = files.map(doc => {
      const version = doc.name.includes('--') ? ' · ' + doc.name.slice(0, 8) : '';
      return '<option data-cdf-available value="' + escape(doc.name) + '"' + (current === doc.name ? ' selected' : '') + '>' + escape(documentLabel(doc.name) + version) + '</option>';
    }).join('');
    return '<label><span>Diapositives o material de suport</span><select name="attachment"><option value="">Sense material vinculat</option>' +
      (selectedOutsideList ? '<option selected value="' + escape(current) + '">' + escape(documentLabel(current)) + ' · versió associada</option>' : '') +
      options + '</select></label><p class="cp-hint">' + (files.length ? 'Formats de presentació: PDF, PPT i PPTX.' : 'Pots afegir un PDF, PPT o PPTX als documents del treball.') + '</p>' +
      '<div class="cp-actions cdf-file-actions"><button type="button" data-cdf-deck' +
      (files.some(doc => doc.name === current) ? ' data-cp-download="' + escape(current) + '"' : ' hidden disabled') +
      '>Descarrega el material de suport</button><button type="button" data-defense-documents>Ves als documents privats</button></div>';
  }

  function studentForm(ctx, values, revising) {
    const locked = ctx.busy ? ' disabled' : '';
    const saveDisabled = ctx.stale || ctx.busy ? ' disabled' : '';
    return '<form id="cp-defense-student" class="cp-form cdf-form"><fieldset' + locked + '><legend>' +
      (revising ? 'Nova versió del guió' : 'El teu guió') + '</legend>' +
      '<label><span>Guió de l’exposició ' + mark + '</span><textarea name="outline" rows="5" maxlength="6000" required aria-describedby="cdf-outline-help" placeholder="' +
      escape(prompts[ctx.work.kind] || prompts.TFG) + '">' + escape(values.outline) + '</textarea></label>' +
      '<p class="cp-hint" id="cdf-outline-help">L’esborrany és privat fins que l’enviïs a tutoria. Per enviar-lo cal escriure el guió.</p>' +
      '<label><span>Preguntes que vols preparar</span><textarea name="questions" rows="3" maxlength="3000" placeholder="Quina decisió et poden demanar que justifiquis?">' +
      escape(values.questions) + '</textarea></label>' + materialSelect(ctx.documents, values.attachment) +
      '<div class="cdf-durations"><label><span>Exposició (min) ' + mark + '</span><input name="talk_minutes" type="number" min="1" max="120" step="1" required value="' +
      escape(values.talk_minutes) + '"></label><label><span>Preguntes (min) ' + mark + '</span><input name="question_minutes" type="number" min="0" max="120" step="1" required value="' +
      escape(values.question_minutes) + '"></label></div><p class="cp-hint">Ajusta els temps a les indicacions del centre. Amb 0 minuts, el torn de preguntes queda desactivat.</p>' +
      '<div class="cp-actions"><button type="submit" value="save" formnovalidate' + saveDisabled + '>' +
      (revising ? 'Desa una nova versió' : 'Desa l’esborrany') + '</button>' +
      (revising ? '' : '<button type="submit" value="submit" class="cp-primary"' + saveDisabled + '>Envia a tutoria</button>') + '</div></fieldset></form>';
  }

  function savedPlan(record, documents) {
    if (!record) return '';
    const attachment = allowedFile(record.attachment) ? record.attachment : '';
    return '<div class="cdf-plan"><h3>Guió de l’assaig</h3>' +
      (record.outline ? '<p class="cdf-written">' + escape(record.outline) + '</p>' : '<p>El guió encara és buit.</p>') +
      (record.questions ? '<h4>Preguntes preparades</h4><p class="cdf-written">' + escape(record.questions) + '</p>' : '') +
      (attachment ? '<h4>Material de suport</h4><p>' + escape(documentLabel(attachment)) + '</p>' +
        (documents.some(doc => doc.name === attachment) ? '<button type="button" data-cp-download="' + escape(attachment) + '">Descarrega el material de suport</button>' : '') : '') + '</div>';
  }

  function teacherForm(ctx) {
    const blocked = ctx.busy || ctx.stale ? ' disabled' : '';
    return '<form id="cp-defense-teacher" class="cp-form cdf-form"><fieldset' + (ctx.busy ? ' disabled' : '') + '><legend>Revisa l’assaig</legend>' +
      '<label><span>Retorn per a l’estudiant ' + mark + '</span><textarea name="feedback" rows="3" required maxlength="3000" placeholder="Què funciona i quin pas li recomanes ara?">' +
      escape(ctx.draft?.feedback || '') + '</textarea></label><div class="cp-actions">' +
      '<button type="submit" value="return"' + blocked + '>Demana ajustos</button>' +
      '<button type="submit" value="validate" class="cp-primary"' + blocked + '>Valida l’assaig</button></div></fieldset></form>';
  }

  function rubric(kind) {
    return '<details class="cdf-rubric"><summary>Què puc preparar per a la defensa?</summary><p>Exemple de rúbrica per orientar l’assaig. ' +
      (kind === 'TR' ? 'Al TR de batxillerat, segueix els criteris i el calendari del teu centre.' : 'Consulta amb la tutoria la rúbrica vigent de la teva titulació.') +
      '</p><dl>' + criteria.map(([criterion, weight]) => '<div><dt>' + criterion + '</dt><dd>' + weight + '%</dd></div>').join('') +
      '</dl><p>Practica la síntesi, controla el temps i prepara una resposta sobre el mètode, els resultats i els límits del treball.</p></details>';
  }

  function createClock(now = () => Date.now()) {
    let phase = 'talk', started = null;
    const elapsed = {talk: 0, questions: 0};
    function pause() {
      if (started !== null) elapsed[phase] += Math.max(0, now() - started);
      started = null;
    }
    function read(limits) {
      const duration = limits[phase] * 60000;
      const used = elapsed[phase] + (started === null ? 0 : Math.max(0, now() - started));
      if (used >= duration) { elapsed[phase] = duration; started = null; }
      return {phase, running: started !== null, used: Math.min(used, duration),
        remaining: Math.max(0, Math.ceil((duration - used) / 1000)), enabled: duration > 0};
    }
    return {
      read, pause,
      choose(next) { if ((next === 'talk' || next === 'questions') && next !== phase) { pause(); phase = next; } },
      start(limits) { const state = read(limits); if (state.enabled && state.remaining > 0 && started === null) started = now(); },
      reset() { pause(); elapsed[phase] = 0; }
    };
  }

  let clock = createClock(), projectKey = '', interval = null;
  function stopTicks() { if (interval !== null) clearInterval(interval); interval = null; }
  function resetTimer() { stopTicks(); clock = createClock(); projectKey = ''; }
  function durationLabel(remaining) {
    return String(Math.floor(remaining / 60)).padStart(2, '0') + ':' + String(remaining % 60).padStart(2, '0');
  }
  function clockLabels(v) {
    return {
      toggle: v.running ? 'Pausa' : v.used === 0 ? 'Inicia' : 'Reprèn',
      status: !v.enabled ? 'Torn desactivat' : !v.remaining ? 'Temps completat' : v.running ? 'En marxa' : v.used ? 'En pausa' : 'A punt'
    };
  }
  const emptyNotes = {talk:'Encara no hi ha cap guió per consultar.', questions:'Encara no hi ha preguntes preparades.'};
  function timer(values, key) {
    if (key !== projectKey) { resetTimer(); projectKey = key; }
    const limits = {talk: validMinutes(values.talk_minutes, 1, 15), questions: validMinutes(values.question_minutes, 0, 10)};
    const v = clock.read(limits), labels = clockLabels(v);
    return '<section class="cdf-timer" aria-label="Temporitzador d’assaig" data-cdf-timer data-talk="' + limits.talk + '" data-questions="' + limits.questions + '">' +
      '<h3 id="cdf-timer-title" tabindex="-1">Assaja en veu alta</h3><div class="cdf-phases" role="group" aria-label="Tria el torn">' +
      '<button type="button" data-cdf-time="talk" aria-pressed="' + (v.phase === 'talk') + '">Exposició</button>' +
      '<button type="button" data-cdf-time="questions" aria-pressed="' + (v.phase === 'questions') + '"' + (limits.questions === 0 ? ' disabled' : '') + '>Preguntes</button></div>' +
      '<div class="cdf-clock"><span class="cdf-digits" role="timer" aria-label="Temps restant" aria-live="off" data-cdf-digits>' + durationLabel(v.remaining) +
      '</span><span role="status" aria-live="polite" data-cdf-status>' + labels.status + '</span></div><div class="cp-actions">' +
      '<button type="button" data-cdf-time="toggle"' + (!v.enabled || !v.remaining ? ' disabled' : '') + '>' + labels.toggle +
      '</button><button type="button" data-cdf-time="reset">Reinicia el torn</button></div>' +
      '<details class="cdf-notes"><summary>Consulta els apunts del torn</summary>' +
      '<p class="cdf-written" data-cdf-notes="talk"' + (v.phase === 'talk' ? '' : ' hidden') + '>' + escape(values.outline || emptyNotes.talk) + '</p>' +
      '<p class="cdf-written" data-cdf-notes="questions"' + (v.phase === 'questions' ? '' : ' hidden') + '>' + escape(values.questions || emptyNotes.questions) + '</p></details></section>';
  }

  function syncTimer() {
    if (typeof document === 'undefined') return;
    const el = document.querySelector('#cp-defense [data-cdf-timer]');
    if (!el || projectKey !== el.closest('#cp-defense')?.dataset.defenseProject) { resetTimer(); return; }
    const form = document.getElementById('cp-defense-student');
    const limits = {talk: validMinutes(form?.elements.talk_minutes?.value ?? el.dataset.talk, 1, Number(el.dataset.talk)),
      questions: validMinutes(form?.elements.question_minutes?.value ?? el.dataset.questions, 0, Number(el.dataset.questions))};
    if (!limits.questions && clock.read(limits).phase === 'questions') clock.choose('talk');
    const v = clock.read(limits), labels = clockLabels(v);
    const update = (selector, content) => { const item = el.querySelector(selector); if (item.textContent !== content) item.textContent = content; };
    update('[data-cdf-digits]', durationLabel(v.remaining)); update('[data-cdf-status]', labels.status);
    update('[data-cdf-time="toggle"]', labels.toggle);
    el.querySelector('[data-cdf-time="toggle"]').disabled = !v.enabled || !v.remaining;
    for (const phase of ['talk', 'questions']) el.querySelector('[data-cdf-time="' + phase + '"]').setAttribute('aria-pressed', String(phase === v.phase));
    el.querySelector('[data-cdf-time="questions"]').disabled = limits.questions === 0;
    el.querySelector('[data-cdf-notes="talk"]').hidden = v.phase !== 'talk';
    el.querySelector('[data-cdf-notes="questions"]').hidden = v.phase !== 'questions';
    if (!v.running) stopTicks();
    else if (interval === null) interval = setInterval(syncTimer, 250);
    return limits;
  }

  function render(context) {
    const ctx = {...context, documents: Array.isArray(context.documents) ? context.documents : []};
    const student = ctx.role === 'student' && ctx.isOwner, teacher = ctx.role === 'teacher' && !ctx.isOwner;
    if (!ctx.work || (!student && !teacher)) return '';
    const record = ctx.record || null, state = record?.status, workId = String(ctx.work.id);
    const start = '<section id="cp-defense" class="cp-section cdf" data-defense-project="' + escape(workId) + '" aria-labelledby="cdf-title"><header class="cdf-heading"><div><h2 id="cdf-title" tabindex="-1">Espai de presentacions</h2>' +
      '<p>Prepara la defensa amb la tutoria. El dipòsit i l’acta oficial segueixen el procediment del centre.</p></div>';
    if (ctx.loading) return start + '</header><p role="status">Recuperant l’assaig…</p></section>';
    if (ctx.unavailable || (record && !Object.hasOwn(statuses, state))) return start + '</header><p role="alert">' +
      escape(ctx.error || 'No hem pogut recuperar l’assaig.') + '</p><button type="button" data-defense-refresh>Reintenta la consulta</button></section>';
    const vals = {outline: '', questions: '', attachment: '', talk_minutes: 15, question_minutes: 10, ...record, ...ctx.draft};
    let content = start + '<span class="cdf-badge">' + (record ? statuses[state] : 'Pendent de preparar') + '</span></header>';
    if (student || record) content += '<button type="button" class="cdf-jump" data-cdf-time="focus">Ves al temporitzador d’assaig</button>';
    if (ctx.error || ctx.stale) content += '<p role="alert">' + escape(ctx.error || 'Hi ha una versió més recent de l’assaig.') + '</p>' +
      (ctx.stale ? '<button type="button" data-defense-refresh>Recupera la versió actual</button>' : '');
    if (record?.feedback) content += '<aside class="cdf-feedback"><h3>Darrer retorn de la tutoria</h3><p class="cdf-written">' + escape(record.feedback) + '</p></aside>';
    if (student && (!record || state === 'draft' || state === 'changes_requested')) content += studentForm(ctx, vals, false);
    else if (record) {
      content += savedPlan(record, ctx.documents);
      if (student && state === 'submitted') content += '<p class="cp-hint">La tutoria ja té aquesta versió. Pots continuar practicant mentre esperes el retorn.</p>';
      if (student && state === 'rehearsed') content += '<details class="cdf-revise"' + (Object.keys(ctx.draft || {}).length ? ' open' : '') +
        '><summary>Prepara una nova versió</summary>' + studentForm(ctx, vals, true) + '</details>';
      if (teacher && state === 'submitted') content += teacherForm(ctx);
      else if (teacher && (state === 'draft' || state === 'changes_requested')) content += '<p class="cp-hint">Podràs revisar la versió quan l’estudiant te l’enviï.</p>';
    } else content += '<p>Encara no has rebut cap assaig. Quan l’estudiant te l’enviï podràs comentar-lo i demanar ajustos o validar-lo.</p>';
    return content + (student || record ? timer(vals, workId) : '') + rubric(ctx.work.kind) + '</section>';
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('click', event => {
      const btn = event.target.closest?.('#cp-defense [data-cdf-time]');
      if (!btn || btn.disabled) return;
      const limits = syncTimer();
      if (!limits) return;
      const action = btn.dataset.cdfTime;
      if (action === 'focus') {
        const heading = document.getElementById('cdf-timer-title');
        heading?.focus(); heading?.scrollIntoView({block:'start',behavior:'auto'}); return;
      }
      if (action === 'toggle') { if (clock.read(limits).running) clock.pause(); else clock.start(limits); }
      else if (action === 'reset') clock.reset();
      else clock.choose(action);
      syncTimer();
    });
    document.addEventListener('change', event => {
      const select = event.target;
      if (!select.matches?.('#cp-defense-student select[name="attachment"]')) return;
      const button = select.form?.querySelector('[data-cdf-deck]');
      if (!button) return;
      const linked = select.selectedOptions[0]?.hasAttribute('data-cdf-available') && allowedFile(select.value);
      if (linked) button.dataset.cpDownload = select.value;
      else delete button.dataset.cpDownload;
      button.hidden = button.disabled = !linked;
    });
    document.addEventListener('input', event => {
      const control = event.target;
      if (control.matches?.('#cp-defense-student input[type="number"]')) syncTimer();
      if (control.matches?.('#cp-defense-student textarea[name="outline"], #cp-defense-student textarea[name="questions"]')) {
        const phase = control.name === 'outline' ? 'talk' : 'questions';
        const notes = document.querySelector('#cp-defense [data-cdf-notes="' + phase + '"]');
        if (notes) notes.textContent = control.value || emptyNotes[phase];
      }
    });
  }
  root.CampusDefense = {render, syncTimer, resetTimer, createClock};
  if (typeof module !== 'undefined' && module.exports) module.exports = root.CampusDefense;
})(globalThis);
