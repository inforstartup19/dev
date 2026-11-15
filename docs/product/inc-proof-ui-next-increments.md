# Inc Proof — contracte UI i PR següents (#23)

## Increment actual: accions disponibles
`ProofOut` incorpora `can_add_evidence`, `can_attest`, `can_withdraw`.
Derivats al servidor de l'actor, l'estat i les atestacions de la versió actual;
no exposen identificadors de tercers. No són tokens d'autorització: tots els POST
continuen comprovant permisos i expected_version. Una revisió pot deixar el
client obsolet; un 409 obliga a refrescar dades i demanar una nova decisió.
Una disputa ja emesa impedeix una segona atestació d'aquella versió.

## PR següent: panell autenticat (#23, abans de #77)
- Component germà d'IncConnectPanel, emprant privateJson i la mateixa frontera autenticada.
- GET proofs + agreements; declarar només sobre acord confirmat. El servidor és autoritat.
- Detall seleccionat: GET proofs/{id}/evidence i /attestations, amb cancel·lació
  o guarda de resposta obsoleta quan canvia selecció o identitat.
- Mostra versió i estats declared/participant_attested/bilaterally_attested/disputed/withdrawn
  amb text català; cap etiqueta de certificació professional.
- Formularis d'evidència (procedència/versió/drets), atestació/disputa i retirada
  amb confirmació explícita. No obrir source_reference com a URL executiva.
- Accions segons capability; API revalida permisos. Errors 403/404 sense dades
  residuals; 409 refresca sense reenviar automàticament.
- Llistar atestacions històriques amb versió: no presentar-les com vigents.
- Cap publicació ni accés al projecte privat per crear/confirmar una aportació.

## Porta abans de revisió de la UI
E2E BF A/B: acord confirmat, declaració B, prova/evidència, confirmació A/B,
revisió que invalida atestacions, disputa i retirada per B. C no pot veure
llista, detall, evidències o atestacions. Afegir escenari de selecció ràpida,
error de càrrega i conflicte 409 sense estat penjat. API SQLite/PostgreSQL RLS,
web typecheck/build i E2E connectada han de passar. Safari real continua #55.

## Ordre executable de les PR
1. #78: port estàtic d'entrada #75, revisar CI i QA abans de fusionar.
2. Contracte de capabilities #23: revisió API i PostgreSQL, independent de #78.
3. UI Inc Proof #23 amb E2E A/B/C, sobre el contracte validat.
4. #77: adaptació de la portada a apps/web amb CSS encapsulat i QA #55.
5. #76: refinament visual, variants al Site i mètriques de rendiment.
6. #24/#40: verificació/procedència/cites protegides; #21/#22 antiabús durador.
7. #60/#62 continuen separats. #61/#49 i federació runtime #32–35 conserven gates.

No obrir PR buides per treball futur: aquest pla en defineix l'abast. Cap merge,
main, Azure o tancament d'èpics s'infereix d'una PR preparada.
