# Entrada espacial recurrent — #75–#77

## Estat
Port del Site privat cap al prototip estàtic `sites/incforstartup/public/`.
Font visual: Site commit `4e621b1bd9085102d3f7f4ffc95b243cc363e269`.
No s'ha copiat `workspace.css` ni reemplaçat el frontend autenticat `apps/web`.

## Contracte
- Portada sense hash i `#entrada`: esfera i conceptes, a cada visita.
- Clic/Enter/Space: animació de 1.25 s; `#inici` és el destí del portal estàtic.
- Reduced motion, pausa o canvas no disponible: accés immediat.
- Escape acaba el viatge. Sortir de la ruta cancel·la timer, RAF i listeners.
- Navegació amb deadline independent de RAF; focus al títol de destí.
- Deep links del prototip es mantenen. No sessions, dades privades o API noves.

## Validació
`node --test sites/incforstartup/tests/*.test.cjs`
`node --check sites/incforstartup/public/space-entry.js`
`python3 scripts/check_repo.py`

El Site original es va comprovar visualment a Chromium. El port del repositori
requereix encara QA visual i mòbil; Safari real/VoiceOver continua a #55/#77.
#76 cobreix refinament visual i pressupost de rendiment. No es declara finalitzat.

## PR següents
1. #23: UX d'Inc Proof sobre el backend existent, amb autorització A/B/C.
2. #77: adapter React autenticat, CSS encapsulat i E2E; no canviar ACL per entrar.
3. #76: variants visuals aprovades, rendiment i pausa en pestanya oculta.
4. #24/#40: procedència/cites i verificació governada; no certificació per IA.

Cap merge automàtic, desplegament Azure ni modificació de main en aquest increment.
