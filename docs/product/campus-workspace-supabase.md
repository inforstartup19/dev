# TFG/TFM: espai de treball i Supabase DEV

## Increment preparat el 16 de novembre de 2026

PR #88 apilada sobre #85. Base Supabase DEV creada i esquema aplicat; interfície encara local i no publicada al Site.

- Rutes `#treball-tfg` i `#treball-tfm`, accessibles des de les demos acadèmiques existents.
- Tauler amb cinc estats, tasques/fites, responsable, data, objectiu, mètode, entrega, criteris i bloqueig.
- Dependències i recorregut derivats del mateix model. Rebuig de cicles i referències inexistents.
- Presentacions immutables, retorn explicat, revisió docent simulada i historial.
- Exportació JSON; conflictes coneguts entre pestanyes detectats abans de desar. LocalStorage no ofereix transaccions: la comprovació no garanteix exclusió entre escriptures simultànies.
- Text pendent en memòria per TFG/TFM durant la sessió, avís abans de tancar; encara no és recuperació persistent completa de #86.
- Adaptador REST amb sessió injectada i actualització condicionada per revisió. No es carrega al navegador fins a verificar Supabase.

## Base de proves

L’organització confirmada és IncForStartUp (`ekcxzlpqfnunfhoavxwv`). Projecte `quelcom-campus-dev` creat amb autorització d’Omar, pla Free i regió `eu-west-1`. Ref: `shnitfrpgzhwobsuotdl`. Cost consultat: 0 mensual. BF no s’ha modificat. El possible canvi futur al pla de 25 USD no s’ha executat.

`supabase/schema/academic-workspace.sql` conté el SQL aplicat remotament com `20261116231210_academic_workspace` mitjançant el connector. El comentari inicial conserva el context de preparació original; el registre autoritatiu de desplegament és `supabase/deployment-dev.json`. La prova SQL transaccional de `supabase/tests/academic-workspace-rls.sql` ha passat a PostgreSQL DEV. Inclou projectes, membres, tasques, dependències, esdeveniments i presentacions. RLS restringeix l’accés al projecte; el docent es determina per membresia administrada al servidor. No s’utilitza el selector de demo ni user_metadata com a autorització.

Abans de connectar la interfície:

1. Fet: projecte creat i esquema públic buit comprovat abans d’aplicar DDL.
2. Fet: migració aplicada i historial remot verificat. Advisors de seguretat sense avisos; rendiment només informa de sis índexs encara no utilitzats. Conservar-los fins a mesurar càrrega real.
3. Fet amb identitats SQL transitòries: aïllament de lectura/escriptura, revisió exclusiva docent, autoconcessió de membresia denegada, snapshots immutables, rebuig de revisió obsoleta i cicle de dependències. Pendent: sessions Auth reals, Data API i concurrència entre transaccions simultànies. Fixtures eliminades amb ROLLBACK: zero usuaris/projectes/tasques després de provar.
4. Connectar Auth real i l’adaptador. Cap importació automàtica dels esborranys locals: previsualització i confirmació per projecte.
5. Reconciliar amb FastAPI/Alembic i l’OIDC/BFF existent abans d’integrar cap a dev. Aquest experiment Supabase no substitueix el backend ni la identitat del portal.

## Ordre dels següents increments

1. **Tauler i persistència real**: acabar comprovacions RLS, sessió, importació voluntària i recuperació persistent d’esborranys.
2. **Documents versionats**: reutilitzar el contracte de vaults del backend. Bucket privat, límits i tipus, quarantena/verificació, versions no sobreescrivibles, fitxers vinculats a una tasca i entrega. No presentar un nom de fitxer com si s’hagués pujat. Provar lectura no autoritzada, revocació, càrrega interrompuda i reintent sense duplicats.
3. **Recorregut complet**: dependències persistides i auditades, ordenació topològica i fites. Les edicions docents han de mostrar-se a l’estudiant, i una versió presentada ha de congelar també les dependències.
4. **Connexió entre TFG/TFM**: només resum explícitament compartit, petició amb finalitat, acceptació bilateral, permisos per document, revocació. Reutilitzar Inc Connect/Agreements; no crear accés complet al projecte per acceptar una connexió.
5. **Pilot**: estudiant, docent i segon campus en sessions reals; PC i iPhone 15 Pro. No confondre un selector local amb una prova d’autorització.

## Verificació d’aquest increment

49 proves Node passen (41 anteriors i 8 de domini/transport). Sintaxi JS comprovada. Prova PostgreSQL/RLS passada amb dades temporals i ROLLBACK. Sense prova de navegador, Supabase Auth o Storage en aquest increment. No hi ha càrrega de documents, correu, integració universitària ni autenticació nova activa.

Referències consultades: https://supabase.com/changelog.md, https://supabase.com/docs/guides/database/postgres/row-level-security, https://supabase.com/docs/guides/storage/security/access-control.

Actualització: 17 de novembre de 2026 (Europe/Madrid). Advisor de rendiment: https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index.
