# Federated Inc Spaces — contracte de seguretat #32–#35

**Estat 15/11/2026:** especificació, no codi de federació implementat ni pilot universitari real. Cap dada real ni desplegament Azure. El que ja existeix: Projecte Viu privat, necessitats compartibles, contacte consentit, acord bilateral i Inc Proof privat.

## Cas sintètic A → B → C

- **A universitat:** un professor gestiona una activitat acadèmica i un projecte A privat (fitxa, evidències i notes només amb ACL A).
- **B startup BF:** Projecte Viu propi privat, necessitat projectada i compartida explícitament amb una audiència; acceptació de petició de contacte, acord versió N, aportació Proof i font de coneixement aprovada.
- **C organització externa:** comença sense dret ni presència. Després d'una sol·licitud/acceptació separada i un objecte compartit explícit pot consultar **només** la projecció autoritzada. En sortir o retirar-se, perd lectures futures.

## Nou espai federat no ha de clonar projectes

`collaborative_space` (id, objectiu, propietari i estat) és un agregador d'objectes aprovats, no un contenidor que reassigna ACL dels projectes pare.

`space_participant` = relació de subjecte institucional/professional amb rol i aprovació humana, **no** accés a dades per defecte.

`space_resource_grant` = objecte font, versió, dret `view|contribute`, audiència, propietari, validesa temporal, aprovacions requerides i revocació. Un grant del resum de necessitat mai obre la fitxa/experiments/document originals.

`space_activity` = acció compartida amb ID canònic i projeccions diferents per projecte. Prova/resultat i Proof citen sources amb permisos en el moment de cada lectura, no només en la publicació.

`governance_charter` = política versionada per decisions, tipus, rols, quòrum, recomanació IA, pausa/tancament, dret de sortida i responsables; **un agreement acceptat no crea aquesta política automàticament**.

## Línia de temps governada

`draft → pending_approvals → active ⇄ paused → closing → closed`; `cancelled` si falla el consentiment abans d'activar-se.

1. Crear espai sense membres ni dades de projectes.
2. Proposar enllaç/necessitat objecte per objecte i preview exacta.
3. Confirmació d'actors/organitzacions amb rol i autoritat verificats; no inferir aprovació només per faceta.
4. Activar grants després de proves RLS, i registrar expiració/TTL.
5. Inc AI només recupera fonts aprovades accessibles a l'actor i cita versió/autor; ni suggereix contingut ocult ni escriu la política.
6. Pausar deshabilita noves accions de l'espai però preserva historial. Revocar un grant talla lectures noves, cerques i futures cites. No prometre eliminar còpies que tercers ja hagin descarregat.
7. Sortida de C inicia revisió de compromisos, cancel·lació de grants, suspensió d'accions dependents, evidències de notificació i continuïtat governada A–B.

## Contracte d'autorització únic

`allow(actor, resource, action, context)` requereix:
- identitat OIDC activa i política institucional/espai verificades,
- pertinença institucional/curs/grup si l'objecte és acadèmic,
- ACL del **recurs original** i del **grant de projecció**,
- versió vigent, estat del recurs, finalitat, TTL i absència de revocació,
- per document/evidència/retrieval una comprovació final al backend i RLS; no confiar en la UI, memòria de conversa o caché.

Negacions 404 per objecte no visible (no revelar existència), 403 per operació prohibida sobre recurs conegut de manera legítima, 409 per versió obsoleta.

## Matriu E2E abans del pilot real

| Usuari | Accés esperat |
| --- | --- |
| A | Projecte privat A + projeccions pròpies; sense contingut privat B/C |
| B | Projecte privat B + necessitat projectada d'A si atorgada; sense notes docents |
| C abans d'entrar | 404 sobre projectes i recursos A/B, cap resultat en discovery/RAG |
| C acceptat | només acció/necessitat/prova amb grant i versió explícits; mai projectes pares |
| C revocat | 404 en URL directa, API, cerca, cache i recuperació IA; història d'A/B intacta |
| Usuari D no participant | 404 sobre tot l'espai privat i qualsevol objecte no compartit |

Proves obligatòries: SQLite + PostgreSQL sota rol no privilegiat, concurrència acceptació/revocació, expiració, canvi de charter i quòrum, disputes, revalidació de cites, memòria/cache, càrrega, retries, navegació mòbil i restore d'Alembic. Cap afirmació sobre Federació E2E aprovada sense proves executades.

## PRs suggerides, després d'Inc Proof i ACL

1. `#32.1` models `collaborative_space`, membership i resource grants, **sense migrar res del projecte pare**; tests de C negatius.
2. `#37.1` charter, aprovacions i auditoria per rol; cap autoconcessió.
3. `#33.1` lifecycle amb pausa, sortida i revocació, TTL de grants; relectura autoritzada.
4. `#35.1` E2E sintètic A universitat → B BF → C partner → C surt, amb recuperació de cites RAG i evidències.
5. `#49` només després: cloud DEV autoritzat, PREPROD i PROD amb backups, pressupostos, revocacions i controls d'identitat revisats.

**Dependències**: #20, #21, #22, #23, #24, #32, #33, #37–#40, #49, #60. No confondre un document de disseny amb una funcionalitat distribuïda.
