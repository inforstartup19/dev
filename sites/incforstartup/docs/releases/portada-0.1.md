# IncForStartUp — Portada 0.1

Baseline visual acceptada per Omar el 16/11/2026.
Site existent: appgprj_6af6adf47fc08191abb13aec653b2fc7.
URL: https://incforstartup.independentankle2.chatgpt.site
Commit exacte del disseny acceptat: 63a3f3b6cbef0ff7c4f90bead9899321c6a5927b.
Versió publicada corresponent: appgprj_6af6adf47fc08191abb13aec653b2fc7~appgver_e852e990b00081919719dc1f33154199.
Aquest commit i aquesta versió són el punt de retorn; no revertir dades ni altres pàgines per recuperar només la portada.

## Decisions fixades
- Esfera central amb «quelcom», ampliació visual del 12,5% respecte al prototip inicial.
- Paraules en petites esferes, mida relacionada amb la llargada del text.
- Òrbites independents amb sentits, velocitats, inclinacions i variació lenta diferents.
- 1.250 estrelles en escriptori i 860 en amplades de mòbil.
- Clic central: viatge estel·lar accelerat fins a la pàgina principal.
- Únic text inferior: «Una idea pot canviar-ho tot», centrat i fix.
- Sense capçalera superior, botó de pausa ni «Entra al teu univers».
- Composició sense scroll; entrada recurrent, sense indicador de primera visita.
- Es respecta la preferència del sistema de moviment reduït; el bucle s'atura en ocultar la pestanya.

## Estat verificat i límits
Publicació privada existent, sense ampliar audiència. Sintaxi JavaScript comprovada.
Composició i navegació observades en previsualització Chromium d'escriptori.
No afirmar QA Safari/iOS/VoiceOver, pressupost de frames o mètriques LCP/INP aprovades.
Les òrbites independents encara poden superposar esferes: no hi ha evitació de col·lisions.
Aquest Site és una demostració; la integració autenticada preparada a GitHub PR #81 és separada.

## Següent increment 0.2 (pendent d'implementació)
1. Evitar solapaments prolongats i protegir la llegibilitat dels textos orbitals.
2. Verificar 360×640, 390×844, 768×1024, 1366×768 i orientació horitzontal; cap text tallat ni scroll.
3. Mesurar temps de frame i ús de memòria, i validar pausa en segon pla en dispositiu modest.
4. Revisar teclat, focus d'arribada, moviment reduït i Safari/VoiceOver real.
5. Comparar la proposta visual amb aquesta baseline abans de declarar 0.2 acceptada.

Conservar nom «quelcom», distribució general i texts aprovats mentre es treballa en aquests increments.
No crear un Site duplicat ni confondre el número de publicació automàtic amb la versió de producte 0.1.
