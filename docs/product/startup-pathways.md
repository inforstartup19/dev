# Quelcom Startup — primer increment

Data: 18 de novembre de 2026. Epic #131, tasques #132–#136.

## Abast

L’esfera Startup obre Crea i creix i Enlaira amb cinc etapes cadascun. Cada etapa exposa una microformació, una tasca, un entregable, criteris de revisió i una pregunta per preparar el retorn del mentor. BeFirst apareix només com a exemple fictici, sense resultats inventats.

La demo Site vincula una preparació al mateix ID d’un Projecte Viu local. Les notes es desen separadament sota `quelcom.startup.<id>.v1`, amb revisió, validació de dades, detecció de canvis d’una altra pestanya i exportació dels camps pendents. No es modifica `incforstartup.workspace.v1`, ni el magatzem acadèmic, ni cap permís. Les respostes del diagnòstic orienten; no admeten ni validen automàticament. Recursos propis, ingressos, ajuts i inversió són opcions vàlides, totes voluntàries.

La versió React comparteix el catàleg, incorpora les mateixes vistes i orientació, i enllaça amb `/idees` mitjançant l’accés ja existent. Encara no persisteix preparacions Startup del compte; no substitueix la sessió per desat local. Site i React indiquen explícitament les seves capacitats diferents.

## Límits d’aquest increment

- Cap mentor assignat, reserva, notificació ni contacte amb inversors.
- La continuïtat del TFG/TFM és una preparació; no mou documents ni importa l’expedient ni concedeix permisos.
- Cap projecte es converteix en startup en entrar-hi, i desar una nota no completa una etapa.
- El circuit seqüencial TFG/TFM de la #126 no es modifica.
- No és un servei oficial ni una afiliació amb GrowStartup.
- La persistència autenticada, la revisió per mentors, els acords de continuïtat, els adjunts i la traducció anglesa continuen a les issues associades.

## Fonts i integració

`shared/startup-pathways.json` és el catàleg canònic. `python scripts/sync_startup_catalog.py` genera el catàleg de la demo; `--site <checkout>` actualitza també el Site obert. Les dues PR comparteixen exactament aquest contingut. La PR Site continua la #129; la PR React continua la #130. No s’han fusionat les cadenes prèvies ni tancat les issues per tenir una demo.

## Verificació

- 66 proves del Site font i 88 de la còpia al repositori: orientació, aïllament entre projectes, preservació de dades acadèmiques, corrupció, conflicte de pestanyes, notes pendents i finançament opcional.
- React: 22 proves unitàries, typecheck i build de producció correctes.
- Afegides dues proves de navegador React per itineraris, maduresa, recursos voluntaris i viewport mòbil; el resultat CI s’indica a la PR.
- Recorregut visual Chromium: navegació sense projecte, activitat MVP amb projecte, desat, recàrrega amb recuperació i orientació cap a Enlaira.
- Revisió de disposició en frames de 393 × 852; cap desplaçament horitzontal als espais Startup i MVP. És una prova de viewport, no una verificació física de Safari/iPhone.

## Ordre següent

1. #132: iterar Crea i creix amb retorn d’Omar i persistència d’una prova real autenticada.
2. #134: diagnòstic amb evidències i revisió inicial explícita.
3. #135: acords Campus–Startup i connexió amb autories/documents (#87/#91).
4. #136: assignació autoritzada, versions de retorn i tasca següent de mentorització.
5. #133: creixement, indicadors amb font i recursos voluntaris (#10).
