# Portada 0.2 — 16/11/2026

Increment sobre la baseline 0.1 documentada a portada-0.1.md.

## Implementat
- «Una idea pot canviar-ho tot» sense punt final, centrat i fix.
- Separació entre esferes petites, marge respecte a l'esfera central i protecció del peu.
- Correcció de posicions amb desplaçament gradual; cerca d'espai lliure en pantalles estretes.
- Les òrbites mantenen rellotges independents; la separació pot desviar el recorregut.
- Major contrast dels textos orbitals, peu llegible en mòbil i focus visible al botó central.
- Sense scroll, sense nous controls visibles, mateix viatge i recompte d'estrelles.

## Validació automatitzada
`node --test tests/orbit-layout.test.cjs`: cinc geometries (360×640, 390×844,
768×1024, 1366×768, 568×320), 600 estats per geometria. Comprova límits de
pantalla/peu, separació de les esferes, centre llegible i moviment acumulat.
Prova numèrica del mòdul utilitzat pel Site; no emula Safari, tipografia o touch.
Sintaxi de space-entry.js comprovada amb node --check.

## Límits i següent QA
No es declara QA Safari/iOS/VoiceOver ni mètriques LCP/INP aprovades.
La cerca d'espai pot redistribuir esferes en canviar orientació o quan l'espai
és escàs. Revisar aquests casos en dispositius reals abans de donar el disseny
per definitiu. Encara no hi ha certificació d'accessibilitat ni pressupost de
frames mesurat al mòbil. La versió 0.1 es manté recuperable al seu commit.
