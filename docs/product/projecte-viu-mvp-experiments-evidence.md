# Projecte Viu MVP — Proves i evidències (#12–#13 / #6–#7)

> **Estat:** increment backend de desenvolupament en PR apilada; no desplegat, no integrat a la UI BF i no dona per resolta la #27.

## Recorregut funcional mínim
1. La persona autenticada crea o reprèn una `IdeaDraft` privada de la #11.
2. La persona crea una prova associada, amb pregunta, mètode i criteri de contrast predefinit.
3. Registra un resultat (supportive, unsupported o inconclusive) i fins a deu referències d'evidència en la mateixa operació.
4. Pot declarar evidències addicionals associades al resultat; una referència continua marcada `declared`, **mai** `verified` sense una revisió posterior.
5. L'historial de resultats és append-only; cap endpoint esborra ni sobreescriu resultats anteriors.
6. L'usuari B no pot llistar ni llegir el projecte de l'usuari A, ni afegir-hi dades.

## Endpoints de desenvolupament (tots requereixen OIDC + context privat)

| Mètode i ruta | Funció |
|---|---|
| GET `/v1/idea-drafts/{draft_id}/experiments` | Llistar les proves pròpies |
| POST `/v1/idea-drafts/{draft_id}/experiments` | Preparar una prova |
| GET `/v1/idea-drafts/{draft_id}/experiments/{experiment_id}/results` | Llistar resultats i evidències |
| POST `/v1/idea-drafts/{draft_id}/experiments/{experiment_id}/results` | Registrar resultat nou |
| POST `/v1/idea-drafts/{draft_id}/experiments/{experiment_id}/results/{result_id}/evidence` | Afegir evidència declarada |

L'API retorna 404 per recursos aliens per reduir el risc d'enumeració, i 422 per payloads amb camps no permesos, invalids o fora de límit.

## Persistència
- Migració Alembic `0007` amb `down_revision=0006` sobre la reconciliació de #27.
- `project_experiments` (draft_id, owner_id, pregunta, mètode, criteri, estat, created_at).
- `experiment_results` (experiment_id, owner_id, outcome, observations, created_at).
- `experiment_evidence` (result_id, owner_id, reference, source_note, review_status=declared, created_at).
- Foreign keys compostes `(id, owner_id)` per impedir associar accidentalment dades de propietaris diferents.
- PostgreSQL: `ENABLE + FORCE ROW LEVEL SECURITY` als tres recursos; polítiques de lectura/inserció pròpies; només `project_experiments` permet UPDATE.
- El rol `incfs_api` rep només operacions necessàries.
- Guard d'arrencada productiva comprova les deu taules protegides (5 existents + idea_drafts + knowledge_sources + 3 noves).

## Fora d'abast actual
- Edició de proves, adjunts reals, fitxers, consentiments, col·laboració, Inc Proof, Knowledge Passport, decisions #14, Inc AI real, suport multipropietari i permisos per equips.
- No vincular BF productiu ni fer públic el seu contingut; només el pilot fictici #46.
- L'esquema encara està vinculat a `IdeaDraft` com a primera entitat de Projecte Viu. Unificar-lo més tard amb `ProjectVault` exigeix contracte específic.

## Proves de sortida
- `uv run ruff check campus_api migrations tests`
- `uv run ruff format --check campus_api migrations tests`
- `uv run pytest -q` amb SQLite de proves i PostgreSQL efímer.
- RLS sobre deu taules, rol real no privilegiat, cross-owner denegat.
- Migracions `upgrade head` i `downgrade base` comprovades al CI, sense executar res sobre producció.
- Revisió de la UI Next.js i E2E autenticada encara pendents.

## Ruta BF d'exemple (dades fictícies)
```
POST /v1/idea-drafts
{"question":"Com comprovem l'interès pel model BF 1-of-1?","name":"BF — Be First"}
POST /v1/idea-drafts/{draft_id}/experiments
{"question":"La proposta 1-of-1 s'entén?","method":"Presentar conceptes ficticis","success_criterion":"Identificar objeccions"}
POST /v1/idea-drafts/{draft_id}/experiments/{experiment_id}/results
{"outcome":"inconclusive","observations":"Mostra insuficient","evidence":[{"reference":"demo-bf-001","source_note":"Prova fictícia"}]}
```


## Suport a esborranys incomplets i reformulacions (#6/#12)
- `POST /v1/idea-drafts/{draft_id}/experiments` pot rebre un cos buit: crea una prova amb estat `draft`.
- Els camps de pregunta, mètode i criteri poden completar-se progressivament amb `POST /v1/idea-drafts/{draft_id}/experiments/{experiment_id}`.
- `POST /v1/idea-drafts/{draft_id}/experiments/{experiment_id}/activate` exigeix els tres camps i canvia a `active`; no es poden registrar resultats abans de l'activació.
- Una prova activa o completada no es pot reescriure com a esborrany. Una reformulació és un **nou experiment** amb `reformulates_id` que ha de referenciar una prova completada del mateix propietari i projecte.
- El resultat antic i les evidències associades no s'eliminen amb aquesta reformulació.
- Continua pendent desenvolupar la UI integrada i el flux de decisions i retenció de #14; el resultat no s'aprova per a Inc AI.
