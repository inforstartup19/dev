# #89 — Consolidació de Supabase: primer increment

Estat: inventari verificat i proposta de reconciliació; migració no executada.
Data: 17 de novembre de 2026. Supabase DEV: shnitfrpgzhwobsuotdl.

## Evidència actual

- Backend: 37 taules SQLAlchemy i 14 revisions Alembic; head 0014 (codi preparat; no aplicat a Supabase).
- Supabase DEV: sis taules qc_*, totes amb RLS activat i polítiques. Comptes auth, projectes, membres i tasques: zero en la consulta d’aquest inventari. No extrapolar aquest recompte a altres entorns.
- El backend genera users.id propi i associa auth_subject a issuer|subject. Les seves polítiques privades consulten app.actor_id.
- Supabase qc_* referencia auth.users.id i consulta auth.uid(). No són identificadors intercanviables.
- L’autenticació actual només accepta RS256 i pot exigir scp/scope, azp/appid i acrs d’Entra. #90 ha de verificar el contracte real de Supabase; no desactivar validacions globalment ni acceptar algoritmes escollits pel token.
- Documents del backend depenen d’Azure Blob i identitats gestionades; Supabase Storage necessita un adaptador amb les mateixes garanties de quarantena i versions (#91).
- No s’ha consultat cap base de dades productiva ni s’ha determinat l’existència de dades productives.

## Destinació proposada

Supabase allotja PostgreSQL principal i Auth. FastAPI conserva les regles de negoci i l’autorització dels dominis existents. Proposo traslladar les taules del backend a un esquema privat inc_core, no exposat a la Data API. És una decisió pendent d’implementar i verificar: canviar search_path sense revisar SQL cru i Alembic no és suficient.

Les taules qc_* són una extensió acadèmica de DEV. No es tracten com una substitució del model complet ni s’hi copien tots els dominis. Durant la reconciliació, no activar doble escriptura ni donar als clients accés a les taules del backend.

| Concepte | Backend existent | Supabase DEV | Tractament necessari |
|---|---|---|---|
| Persona | users.id + auth_subject | auth.users.id | Taula de correspondència verificada; conservar identificadors interns. Mai fusionar per correu |
| Espai docent | spaces, space_memberships, teams | Sense equivalent | Conservar domini universitari; no fabricar-lo a partir de qc_members |
| Projecte acadèmic | projects vinculat a equip | qc_projects amb propietari | Vinculació explícita; revisar semàntica i membresies abans de migrar |
| Projecte privat | project_vaults, vault_memberships | Sense equivalent complet | Preservar límit de visibilitat; ser docent no dona accés al vault |
| Entrega/revisió | submissions, reviews amb rúbrica | qc_submissions de tasca | No equivalen: conservar tipus, historial i criteris sense inventar notes |
| Tasques/fites | Experiments i decisions del projecte | qc_tasks, qc_dependencies | Dissenyar connexió de tasca a projecte; no convertir experiments en tasques automàticament |
| Auditoria | audit_events, vault_events i esdeveniments de domini | qc_task_events | Conservar actor, timestamps, versions i origen; no reescriure història |
| Documents | vault_documents + Azure Blob | Storage pendent | Adaptador, verificació d’objectes i permisos; cap URL pública automàtica |

## Primer codi de suport

`python scripts/audit_supabase_consolidation.py` llegeix l’AST dels models/migracions sense executar-los i compara el pla amb el snapshot de catàleg. Detecta taules desconegudes, mappings obsolets, heads modificats, migracions cícliques o amb pares absents, projecte incorrecte i taules sense RLS/polítiques.

El snapshot es recull mitjançant consulta de metadades de només lectura, guardada a supabase/audit/catalog-query.sql. No inclou files d’usuaris, tokens o documents. Cal refrescar-lo abans de cada pas real: l’auditor no connecta a Supabase ni detecta canvis posteriors al snapshot.

Sortida correcta d’inventari no autoritza migració: el camp cutover_status sempre ho indica. Comptar polítiques no demostra que siguin correctes; les proves RLS adversarials són un pas separat.

## Seqüència següent de #89 i #90

1. Fixar la correspondència d’identitats i el vincle de projectes, amb restriccions úniques i referencials.
2. Preparar migracions versionades per esquema privat; rol de migració separat del runtime NOBYPASSRLS, no propietari. El navegador no rep credencials SQL ni service_role.
3. Adaptar i provar el verificador de tokens a l’issuer, audience, signatura i claims reals del projecte DEV. Les sessions de prova han d’estar separades, sense reutilitzar el selector local.
4. Assajar les 13 revisions i els contractes acadèmics en un entorn aïllat; comprovar constraints, índexs, RLS i privilegis. No aplicar cegament Alembic a public.
5. Si hi ha fonts amb dades, extreure manifest amb nombre de files, checksums on pertoqui, IDs, versions i relacions. Detectar orfes, duplicats i conversions impossibles. Importació local només amb previsualització i consentiment.
6. Assajar restauració i rollback abans del tall. Capturar també les escriptures posteriors al tall: tornar a una còpia antiga no pot descartar treball nou. Decidir finestra de pausa de canvis i punt de reconciliació; evitar dual-write sense outbox.
7. Verificar circuits i permisos amb sessions reals; després planificar preproducció i producció.

No s’han creat recursos Azure, canviat plans, mogut dades ni connectat la UI en aquest increment. #89 queda oberta. #86 conserva QA visual pendent; no s’ha tancat per avançar aquesta feina independent.

## Correspondència d'identitats — increment 0014

`user_identities.auth_subject` conserva exactament la clau verificada `issuer|sub`
existent i la relaciona amb `users.id`. La migració copia els usuaris existents;
no altera identificadors, pertinença a equips, projectes ni permisos. Els nous accessos
creen l'usuari i la correspondència en una sola transacció. No es vincula per correu,
nom, metadades de perfil o rols declarats al token.

La taula és d'ús exclusiu del backend, com `users`: no té endpoint de consulta o
edició, ni s'ha de publicar a la Data API. El desplegament a Supabase continua
bloquejat fins a configurar l'esquema privat, privilegis i proves PostgreSQL amb
el rol real. El rol API necessita SELECT i INSERT sobre user_identities, sense
UPDATE ni DELETE; el rol de migració és diferent. L'esquema inc_core continua sent
una proposta: aquesta migració utilitza l'esquema actual d'Alembic.

Una identitat addicional només es podrà donar d'alta mitjançant un futur procés
verificat i auditat que acrediti control dels comptes. Aquest increment no ofereix
vinculació pública ni migració automàtica a Supabase Auth; la configuració JWT,
revocació/desvinculació i MFA continuen pendents de #90. No s'ha modificat la
validació de tokens existent. No s'han creat usuaris reals ni modificat Supabase.

El downgrade 0014 refusa eliminar la taula si hi ha identitats addicionals: primer
cal reconciliar-les amb un pla que preservi l'accés. Amb només les identitats
originals es pot tornar a 0013 i tornar a pujar, mantenint els mateixos usuaris.
