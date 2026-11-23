(function (root) {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char =>
    ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'})[char]);
  const formats = root.CampusDocumentFormats || (typeof require === 'function' && require('./campus-document-formats.js'));
  const accepted = formats.supportedExtensions.map(ext => '.' + ext).join(',');
  const dateFormat = new Intl.DateTimeFormat('ca', {dateStyle:'medium', timeStyle:'short'});
  const zone = dateFormat.resolvedOptions().timeZone;
  const formatTime = date => date && Number.isFinite(Date.parse(date)) ? dateFormat.format(new Date(date)) : '';
  const baseName = path => String(path ?? '').split('/').pop();
  const displayName = path => baseName(path).replace(/^[0-9a-f-]{36}--/i, '');
  const blankDraft = () => ({title:'', subject:'', kind:'TFG', instructions:'', opens_at:'', due_at:'', allow_revisions:false, student_ids:[]});
  const required = '<span class="required-mark" aria-hidden="true">*</span>';
  const button = (action, label, attrs = '') => '<button type="button" data-cd-action="' + action + '" ' + attrs + '>' + label + '</button>';
  const attr = (name, value) => ' data-cd-' + name + '="' + esc(value) + '"';
  const datetime = raw => {
    const date = new Date(raw);
    if (!Number.isFinite(date.getTime())) throw Error('Comprova les dates del lliurament.');
    return date.toISOString();
  };

  function createPayload(draft) {
    const title = draft.title.trim(), subject = draft.subject.trim(), instructions = draft.instructions.trim();
    if (!title || title.length > 180) throw Error('Escriu un nom per al lliurament de fins a 180 caràcters.');
    if (subject.length > 180 || instructions.length > 3000) throw Error('Revisa la llargada de l’assignatura o de les indicacions.');
    if (!['TFG', 'TFM', 'TR'].includes(draft.kind)) throw Error('Tria el tipus de treball.');
    if (!draft.student_ids.length) throw Error('Selecciona almenys un estudiant.');
    const due_at = datetime(draft.due_at), opens_at = draft.opens_at ? datetime(draft.opens_at) : null;
    if (opens_at && opens_at >= due_at) throw Error('La data límit ha de ser posterior a l’obertura.');
    return {title, subject, instructions, kind:draft.kind, opens_at, due_at,
      allow_revisions:draft.allow_revisions === true, student_ids:[...new Set(draft.student_ids)]};
  }

  function teacherForm(state) {
    const d = state.draft;
    const input = (name, label, type, attrs, mandatory) => '<label><span>' + label + (mandatory ? ' ' + required : '') +
      '</span><input name="' + name + '" type="' + type + '" value="' + esc(d[name]) + '" ' + attrs +
      (mandatory ? ' required' : '') + '></label>';
    return '<form id="cd-create" class="cp-form cd-form"><fieldset' + (state.working ? ' disabled' : '') +
      '><legend>Crea un espai de lliurament</legend>' +
      input('title', 'Nom del lliurament', 'text', 'maxlength="180" placeholder="Per exemple, Memòria final"', true) +
      '<div class="cd-grid">' + input('subject', 'Assignatura', 'text', 'maxlength="180"', false) +
      '<label><span>Tipus de treball ' + required + '</span><select name="kind" required>' +
      ['TFG','TFM','TR'].map(k => '<option' + (k === d.kind ? ' selected' : '') + '>' + k + '</option>').join('') +
      '</select></label></div><div class="cd-grid">' +
      input('opens_at', 'Obertura', 'datetime-local', '', false) + input('due_at', 'Data i hora límit', 'datetime-local', '', true) +
      '</div><p class="cd-hint">Si deixes l’obertura en blanc, s’obre en publicar-lo. Horari de ' + esc(zone) + '.</p>' +
      '<label><span>Indicacions per a l’estudiant</span><textarea name="instructions" rows="3" maxlength="3000">' +
      esc(d.instructions) + '</textarea></label>' +
      '<label class="cd-check"><input name="allow_revisions" type="checkbox"' + (d.allow_revisions ? ' checked' : '') +
      '>Admet annexos i noves versions fins al tancament</label>' +
      '<fieldset class="cd-audience"><legend>Estudiants destinataris ' + required + '</legend>' +
      state.data.students.map(s => '<label class="cd-check"><input name="student_ids" type="checkbox" value="' + esc(s.id) + '"' +
        (d.student_ids.includes(s.id) ? ' checked' : '') + '><span>' + esc(s.label) + '</span></label>').join('') +
      '</fieldset><div class="cd-actions"><button type="submit" class="cp-primary">Publica el lliurament</button>' +
      button('cancel','Cancel·la') + '</div></fieldset></form>';
  }

  function receipt(file, recipient, teacher, boxId, disabled) {
    const label = esc(displayName(file.storage_name)), at = esc(formatTime(file.submitted_at));
    return '<li class="cd-receipt"><div><strong>' + label + '</strong><small>Lliurat el ' + at + '</small></div>' +
      (teacher ? button('download', 'Descarrega', attr('box',boxId) + attr('recipient',recipient.id) +
        attr('file',file.storage_name) + disabled + ' aria-label="Descarrega ' + label + '"') : '') + '</li>';
  }

  function studentActions(box, state, closed, scheduled, disabled) {
    const recipient = box.recipients[0];
    if (!recipient) return '';
    const files = recipient.files || [], pending = recipient.pending || [];
    const latest = [...files].sort((a,b) => Date.parse(b.submitted_at) - Date.parse(a.submitted_at));
    let body = latest.length ? '<h3 tabindex="-1" data-cd-receipt="' + esc(box.id) + '">Justificant de lliurament</h3><ul class="cd-files">' +
      receipt(latest[0],recipient,false,box.id,'') + '</ul>' : '';
    if (latest.length > 1) body += '<details><summary>Versions anteriors (' + (latest.length - 1) +
      ')</summary><ul class="cd-files">' + latest.slice(1).map(f => receipt(f,recipient,false,box.id,'')).join('') + '</ul></details>';
    if (pending.length) body += '<div class="cd-recovery"><h3>Pendent de confirmar</h3>' +
      pending.map(f => '<p>' + esc(displayName(f.storage_name)) + '</p>' + button('confirm','Confirma el lliurament',
        attr('box',box.id) + attr('file',f.storage_name) + disabled)).join('') + '</div>';
    const uploading = state.progress?.id === box.id;
    if (uploading) return body + '<p role="status">' + (state.progress.percent === 100 ? 'Confirmant el lliurament…' : 'Pujant el document…') +
      '</p><progress max="100" value="' + state.progress.percent + '" aria-label="Progrés de la pujada"></progress>';
    if (closed || scheduled || (!box.allow_revisions && (files.length || pending.length))) return body;
    const label = files.length ? 'Afegeix un annex o una versió' : 'Puja el document';
    const retry = state.retry?.id === box.id ? '<p class="cd-recovery">' + esc(state.retry.file.name) + ' ' +
      button('retry','Reintenta la pujada', attr('box',box.id) + disabled) + '</p>' : '';
    const policy = box.allow_revisions ? 'Pots afegir annexos i noves versions fins a la data límit.' : 'Es permet un únic document. Tria la versió definitiva.';
    return body + retry + '<div class="cd-pick"><p class="cd-policy">' + policy + '</p><label><span class="cd-pick-label">' + label +
      '</span><input type="file" data-cd-input' + attr('box',box.id) + ' accept="' + accepted +
      '" aria-label="' + label + '"' + disabled + '></label><p>Tria un fitxer i començarà la pujada. PDF, Word, Excel o PowerPoint · fins a 50 MB.</p></div>';
  }

  function spaceCard(box, state, teacher) {
    const now = Date.now(), closed = Date.parse(box.due_at) < now, scheduled = Date.parse(box.opens_at) > now;
    const recipients = box.recipients || [];
    const sent = recipients.filter(r => r.files?.length).length;
    const badge = !teacher && sent ? 'Lliurat' : closed ? 'Tancat' : scheduled ? 'Programat' : 'Obert';
    const disabled = state.working ? ' disabled' : '';
    let content;
    if (teacher) {
      const summary = recipients.map(r => '<li class="cd-person"><span>' + esc(r.label) + '</span>' +
        (r.files?.length ? '<ul class="cd-files">' + r.files.map(f => receipt(f,r,true,box.id,disabled)).join('') + '</ul>' :
          '<small>Pendent de lliurament</small>') + '</li>').join('');
      content = '<details><summary>Lliuraments rebuts · ' + sent + ' de ' + recipients.length +
        '</summary><ul class="cd-roster">' + summary + '</ul></details>';
    } else content = studentActions(box,state,closed,scheduled,disabled);
    return '<article class="cd-card"><div class="cd-meta"><span>' + esc(box.kind) + (box.subject ? ' · ' + esc(box.subject) : '') +
      '</span><span class="cd-badge">' + badge + '</span></div><h2>' + esc(box.title) +
      '</h2><div class="cd-dates">' + (box.opens_at ? 'Obre el ' + esc(formatTime(box.opens_at)) + ' · ' : '') +
      'Data límit ' + esc(formatTime(box.due_at)) + ' (' + esc(zone) + ')</div>' +
      (box.instructions ? '<p class="cd-instructions">' + esc(box.instructions) + '</p>' : '') + content + '</article>';
  }

  function render(state) {
    const teacher = state.role === 'teacher';
    if (!teacher && state.role !== 'student') return '';
    const disabled = state.working ? ' disabled' : '';
    const data = state.data;
    return '<section class="cd-space"><header class="cd-header"><div><h1>Lliuraments</h1><p>' +
      (teacher ? 'Prepara l’espai i rep els documents dels teus estudiants.' : 'Puja els documents que et demana el docent i consulta els justificants.') +
      '</p></div>' + (teacher && data?.students.length && !state.creating ? button('new','Crea un espai', 'class="cp-primary"' + disabled) : '') + '</header>' +
      (state.error ? '<p class="cp-alert" role="alert">' + esc(state.error) + '</p>' : '') +
      (state.notice ? '<p class="cp-success" role="status">' + esc(state.notice) + '</p>' : '') +
      (state.loading ? '<p role="status">Carregant els lliuraments…</p>' : '') +
      (data && teacher && !data.students.length ? '<p class="cd-note">Quan tinguis estudiants assignats, podràs crear un espai de lliurament.</p>' : '') +
      (data && teacher && state.creating && data.students.length ? teacherForm(state) : '') +
      (data?.spaces.length ? '<div class="cd-cards">' + data.spaces.map(box => spaceCard(box,state,teacher)).join('') + '</div>' :
        data && !state.creating ? '<p class="cd-empty">' + (teacher ? 'Encara no has publicat cap espai de lliurament.' :
          'Encara no tens cap lliurament assignat. Aquí apareixeran els que et prepari el docent.') + '</p>' : '') +
      (!state.creating ? button('reload','Actualitza els lliuraments', disabled) : '') + '</section>';
  }

  function create({role, api, onChange = () => {}}) {
    let alive = true, started = false, draftKey = '', requestId = '', receiptToFocus = '';
    const state = {role, data:null, creating:false, loading:false, working:false, error:'', notice:'',
      draft:blankDraft(), retry:null, progress:null};
    const changed = () => { if (alive) onChange(); };
    const getBox = id => state.data?.spaces.find(box => box.id === id);
    const load = async () => {
      const data = await api.dropboxes();
      if (!Array.isArray(data?.spaces) || !Array.isArray(data?.students)) throw Error('No s’han pogut recuperar els lliuraments.');
      if (alive) state.data = data;
    };
    async function run(operation) {
      if (!alive || state.working) return;
      state.working = true;
      state.error = ''; state.notice = ''; changed();
      try { await operation(); }
      catch (err) {
        if (alive) {
          if (err.code === 'denied') { state.data = null; state.retry = null; state.creating = false; state.draft = blankDraft(); }
          state.error = err.message || 'No s’ha pogut completar l’acció. Torna-ho a provar.';
        }
      } finally { if (alive) { state.working = false; state.loading = false; state.progress = null; changed(); } }
    }
    async function reload() {
      state.loading = true;
      await run(load);
    }
    async function publish() {
      if (role !== 'teacher' || !state.creating) return;
      await run(async () => {
        const payload = createPayload(state.draft), key = JSON.stringify(payload);
        if (key !== draftKey) { draftKey = key; requestId = root.crypto.randomUUID(); }
        await api.createDropbox(payload,requestId);
        if (!alive) return;
        state.creating = false; state.draft = blankDraft(); draftKey = '';
        state.notice = 'Espai de lliurament publicat.';
        await load();
      });
    }
    async function upload(box, file, id) {
      if (role !== 'student' || !box?.recipients[0] || !file) return;
      await run(async () => {
        state.retry = {id:box.id, file, key:id}; state.progress = {id:box.id,percent:0}; changed();
        const result = await api.uploadDropbox(box.id,file,id,{projectId:box.recipients[0].project_id,isCurrent:()=>alive,
          onProgress(event) {
            const percent = Math.max(0,Math.min(100,Number(event?.percent) || 0));
            if (alive && state.progress && state.progress.percent !== percent) { state.progress.percent = percent; changed(); }
          }
        });
        if (!alive) return;
        acceptReceipt(box, result);
        await load();
      });
    }
    function acceptReceipt(box,result) {
      if (!result?.storage_name || !result.submitted_at) throw Error('Falta la confirmació del lliurament. Actualitza els lliuraments.');
      const r = box.recipients[0];
      if (!r.files.some(f => f.storage_name === result.storage_name)) r.files.push(result);
      r.pending = (r.pending || []).filter(f => f.storage_name !== result.storage_name);
      receiptToFocus = box.id;
      state.notice = 'Document lliurat. Ja pots consultar el justificant.';
      state.retry = null;
    }
    async function confirm(box, path) {
      if (role !== 'student' || !box?.recipients[0]?.pending?.some(f=>f.storage_name === path)) return;
      await run(async () => {
        const result = await api.confirmDropbox(box.id,path,box.recipients[0].project_id);
        if (!alive) return;
        acceptReceipt(box,result);
        await load();
      });
    }
    async function download(box, target) {
      if (role !== 'teacher') return;
      const r = box?.recipients.find(person => person.id === target.cdRecipient);
      if (!r?.files?.some(f=>f.storage_name === target.cdFile)) return;
      await run(async () => {
        const file = await api.downloadDocument(r.project_id,baseName(target.cdFile));
        if (!alive) return;
        const url = URL.createObjectURL(file), link = document.createElement('a');
        link.href = url; link.download = displayName(target.cdFile); link.click();
        setTimeout(()=>URL.revokeObjectURL(url),1000);
      });
    }
    function bind(container) {
      const view = container?.matches?.('.cd-space') ? container : container?.querySelector?.('.cd-space');
      if (!view) return;
      if (receiptToFocus && !state.working) {
        const heading = Array.from(view.querySelectorAll?.('[data-cd-receipt]') || [])
          .find(node => node.dataset.cdReceipt === receiptToFocus);
        if (heading) heading.focus();
        receiptToFocus = '';
      }
      view.oninput = view.onchange = event => {
        const field = event.target;
        if (!alive || state.working) return;
        if (field.hasAttribute('data-cd-input')) {
          if (event.type === 'change' && field.files?.[0]) void upload(getBox(field.dataset.cdBox),field.files[0],root.crypto.randomUUID());
        } else if (field.form?.id === 'cd-create' && Object.hasOwn(state.draft,field.name)) {
          if (field.name === 'student_ids') state.draft.student_ids = Array.from(field.form.querySelectorAll('[name="student_ids"]:checked'), c=>c.value);
          else state.draft[field.name] = field.type === 'checkbox' ? field.checked : field.value;
        }
      };
      view.onsubmit = event => { if(event.target.id === 'cd-create') {event.preventDefault(); void publish();} };
      view.onclick = event => {
        const btn = event.target.closest?.('[data-cd-action]');
        if (!btn || !alive || state.working) return;
        const target = btn.dataset, box = getBox(target.cdBox);
        switch (target.cdAction) {
          case 'new': if (role === 'teacher') { state.creating = true; state.error = ''; state.notice = ''; changed(); } break;
          case 'cancel': state.creating = false; state.draft = blankDraft(); draftKey = ''; state.error = ''; changed(); break;
          case 'reload': void reload(); break;
          case 'retry': if (state.retry?.id === box?.id && state.retry) void upload(box,state.retry.file,state.retry.key); break;
          case 'confirm': void confirm(box,target.cdFile); break;
          case 'download': void download(box,target); break;
        }
      };
    }
    return {html:()=>alive ? render(state) : '', bind, busy:()=>state.working,
      start() { if (started || !alive) return; started = true; return reload(); },
      refresh() { if (alive && started && !state.working && !state.creating && !state.retry) return reload(); },
      dispose() { alive = false; state.retry = null; state.data = null; state.draft = blankDraft(); }};
  }
  root.CampusDropbox = {create,render,createPayload};
  if (typeof module !== 'undefined' && module.exports) module.exports = root.CampusDropbox;
})(globalThis);
