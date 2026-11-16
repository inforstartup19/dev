# TFG/TFM: espai de treball i Supabase DEV

## Increment preparat el 16 de novembre de 2026

Branca independent de la PR #85. No publicat al Site ni connectat a Supabase.

- Rutes `#treball-tfg` i `#treball-tfm`, accessibles des de les demos acadèmiques existents.
- Tauler amb cinc estats, tasques/fites, responsable, data, objectiu, mètode, entrega, criteris i bloqueig.
- Dependències i recorregut derivats del mateix model. Rebuig de cicles i referències inexistents.
- Presentacions immutables, retorn explicat, revisió docent simulada i historial.
- Exportació JSON; conflictes coneguts entre pestanyes detectats abans de desar. LocalStorage no ofereix transaccions: la comprovació no garanteix exclusió entre escriptures simultànies.
- Text pendent en memòria per TFG/TFM durant la sessió, avís abans de tancar; encara no és recuperació persistent completa de #86.
- Adaptador REST amb sessió injectada i actualització condicionada per revisió. No es carrega al navegador fins a verificar Supabase.

## Base de proves

L’organització confirmada és IncForStartUp (`ekcxzlpqfnunfhoavxwv`). Nom proposat: `quelcom-campus-dev`, regió europea. El connector ha retornat cost de projecte 0 mensual. Pendent de confirmació final de creació segons el flux del connector. L’únic projecte existent és BF; no s’ha modificat.

`supabase/schema/academic-workspace.sql` és un candidat de revisió **no aplicat ni validat contra PostgreSQL**. No és una migració registrada. Inclou projectes, membres, tasques, dependències, esdeveniments i presentacions. RLS restringeix l’accés al projecte; el docent es determina per membresia administrada al servidor. No s’utilitza el selector de demo ni user_metadata com a autorització.

Abans de connectar la interfície:

1. Crear el projecte de proves autoritzat i inspeccionar esquemes/configuració.
2. Provar el candidat en DEV, generar migració amb CLI descobert via `--help`, executar advisors.
3. Provar amb estudiant A, docent A i estudiant B: lectura/escriptura creuades, revisió exclusiva docent, impossibilitat d’autoconcedir membresia, versió immutable, conflictes de revisió i cicles concurrents.
4. Connectar Auth real i l’adaptador. Cap importació automàtica dels esborranys locals: previsualització i confirmació per projecte.
5. Reconciliar amb FastAPI/Alembic i l’OIDC/BFF existent abans d’integrar cap a dev. Aquest experiment Supabase no substitueix el backend ni la identitat del portal.

## Ordre dels següents increments

1. **Tauler i persistència real**: acabar comprovacions RLS, sessió, importació voluntària i recuperació persistent d’esborranys.
2. **Documents versionats**: reutilitzar el contracte de vaults del backend. Bucket privat, límits i tipus, quarantena/verificació, versions no sobreescrivibles, fitxers vinculats a una tasca i entrega. No presentar un nom de fitxer com si s’hagués pujat. Provar lectura no autoritzada, revocació, càrrega interrompuda i reintent sense duplicats.
3. **Recorregut complet**: dependències persistides i auditades, ordenació topològica i fites. Les edicions docents han de mostrar-se a l’estudiant, i una versió presentada ha de congelar també les dependències.
4. **Connexió entre TFG/TFM**: només resum explícitament compartit, petició amb finalitat, acceptació bilateral, permisos per document, revocació. Reutilitzar Inc Connect/Agreements; no crear accés complet al projecte per acceptar una connexió.
5. **Pilot**: estudiant, docent i segon campus en sessions reals; PC i iPhone 15 Pro. No confondre un selector local amb una prova d’autorització.

## Verificació d’aquest increment

49 proves Node passen (41 anteriors i 8 de domini/transport). Sintaxi JS comprovada. Sense prova de navegador, PostgreSQL, Supabase Auth o Storage en aquest increment. No hi ha càrrega de documents, correu, integració universitària ni autenticació nova activa.

Referències consultades: https://supabase.com/changelog.md, https://supabase.com/docs/guides/database/postgres/row-level-security, https://supabase.com/docs/guides/storage/security/access-control.
