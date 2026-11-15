# Inc Proof UI — #23

## Implementat en aquest increment
Panell autenticat al costat d'Inc Connect, amb llista d'aportacions i acords,
declaració privada, evidències amb origen/versió/drets, confirmació/disputa
explícita i retirada pel declarant. Text de certificació professional exclòs.
Depèn del contracte de capabilities de PR #79; no canvia l'autorització de l'API.

El BFF permet només GET proofs, detail/evidence/attestations i POST
agreements/{id}/proofs, evidence/attestations/withdraw. Cap proxy genèric.
Les referències de font són text no executable. Cada mutació envia la versió
observada; 409 refresca sense reenviament automàtic i exigeix nou consentiment.
Canviar selecció cancel·la les lectures anteriors; 403/404 neteja el detall.

## Proves
- TypeScript, build web i 18 proves unitàries (incloent mètodes/rutes negatives).
- E2E connectada: BF Connect/Agreements → declaració B → tercers C denegats →
  confirmació A/B → evidència v2 → conflicte real v2/v3 → disputa A → retirada B.
- Regressió d'historial, cap accés al projecte privat, selecció amb resposta
  retardada i recuperació de fallada de llista. C és un tercer actor OIDC efímer.
- Execució local de Chromium bloquejada abans del test per socket EPERM.
  No equival a resultat funcional; CI GitHub ha d'executar la suite completa.

## Fora d'abast
Safari/iOS i VoiceOver reals (#55), verificació independent, disputes resoltes
per autoritat, portafoli públic opt-in i retenció/exportació. #23 continua oberta.
Cap publicació del Site, modificació de main ni desplegament Azure.
