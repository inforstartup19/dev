/* Private Campus guidance. A centre decides which academic steps it requires. */
(function (root) {
  'use strict';
  const labels = { TR: 'treball de recerca', TFG: 'treball de fi de grau', TFM: 'treball de fi de màster' };

  function phases(kind) {
    const school = kind === 'TR';
    return [
      ['Proposta de tema',
        'Presenta la idea, una pregunta abordable i què podries lliurar. Si tens una preferència de tutoria, comunica-la a la coordinació.',
        'Contrasta l’abast amb l’estudiant, acorda el primer lliurable i registra si cal reformular el tema. El centre confirma qui assumeix la tutoria.'],
      ['Seguiment',
        'Porta un lliurament parcial i un dubte concret a cada tutoria. Acorda què canviaràs i quan ho tornaràs a presentar.',
        'Revisa les evidències, comenta la tasca i deixa un proper pas amb una data acordada.'],
      ['Dipòsit',
        'Prepara la memòria, els annexos, les citacions i la declaració que demani el centre. Fes el lliurament formal pel canal del centre i conserva el justificant.',
        'Revisa la versió final i emet el vistiplau o l’informe previ quan ho estableixi el centre. Adjuntar un fitxer a Quelcom serveix per treballar-hi.'],
      ['Revisió d’originalitat',
        'Revisa les fonts i explica amb les teves paraules les coincidències que et demanin aclarir.',
        'Interpreta les coincidències en el seu context, incloses cites i bibliografia. Dona a l’estudiant l’oportunitat d’aclarir-les abans d’emetre una valoració.'],
      ['Presentació i defensa',
        'Prepara el guió i les diapositives. Assaja l’exposició i les respostes sobre mètode, resultats i limitacions a l’espai privat del treball.',
        'Dona retorn sobre l’assaig. La convocatòria i la composició de l’òrgan avaluador corresponen al centre.'],
      ['Acta i qualificació',
        school ? 'Consulta el retorn i la qualificació pel canal que indiqui el teu institut.' : 'Consulta l’acta i les indicacions de revisió pel canal oficial de la titulació.',
        school ? 'Aplica els criteris del centre de batxillerat. La tutoria i l’avaluació poden tenir funcions diferents segons el centre.' : 'L’òrgan designat aplica la rúbrica vigent i formalitza l’acta. La participació del tutor en la nota depèn de la titulació.']
    ];
  }

  function taskTemplate({ kind, role }) {
    const name = labels[kind] || 'treball';
    const common = { blocker: '', owner_label: '', due: '' };
    if (role === 'teacher') {
      return { ...common, title: 'Tutoria de seguiment', why: 'Acordar el proper pas del ' + name + '.',
        how: 'Revisar un lliurament parcial amb l’estudiant i comentar un dubte.',
        deliverable: 'Un acord de tutoria amb el canvi que es farà i una data de revisió.',
        criteria: 'L’estudiant sap què ha de lliurar i quan ho revisarem.' };
    }
    if (role !== 'student') return null;
    return { ...common, title: 'Proposta de tema', why: 'Delimitar què vull investigar o resoldre al ' + name + '.',
      how: 'Contrastar la pregunta, l’abast i el primer pas amb la persona que em tutoritza.',
      deliverable: 'Una proposta breu amb la pregunta, l’objectiu i la primera evidència que presentaré.',
      criteria: 'La pregunta és concreta i hi ha una primera tasca que es pot dur a tutoria.' };
  }

  function render({ kind, role, onboarding = false }) {
    if (!['student', 'teacher'].includes(role)) return '';
    const name = Object.hasOwn(labels, kind) ? kind : 'treball';
    const teacher = role === 'teacher';
    const title = onboarding ? 'Com començaràs el ' + name : 'El recorregut acadèmic';
    const lead = onboarding
      ? 'Tria un enfocament i una primera tasca. Després podràs desar el títol i comentar la proposta amb la tutoria.'
      : 'Consulta què et correspon a cada fase. L’ordre, els terminis i els criteris oficials els fixa el teu centre.';
    return '<details class="cp-academic-path"><summary><span><strong>' + title +
      '</strong><small>' + (teacher ? 'Funcions de la tutoria' : 'Orientació per a l’estudiant') +
      '</small></span></summary><div class="cp-path-content"><p>' + lead + '</p><ol>' +
      phases(kind).map(([label, student, tutor]) => '<li><strong>' + label + '</strong><p>' +
        (teacher ? tutor : student) + '</p></li>').join('') + '</ol>' +
      (onboarding ? '' : '<button type="button" data-cp="academic-task">' +
        (teacher ? 'Prepara una tutoria de seguiment' : 'Prepara la proposta de tema') + '</button>') +
      '</div></details>';
  }

  root.CampusAcademicPath = { render, taskTemplate };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.CampusAcademicPath;
})(globalThis);
