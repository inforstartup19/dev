# Entrada espacial al frontend — #77

## Implementació preparada
`/entrada` és una ruta pública recurrent; no desa cap indicador de primera visita.
`next` reutilitza la llista tancada del login (/campus/join, /private, /idees;
qualsevol altre valor va a /campus). Sense next: /campus en mode connectat,
/demo en demostració. Les rutes privades i el login continuen autoritzant l'accés.
No s'intercepten deep links ni callbacks OIDC. Canvas només rep geometria pública.

El renderitzador adapta l'esfera i les òrbites de PR #78 a un mòdul TypeScript,
amb CSS encapsulat i cleanup de RAF, observadors, listeners i temporitzador.
240 estrelles, DPR limitat a 2, cap dependència gràfica externa. La rotació
s'accelera amb hover/focus; viatge de 1,1 s amb límit independent del canvas.
Pausa i reduced-motion donen accés immediat. Esc cancel·la i restaura focus a
l'esfera; el vincle directe omet el viatge. Activació doble no duplica navegació.
Pestanya oculta o pausa atura el bucle RAF. Fallada del context usa esfera CSS.
El títol del destí rep focus després de la navegació client.

## Activació i gates
Per defecte la portada actual es conserva. `INC_SPACE_ENTRANCE=1` activa aquesta
entrada a `/` en cada visita, sense flags seen. Activar només després de:
- QA Safari iPhone/iPad, VoiceOver, landscape i zoom 200% amb evidències a #55.
- Mesures LCP/INP al dispositiu objectiu, CPU oculta/pausada i perfils de memòria.
- Revisió visual del recorregut i comprovació d'accés amb sessió caducada.
La ruta /entrada permet validar-ho abans de l'activació general. Desactivar
la variable reverteix la portada sense alterar sessions ni dades.

## Comprovacions
Playwright: ratolí/doble activació, teclat, cancel·lació sense navegació tardana,
reentrada, pausa, reduced-motion, canvas indisponible, next extern rebutjat,
landscape i focus. Prova connectada conserva sessió OIDC i accés privat /idees.
TypeScript i build locals. Chromium local continua limitat per socket EPERM
observat a #80; els resultats funcionals provenen del CI, no de QA Safari real.
Aquest increment no tanca #77 ni #55; no publica ni desplega Azure.
