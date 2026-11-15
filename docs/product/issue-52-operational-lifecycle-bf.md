# #52 — Projecte Viu 2.0: cicle operatiu governat, BF pilot

## Contracte real (branca de PR #53 cap a `dev`)

**Abast del pilot:** es treballa sobre `idea_drafts` privats, amb titularitat individual de l'usuari OIDC verificat. No s'apliquen automàticament aquestes transicions a espais compartits, contractes o a tercers.

- `POST /v1/idea-drafts/{id}/decisions` registra una **decisió històrica**. Per si sola no pausa ni tanca.
- `GET /v1/idea-drafts/{id}/lifecycle` retorna l'**estat operatiu actual**, `version`, accions admissibles i operacions bloquejades.
- `POST /v1/idea-drafts/{id}/lifecycle/transitions` aplica una transició autenticada, amb actor, motiu, versió esperada, idempotència, revisió obligatòria per categoria, nota i condicions de represa quan correspongui.
- `GET /v1/idea-drafts/{id}/lifecycle/events` mostra el registre **append-only** de transicions i la seva justificació.
- `GET|POST /v1/idea-drafts/{id}/assistant/feedback` consulta i registra descart/restauració dels suggeriments només si l'usuari activa consentiment explícit; no és material d'entrenament.

## Màquina d'estats

| Estat d'origen | Acció autoritzada | Nou estat |
| --- | --- | --- |
| active | pause | paused |
| active | close | closed |
| paused | resume | active |
| paused | close | closed |
| closed | reopen | active |

No es poden fer transicions impossibles. `expected_version` i actualització CAS eviten perdre transicions simultànies; `idempotency_key` evita repetir les peticions exactes. Cada transició té un número de versió i un actor. Les claus reutilitzades amb contingut diferent obtenen conflicte 409.

## Efectes implementats, aïllament i reversibilitat

**Pausa/tancament:** la API refusa (409) modificacions a la fitxa, creació/edició/activació de proves, nous resultats i noves necessitats de recursos. La UI deshabilita aquests botons i explica el motiu. Es mantenen lectura de fitxa, proves, decisions, resultats i evidències. És una congelació **selectiva** de noves execucions.

**Represa/reobertura:** requereixen acció explícita i nova revisió; els canvis es registren i tornen a habilitar execució. La reobertura no elimina el tancament històric i no certifica compliment d'obligacions.

**Checklist de revisió:** proves en curs, participants, compromisos/acords i, en tancament/reobertura, retenció i propietat intel·lectual. Cada acció inclou observacions humanes. Aquesta és una **atestació de revisió**, no la verificació d'un contracte extern. Inc no cancela pagaments ni notificacions, no revoca accessos ni mou dades.

**Privacitat:** l'API autentica i verifica propietat abans de cap accés; la RLS PostgreSQL forçada restringeix lectura/inserció dels esdeveniments i del feedback al propietari. No existeixen polítiques UPDATE/DELETE dels registres append-only.

## Escenaris BF amb dades sintètiques

1. BF crea una fitxa i una prova 1-of-1; una decisió `pause` no bloqueja execució perquè és històrica.
2. BF aplica `pause` operativa amb revisió i condicions: noves proves/resultats retornen 409, però l'historial segueix consultable.
3. Represa explícita habilita resultats; pausa anterior no s'esborra.
4. Tancament requereix revisió de retenció; reobertura és independent i versionada.
5. Un segon actor no pot llegir o canviar res (404), ni inferir identificadors alienes a través de l'API.
6. Repetició amb mateixa clau retorna el mateix esdeveniment; versió obsoleta o revisió incompleta produeix conflicte o 422.
7. Suggeriments de l'assistent citen IDs del mateix projecte; el descart persistit requereix opt-in i es pot restaurar.

## Limitacions i portes de qualitat

- Revisions d'acords, notificacions, calendaris, titulars externs i retenció són declaratives; les integracions reals requereixen models de domini, permisos granulars i fluxos de verificació propis.
- No s'han fet operacions sobre Azure, `main` o entorns preprod/prod; la migració `0009` resta sota CI de la PR abans de qualsevol desplegament.
- Verificar `Campus API` (SQLite + PostgreSQL, upgrade/downgrade), `Campus web`, `Campus connected flow` BF, i proves manuals Safari/iOS, teclat i contrast. No donar per validada una comprovació que no ha acabat amb èxit.
- Requisit de seguretat: un estat operatiu no substitueix la decisió d'un administrador d'espai compartit; trasllat a equips necessita #20/#22/#37/#39.

## Relació amb la visió IncForStartUp

El model és sector-neutral: BF és només el primer pilot. La mateixa seqüència `decisió → atestació → transició → verificació` servirà per a idees universitàries, startups i altres sectors sense fer pública la informació privada ni convertir l'assistent en una autoritat automàtica.
