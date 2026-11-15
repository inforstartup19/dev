# Projecte Viu UX 2.0 · Inc AI Project Assistant — primer increment

**Branca:** `dev` · **Àmbit:** #14, #15, #24 i pilot BF (#45). **No hi ha cap desplegament Azure.**

## Contracte implementat

`GET /v1/idea-drafts/{draft_id}/assistant/guidance`: autenticació privada, context requerit, consulta del projecte propietat de l'actor, cap mutació. Retorna `lifecycle` **derivat de la darrera decisió** (`undecided`, `active`, `paused`, `closed`), `latest_decision_id`, `operational_effects`, `safeguards` i suggeriments opcionals amb codis estables, raó i IDs de registres autoritzats.

No és un model generatiu ni una inferència externa: **Inc AI fase 0 = regles deterministes transparents**, operant sobre dades persistides, sense utilitzar informació d'altres usuaris. Cap acció automàtica.

## Pausar i tancar: significat exacte

- **Pausar:** la darrera decisió humana marca una *pausa orientativa*. No altera la base de dades de proves, el calendari, l'execució ni la visibilitat. L'usuari ha de revisar tasques actives, tercers, recursos i obligacions; cal definir responsables, notificacions i condicions de represa.
- **Tancar:** la darrera decisió marca *tancament orientatiu*. No desactiva credencials, cancela contractes, borra evidències ni transfereix diners. Cal checklist d'acords, propietat intel·lectual, dades, retenció i eventual reobertura.
- **Continuar/reformular/demanar ajuda:** es registren històricament; si passen a ser la darrera decisió, l'estat orientatiu torna a `active`; no es presumeix que cap de les obligacions anteriors ja està resolta.
- **No és un bloqueig de backend:** un projecte pausat o tancat encara admet accions existents. No presentar-lo com a estatus executiu ni com a cancel·lació efectiva.

## Suggeriments explicables

- Prova activa: revisar seguiment i valorar recursos.
- Resultat inconcloent: valorar reformulació.
- Darrera decisió «demanar ajuda»: preparar necessitat de persona, si encara no existeix.
- Necessitat de recursos desada: valorar si cal finançament; cap quantitat ni pressupost inferits.
- Pausa/tancament: prioritzar la revisió dels efectes, sense oferir automatismes de reactivació.
- La UI mostra «Per què?», IDs de registre, opcionalitat i **Descartar** per a la sessió actual; preparar una necessitat només obre el panell i selecciona la categoria. El descart no es persisteix ni és una preferència IA.

## Seguretat, limitacions i següent porta de qualitat

1. L'API fa `owned_draft` abans de qualsevol consulta, filtra totes les dades per `owner_id` i retorna 404 a un altre usuari. No revela noms de projectes aliens.
2. Proves API noves: lectura anònima, actor aliè, suggeriments, no-mutació, pausa/tancament/continuació, no-fuga A/B.
3. Revisar la CI i E2E connectada de BF després dels commits. No afirmar tests passats si no hi ha execució.
4. Pròxima iteració: revisió governada de compromisos amb assignació, acknowledge, notificacions per consentiment, congelació selectiva i represa explícita; requerirà model, migració i tests ACL.
5. Assistència generativa només després de recuperar context amb ACL, cites i opt-in adequats (#24); no utilitzar dades privades per entrenament automàtic.
