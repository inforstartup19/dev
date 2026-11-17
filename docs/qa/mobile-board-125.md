# #125 — Tauler acadèmic mòbil per estat

17/11/2026. Base: Site v55 i PR #127.

## Comportament
- Fins a 800 px, quatre botons amb estat seleccionat i comptadors; només la llista seleccionada és visible i accessible.
- En curs inclou tasques actives i retornades per corregir. Revisió i completades sempre consultables, encara que estiguin buides.
- TFG/TFM i estudiant/docent mantenen filtres separats en memòria. Canviar de filtre no escriu dades acadèmiques ni altera permisos.
- En obrir una tasca, el focus i el desplaçament porten al detall; en tancar, es recuperen filtre, pestanya i posició. Si la targeta ja no pertany a la llista, el focus retorna al filtre. L'última targeta consultada queda ressaltada.
- Targetes amb estat, següent acció i dependències explícites. Historial sota demanda; accions per botons, sense arrossegament obligatori.
- Context de demo, selector de rol i exportació dins d'un desplegable al mòbil. Menú amb proposta acadèmica, TFG, TFM i quatre espais. No es presenta com autenticació real.
- PC conserva les quatre columnes i els controls originals; els nodes es restitueixen en canviar d'amplada, sense reconstruir formularis.

## Proves automàtiques
- Site: 52 proves superades.
- Snapshot GitHub: 74 proves superades.
- Noves regressions: filtratge sense mutació, filtres independents per context, retorn amb focus i scroll, esborrany pendent, cicle de revisió/correcció/compleció TFG i TFM amb snapshots preservats, 75 tasques accessibles amb comptadors correctes.

## Revisió de navegador
Chromium amb marc responsive; no és emulació completa ni Safari físic.

| Amplada del marc CSS | Amplada client / scroll del document | Columnes visibles | Filtres visibles |
| --- | --- | --- | --- |
| 320 | 305 / 305 | 1 | 4 |
| 360 | 345 / 345 | 1 | 4 |
| 390 | 375 / 375 | 1 | 4 |
| 393 | 378 / 378 | 1 | 4 |
| 430 | 415 / 415 | 1 | 4 |
| 1280 | 1265 / 1265 | 4 | 0 |

La diferència de 15 px és la barra de desplaçament del navegador. Sense desbordament horitzontal observat. Comprovats filtres buit/completat, obertura i retorn a la targeta amb focus, canvi al TFM independent i pas a En curs amb comptadors actualitzats. Captures abans/després de 393 px conservades a la font del Site, `docs/qa/125/` (no incloses en els actius públics).

## Pendent abans de tancar #125
- Safari/iPhone 15 Pro físic, teclat virtual, zoom de text, VoiceOver i orientació (#55).
- Revisió visual de l'usuari.
- El detall extens i formularis es redissenyen a #126; aquest increment no canvia el model de dades, l'autenticació ni la càrrega de documents.
