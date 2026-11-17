# Campus mòbil — primer increment #123 / #124

17/11/2026. Base Site v54 / GitHub PR #122.

## Diagnòstic
El Campus acumula canvi d'espai, capçalera, demo, perfil, context, accés acadèmic i hero abans de la feina. En mòbil les columnes i targetes passen a una pila amb la mateixa importància visual. El tauler acadèmic també apila estats i el detall és extens: es tractaran separadament a #125 i #126.

## Proposta implementada
- Capçalera curta; canvi als quatre espais dins del menú mòbil.
- Un desplegable de demo local agrupa perfil i context, mantenint avisos i controls originals.
- Presentació breu, TFG/TFM accessibles, propera aportació i espais del Campus.
- Comunitat i altres projectes sota demanda; no s'elimina contingut ni dades.
- Targetes dels espais més lleugeres, tipografia llegible i més espai vertical.
- Adaptació només fins a 800 px; en ampliar es restitueixen els nodes originals sense reconstruir formularis ni escriure a storage.

## Validació
- 46 proves existents del Site superades.
- Inspecció Chromium amb marc de 320 i 393 px: text llegible i accessos acadèmics visibles, sense desbordament horitzontal visual.
- Selector docent operatiu, avisos de simulació conservats; menú i retorn als quatre espais presents.
- Canvi a 1280 px: estructura original de PC restituïda.
- Aquestes comprovacions no són una prova en Safari físic.

## Pendent
- #55: iPhone 15 Pro real, VoiceOver, teclat virtual, zoom de text i orientació.
- Completar matriu 360/390/430 i comprovacions de contrast i dades llargues.
- #125: tauler filtrable per estat, propera tasca i retorn contextual.
- #126: detall focalitzat, formularis i revisió docent.
- No tancar #123/#124 abans de la validació restant.
