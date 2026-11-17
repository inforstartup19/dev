# #84 — consolidació Quelcom / portal connectat

## Increment del 17/11/2026

Base: `dev` f594453. La demo Site publicada v57 queda intacta per al recorregut #126.
La portada/esferes aprovades es porten a components React i renderitzadors amb
cicle de vida explícit (origen Site 9d6bcaf). No s'importen els wrappers globals de
`render`, els selectors de rol demo ni les dades fictícies del Site.

- `/entrada` → `/univers`: esfera Quelcom, satèl·lits independents, viatge, fallback
  sense Canvas i moviment reduït. Sense botó de pausa ni fletxes visibles.
- `/univers`: només les quatre esferes; Campus → `/campus`, Idea → `/idees`,
  Projecte → `/projectes` → `/idees`, Startup → `/startup`.
- Navegació de treball → «Els quatre espais», sense enllaç a la portada inicial.
- `INC_SPACE_ENTRANCE=1` habilita el recorregut a `/`; per defecte no modifica
  l'entrada existent abans del QA Safari. `/entrada` es pot revisar sempre.
- `/idees` conserva Projecte Viu React/API existent (proves, evidències, decisions,
  necessitats i permisos). Canviar d'espai no crea projectes ni dona permisos.
- Identitat no configurada en mode connectat: cap fallback automàtic a desat local.

## Traspàs local → compte: límit deliberat

Només fitxes curtes `incforstartup-idea-drafts-v1`. L'usuari llegeix explícitament
el navegador o selecciona un JSON; previsualitza una fitxa, veu el compte i confirma.
No hi ha lectura local automàtica en iniciar sessió. No esborrem ni modifiquem l'original.
Es pot cancel·lar abans de confirmar. No hi ha sincronització ni rollback remot.

`POST /v1/idea-drafts/local-import` requereix el context privat existent. El nou ID
és UUIDv5 derivat de propietari verificat + ID local + namespace versionat, amb
privacitat per defecte. Reintentar el mateix contingut retorna el mateix registre;
canvis conflictius retornen 409 sense sobreescriptura. La clau primària resol la
concurrència; l'API no accepta owner/visibility/historial del client. No cal migració SQL.

Els JSON de Projecte Viu del Site, TFG/TFM, documents, origen acadèmic i altres
camps no suportats es rebutgen sencers. La migració completa preservant aquests
historials continua pendent; aquest increment NO la presenta com a resolta.

## Protecció de text

Fitxa local: comparació amb el snapshot de storage abans de desar; conflicte de
pestanya bloqueja l'escriptura i conserva camps. Exportació de fitxes desades i de
camps pendents. És detecció de conflictes, no una transacció entre pestanyes.
Fitxa connectada: exportació explícita dels camps, sense persistir-los localment
per defecte. Avís en recàrrega/tancament i captura dels enllaços per evitar sortir
accidentalment amb canvis. El JSON de camps pendents és una còpia recuperable
manualment, no un format de migració acceptat.

L'avís de navegador no garanteix recuperació si iOS mata la pestanya. Encara cal
#86 per recuperació integral, navegació d'historial i formularis interns de proves,
resultats i decisions. No afirmem que tots els formularis ja tinguin autosave.

## Validació

- TypeScript i build de producció correctes.
- Frontend: 20 proves unitàries correctes (preview estricte, payload i allowlist).
- API SQLite: 128 passed, 9 skipped (dependents PostgreSQL/RLS).
- Ruff, diff whitespace i check_repo correctes.
- Tests Playwright afegits: entrada/4 esferes, focus, fallback, amplades
  320/393/430/1280, conflicte entre pestanyes, exportació i confirmació de còpia
  amb sessió OIDC aïllada. Cal resultat CI; no s'han executat localment.
- Preview gestionat: arrencada incompatible, injecta `--host/--strictPort` que Next
  no accepta. No es modifica l'aplicació per compensar l'entorn. QA visual local
  i Safari físic no verificats en aquest increment.

## Reconciliació i següents portes

#78/#81/#82 es reconcilien adoptant aquesta implementació React sobre `dev`,
no fusionant cegament les variants antigues de portada. Cal revisar l'estat de les
PR i marcar-les substituïdes només després d'integrar i validar aquesta versió.
#85–#129 continuen conservant el treball Site acadèmic; no es fusionen ni es tanquen.

La #84 roman oberta: QA #55, migració completa amb provenance i reversibilitat,
recuperació #86, permisos/invitacions A/B/C, consentiment de publicació i cites
protegides han de passar pel recorregut integrat. Supabase Auth #90 i proveïdors
#83 continuen pendents d'activació; aquesta PR usa l'OIDC/API existent i no els simula.
Cap canvi Azure, secrets, configuració de Supabase o desplegament del Site.

### Resultats CI del primer increment

Commit `a7817fed`: circuit connectat OIDC/API amb **10 proves E2E superades**
[execució 44125794333](https://github.com/inforstartup19/dev/actions/runs/44125794333).
L'API supera PostgreSQL i SQLite
[execució 44125794121](https://github.com/inforstartup19/dev/actions/runs/44125794121).
El primer test web detecta un selector ambigu entre l'alerta de conflicte i
l'anunciador intern de Next: s'acota a l'alerta amb el text del conflicte, mantenint
la mateixa comprovació de comportament. Entrada, focus, fallback i amplades ja passen.
