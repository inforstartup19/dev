/* University assignments are granted and checked by the Campus. This component renders server state. */
(function (root) {
  'use strict';

  const modes = {
    none: 'Sense assignació',
    supervise: 'Tutoria',
    evaluate: 'Tutoria i avaluació',
    project_only: 'Només treballs assignats anteriorment'
  };
  const effects = {
    none: 'El docent perdrà l’accés als treballs d’aquest estudiant.',
    supervise: 'El docent podrà acompanyar els treballs d’aquest estudiant. La validació de les tasques i els assajos quedarà desactivada.',
    evaluate: 'El docent podrà acompanyar els treballs d’aquest estudiant, revisar-ne les tasques i validar els assajos.'
  };
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
  const mark = '<span class="required-mark" aria-hidden="true">*</span>';
  const list = value => Array.isArray(value) ? value : [];

  function selectedTeacher(roster, teacherId) {
    const teachers = list(roster?.teachers);
    return teachers.find(teacher => teacher.id === teacherId) || teachers[0] || null;
  }

  function invitationStatus(person) {
    return person.status === 'invited' ? '<small class="cu-invite">Invitació pendent</small>' : '';
  }

  function assignmentRow(teacher, student, current, locked) {
    const options = Object.keys(effects).map(mode => '<option value="' + mode + '"' +
      (current === mode ? ' selected' : '') + '>' + modes[mode] + '</option>').join('');
    const legacy = current === 'project_only'
      ? '<option value="project_only" selected disabled>' + modes.project_only + '</option>' : '';
    const rowId = 'cu-row-' + escape(student.id);
    return '<li class="cu-row"><form class="cu-assignment" data-uni-teacher="' + escape(teacher.id) +
      '" data-uni-student="' + escape(student.id) + '" data-uni-original="' + current + '"' +
      (locked ? ' data-uni-locked' : '') + '><div class="cu-member">' +
      '<strong id="' + rowId + '">' + escape(student.label) + '</strong>' + invitationStatus(student) + '</div>' +
      '<div class="cu-controls"><label class="cu-sr" for="' + rowId + '-mode">Permís per a ' +
      escape(student.label) + '</label><select id="' + rowId + '-mode" name="mode" required aria-describedby="' + rowId +
      '-effect"' + (locked ? ' disabled' : '') + '>' + legacy + options + '</select>' +
      '<button type="submit" aria-describedby="' + rowId + '" disabled>Desa el canvi</button></div>' +
      '<p class="cu-effect" id="' + rowId + '-effect" data-uni-effect aria-live="polite"></p></form></li>';
  }

  // Called by the Campus change handler. Changing a select only previews the intended change.
  function updateMode(select) {
    const form = select?.closest?.('.cu-assignment');
    if (!form) return;
    const changed = select.value !== form.dataset.uniOriginal && Object.hasOwn(effects, select.value);
    const locked = form.hasAttribute('data-uni-locked');
    const button = form.querySelector('button[type="submit"]');
    if (button) button.disabled = !changed || locked;
    const hint = form.querySelector('[data-uni-effect]');
    if (hint) hint.textContent = changed && !locked ? effects[select.value] : '';
  }

  function managerPanel(roster, teacherId, locked) {
    const teachers = list(roster.teachers), students = list(roster.students);
    const teacher = selectedTeacher(roster, teacherId);
    if (!teacher) return '<section class="cu-panel"><h2>Assignacions docents</h2><p>Encara no hi ha docents al centre.</p></section>';
    const byStudent = new Map(list(roster.assignments)
      .filter(pair => pair.teacher_id === teacher.id && Object.hasOwn(modes, pair.mode))
      .map(pair => [pair.student_id, pair.mode]));
    const sorted = [...students].sort((left, right) =>
      Number(byStudent.has(right.id)) - Number(byStudent.has(left.id)) ||
      String(left.label).localeCompare(String(right.label), 'ca'));
    const count = students.filter(student => byStudent.has(student.id) && byStudent.get(student.id) !== 'none').length;
    const summary = count === 1 ? '1 estudiant assignat' : count + ' estudiants assignats';
    return '<section class="cu-panel" aria-labelledby="cu-assign-title"><h2 id="cu-assign-title">Assignacions docents</h2>' +
      '<label class="cu-teacher-label" for="cu-teacher">Docent ' + mark + '</label>' +
      '<select id="cu-teacher" name="university_teacher" required' + (locked ? ' disabled' : '') + '>' +
      teachers.map(item => '<option value="' + escape(item.id) + '"' + (item.id === teacher.id ? ' selected' : '') +
        '>' + escape(item.label) + (item.status === 'invited' ? ' · Invitació pendent' : '') + '</option>').join('') + '</select>' +
      '<p class="cu-count">' + summary + '</p>' +
      (students.length ? '<div class="cu-list-heading"><h3>Estudiants del centre</h3>' +
        '<p>Tria el permís de cada estudiant i desa el canvi.</p></div><ul class="cu-list">' +
        sorted.map(student => assignmentRow(teacher, student, byStudent.get(student.id) || 'none', locked)).join('') +
        '</ul>' : '<p>Encara no hi ha estudiants al centre.</p>') + '</section>';
  }

  function personalPanel(role, entries) {
    if (role !== 'student' && role !== 'teacher') return '';
    const teacher = role === 'teacher', counterpartRole = teacher ? 'student' : 'teacher';
    const rows = list(entries).filter(pair => pair.role === counterpartRole && pair.status === 'active' &&
      Object.hasOwn(modes, pair.mode) && pair.mode !== 'none');
    return '<section class="cu-panel" aria-labelledby="cu-people-title"><h2 id="cu-people-title">' +
      (teacher ? 'Els teus estudiants' : 'Els teus docents') + '</h2>' +
      (rows.length ? '<ul class="cu-list cu-personal">' + rows.map(pair =>
        '<li><strong>' + escape(pair.label) + '</strong><span>' + modes[pair.mode] + '</span></li>'
      ).join('') + '</ul>' : '<p>' + (teacher ? 'Encara no tens estudiants assignats amb accés actiu al centre.' :
        'Encara no tens cap docent assignat amb accés actiu al centre.') + '</p>') + '</section>';
  }

  function render(context = {}) {
    const { institution, role, roster, selectedTeacherId, loading, saving, stale, error, notice } = context;
    if (!institution?.id || !institution.name) return '';
    const manager = institution.can_manage === true;
    if (!manager && !['teacher', 'student'].includes(role)) return '';
    const refresh = '<button type="button" class="cu-refresh" data-uni-refresh' +
      (loading || saving ? ' disabled' : '') + '>Actualitza les assignacions</button>';
    const heading = '<section class="cu-space"><header class="cu-header"><div><p class="cu-role">' +
      (manager ? 'Gestió del centre' : role === 'teacher' ? 'Espai docent' : 'Espai de l’estudiant') +
      '</p><h1 id="cu-title" tabindex="-1">' + escape(institution.name) + '</h1><p>' +
      (manager ? 'Assigna estudiants a cada docent i decideix qui pot avaluar els seus treballs.' :
        role === 'teacher' ? 'Consulta els estudiants que acompanyes i els permisos de cada assignació.' :
          'Consulta qui t’acompanya i qui pot avaluar els teus treballs.') + '</p></div>' +
      '<div class="cu-columns" aria-hidden="true"><i></i><i></i><i></i></div></header>';
    if (loading) return heading + '<p class="cu-status" role="status">Carregant les assignacions…</p></section>';
    if (error) return heading + '<p class="cp-alert" role="alert">' + escape(error) + '</p>' + refresh + '</section>';
    const ready = manager ? roster?.institution?.id === institution.id : Array.isArray(context.assignments);
    if (!ready) return heading + '<p class="cu-status" role="status">Les assignacions encara no estan disponibles.</p>' +
      refresh + '</section>';
    return heading + (stale ? '<p class="cp-alert" role="alert">Les assignacions han canviat. Actualitza-les abans de desar.</p>' : '') +
      (notice ? '<p class="cp-success" role="status">' + escape(notice) + '</p>' : '') +
      (saving ? '<p class="cu-status" role="status">Desant el canvi…</p>' : '') +
      (manager ? managerPanel(roster, selectedTeacherId, !!(stale || saving)) : personalPanel(role, context.assignments)) +
      '<div class="cu-foot">' + refresh + '</div></section>';
  }

  root.CampusUniversity = {render, updateMode};
  if (typeof module !== 'undefined' && module.exports) module.exports = root.CampusUniversity;
})(globalThis);
