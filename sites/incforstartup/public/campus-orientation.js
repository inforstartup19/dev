/* Orientation is a draft until Campus confirms it for the selected project. */
(() => {
  'use strict';

  const routes = {
    applied_real: {
      title: 'Projecte aplicat en un entorn real',
      reason: 'Tens un lloc on provar la teva proposta i un acord sobre què hi pots fer.',
      task: 'Descriu una necessitat real i acorda amb la persona responsable què provaràs i com en valoraràs el resultat.',
      evidence: 'Una fitxa amb la necessitat, la prova acordada i un criteri d’èxit.'
    },
    prototype: {
      title: 'Proposta d’intervenció o prototip',
      reason: 'Pots dissenyar una solució i posar-la a prova amb un cas simulat mentre concretes l’accés a un entorn real.',
      task: 'Prepara un esbós de la solució, prova’l amb un cas simulat i indica com el validaries en un entorn real.',
      evidence: 'Un esbós, un supòsit identificat i un criteri per a la primera prova.'
    },
    literature: {
      title: 'Revisió de la literatura',
      reason: 'Comparar treballs publicats et permetrà acotar el tema i entendre què se’n sap.',
      task: 'Acota una pregunta, prova una cerca i explica per què inclouries o descartaries tres fonts.',
      evidence: 'La pregunta, els termes de cerca i una primera taula de fonts.'
    },
    research_plan: {
      title: 'Projecte de recerca',
      reason: 'Ja tens una pregunta. Preparar el mètode t’ajudarà a decidir quines dades et caldran i com hi tindràs accés.',
      task: 'Defineix la pregunta, què observaràs i amb quin instrument. Prova el registre amb una dada d’exemple.',
      evidence: 'Un protocol breu amb el mètode, el calendari i els accessos pendents.'
    },
    empirical: {
      title: 'Estudi empíric i informe de resultats',
      reason: 'Disposes de dades pertinents que pots utilitzar per respondre la pregunta.',
      task: 'Descriu la font, el període i les unitats de les dades, i prepara una primera taula o figura comentada.',
      evidence: 'Una fitxa de la font i una primera anàlisi amb una limitació concreta.'
    }
  };

  const levelPrompts = {
    TR: 'Pensa en una cosa del teu entorn que t’agradaria entendre, crear o millorar.',
    TFG: 'Quina competència del grau t’agradaria posar en pràctica amb aquest treball?',
    TFM: 'Quin repte de la teva especialitat t’agradaria poder defensar davant del tribunal?'
  };

  const steps = {
    intention: {
      title: 'Què t’agradaria aconseguir?',
      choices: [
        ['apply', 'Crear o millorar alguna cosa', 'Dissenyar un producte, una intervenció o una solució.'],
        ['research', 'Respondre una pregunta', 'Explorar què se sap d’un tema, recollir dades o interpretar-les.'],
        ['examples', 'Encara no ho tinc clar', 'Comparar dues maneres d’abordar un mateix tema.']
      ]
    },
    examples: {
      title: 'Quina feina triaries?',
      intro: 'Imagina que el teu tema són els residus d’un centre educatiu.',
      choices: [
        ['apply', 'Provar una millora', 'Dissenyar una senyalització que ajudi a separar millor els residus.'],
        ['research', 'Entendre què hi passa', 'Investigar a quins espais es generen més residus i per què.']
      ]
    },
    apply: {
      title: 'On podries provar la teva idea?',
      intro: 'Pot ser una aula, un taller, una associació o qualsevol entorn que conegui el problema.',
      choices: [
        ['applied_real', 'Tinc accés acordat', 'Sé amb qui la provaré i què hi puc fer.'],
        ['prototype', 'Encara estic concretant l’accés', 'Puc treballar amb un prototip o un cas simulat.']
      ]
    },
    research: {
      title: 'Quin és el teu punt de partida?',
      intro: 'Tria el que pots fer avui amb la informació disponible.',
      choices: [
        ['literature', 'Vull saber què se sap del tema', 'Puc cercar i comparar fonts publicades.'],
        ['research_plan', 'Tinc una pregunta i em falten dades', 'He de decidir què observaré i com ho faré.'],
        ['empirical', 'Ja tinc dades que puc utilitzar', 'Són obertes o tinc permís per analitzar-les.']
      ]
    }
  };

  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => (
    {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]
  ));
  const validRoute = route => Object.prototype.hasOwnProperty.call(routes, route);
  const label = route => validRoute(route) ? routes[route].title : '';

  function start(kind, existingRoute, existingTaskTitle) {
    const route = validRoute(existingRoute) ? existingRoute : '';
    return {
      kind, stage: route ? 'review' : 'intention', history: [], route,
      firstStep: route ? (existingTaskTitle ?? routes[route].task) : '',
      tasksByRoute: Object.create(null), error: ''
    };
  }

  function setRoute(flow, route) {
    if (flow.route === route) return;
    if (validRoute(flow.route)) flow.tasksByRoute[flow.route] = flow.firstStep;
    flow.route = route;
    flow.firstStep = validRoute(route) ? (flow.tasksByRoute[route] ?? routes[route].task) : '';
  }

  function advance(flow, action, value) {
    if (action === 'back') {
      if (!flow.history.length && flow.stage !== 'review') return false;
      flow.stage = flow.history.pop() || 'intention';
    } else if (action === 'direct' && flow.stage === 'intention') {
      flow.history.push(flow.stage);
      flow.stage = 'review';
    } else if (action === 'route' && flow.stage === 'review' && validRoute(value)) {
      setRoute(flow, value);
    } else if (action === 'choose' && steps[flow.stage]?.choices.some(choice => choice[0] === value)) {
      flow.history.push(flow.stage);
      if (validRoute(value)) {
        setRoute(flow, value);
        flow.stage = 'review';
      } else {
        flow.stage = value;
      }
    } else {
      return false;
    }
    flow.error = '';
    return true;
  }

  function submission(flow) {
    if (flow.stage !== 'review') return null;
    if (!validRoute(flow.route)) {
      flow.error = 'Tria l’enfocament que vols donar al treball.';
      return null;
    }
    const firstStep = String(flow.firstStep ?? '').trim();
    if (!firstStep || firstStep.length > 180) {
      flow.error = 'Escriu una primera tasca d’entre 1 i 180 caràcters.';
      return null;
    }
    flow.error = '';
    return {route: flow.route, firstStep};
  }

  function question(flow, disabled) {
    const step = steps[flow.stage];
    const intro = flow.stage === 'intention' ? (levelPrompts[flow.kind] || 'Què voldries haver aconseguit quan acabis?') : step.intro;
    const choices = step.choices.map(([value, title, description]) => `
      <button type="button" class="cp-orient-option" data-orient-action="choose" data-orient-value="${value}"${disabled}>
        <strong>${title}</strong><span>${description}</span>
      </button>`).join('');
    return `<h2 data-orient-heading tabindex="-1">${step.title}</h2><p>${intro}</p>
      <div class="cp-orient-choices">${choices}</div>`;
  }

  function review(flow, disabled) {
    const route = validRoute(flow.route) ? routes[flow.route] : null;
    const options = Object.entries(routes).map(([key, item]) =>
      `<option value="${key}"${flow.route === key ? ' selected' : ''}>${item.title}</option>`).join('');
    return `<h2 data-orient-heading tabindex="-1">Començaré per aquí</h2>
      <label class="cp-orient-field">Enfocament del treball
        <select data-orient-route${disabled}><option value="" disabled${route ? '' : ' selected'}>Tria un enfocament</option>${options}</select>
      </label>
      ${route ? `<p>${route.reason}</p>
        <label class="cp-orient-field">Primera tasca del tauler
          <textarea data-orient-task maxlength="180" rows="3" placeholder="Què faràs primer?"${disabled}>${escape(flow.firstStep)}</textarea>
        </label>
        <p class="cp-orient-evidence"><strong>Per a la tutoria</strong> ${route.evidence}</p>` : ''}
      ${flow.error ? `<p role="alert" class="cp-alert">${escape(flow.error)}</p>` : ''}`;
  }

  function render(flow, {busy = false, confirmLabel = 'Confirma l’orientació'} = {}) {
    const disabled = busy ? ' disabled' : '';
    const isReview = flow.stage === 'review';
    const kind = Object.prototype.hasOwnProperty.call(levelPrompts, flow.kind) ? ' · '+flow.kind : '';
    return `<section class="cp-orient" aria-label="Orientació del treball">
      <span class="cp-orient-label">Orientació del treball${kind}</span>
      ${isReview ? review(flow, disabled) : question(flow, disabled)}
      <div class="cp-orient-actions">
        ${isReview ? `<button type="button" class="cp-primary" data-orient-action="confirm"${disabled}>${escape(confirmLabel)}</button>` : ''}
        ${flow.stage === 'intention' ? `<button type="button" data-orient-action="direct"${disabled}>Ja sé quin enfocament vull</button>` : `<button type="button" data-orient-action="back"${disabled}>Torna a les preguntes</button>`}
      </div>
    </section>`;
  }

  window.QuelcomOrientation = Object.freeze({start, advance, submission, render, label});
})();
