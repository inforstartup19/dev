# Campus real: accés, treballs i biblioteca del pilot

Actualització: 18 de novembre de 2026.

## Abast desplegat

El pilot dona accés només a Campus després del login verificat a Supabase. Les rutes antigues d’Idea, Projecte i Startup retornen a Campus. Es conserva la portada Quelcom i la compartició actual del Site. Està preparat per a dos docents (Omar i un convidat) i tres estudiants inicials, sense un límit codificat de participants.

L’estudiant crea un TFG, TFM o TR (Treball de recerca). Només el títol és obligatori. Pot completar centre, titulació/curs, objectiu, mètode i proper pas, afegir tasques lliures i adjuntar PDF privats. No ha de completar una seqüència de cinc tasques ni el recorregut de startup. El docent assignat pot editar la fitxa, afegir tasques i donar retorn.

Els formularis nous utilitzen Supabase Postgres i Storage. No són la demo de localStorage. Els esborranys antics no s’importen automàticament. El text pendent es conserva en memòria durant errors i es pot exportar abans de recarregar; no és un esborrany durable fins que el servidor confirma el desament. Les actualitzacions utilitzen revisió optimista per evitar sobreescriure canvis d’un altre dispositiu.

## Donar d’alta els participants

Encara no hi ha correus autoritzats ni participants donats d’alta. Cal recollir, en privat, el correu que retorna el proveïdor de login, el rol i el centre educatiu. No publicar el llistat a GitHub, issues, assets ni captures. No s’ha enviat cap invitació per correu.

1. El coordinador afegeix el correu normalitzat a `qc_private.pilot_invites` des d’una operació administrativa protegida. Assigna `student` o `teacher`, el centre i la caducitat de l’acceptació. No cal crear contrasenyes ni usuaris Auth manualment.
2. Per als dos docents autoritzats a supervisar tot aquest pilot, estableix `supervise_all=true`. Això assigna els treballs existents quan accepten i els nous treballs que es creen després. Per a un docent amb abast limitat, mantén `false` i crea únicament les files necessàries a `qc_members`.
3. Mantén els estudiants amb `supervise_all=false`. Un estudiant només accedeix als seus treballs. No existeix cap formulari públic per atribuir-se el rol docent.
4. Comparteix el Site amb els participants com a visitants, d’acord amb la seva audiència custom. La compartició Sites és una capa independent del compte i dels permisos Supabase. No donar-los accés d’editor ni accés al tauler de Supabase.
5. Envia o comparteix l’enllaç del portal amb el participant. L’alta administrativa no envia un email automàticament. GitHub i Microsoft constaven disponibles en la comprovació; Google, Apple i l’enllaç per correu continuaven desactivats.
6. El participant inicia sessió amb el correu autoritzat. `qc_accept_pilot()` comprova l’email verificat d’Auth, la invitació, caducitat/revocació i la identitat vinculada. Accepta el rol al servidor. Sense invitació activa veu una pantalla d’espera.
7. L’estudiant crea la fitxa i omple dades. Els docents autoritzats la recuperen amb el seu propi compte. Per retirar l’accés, marca `revoked_at` a la invitació o `active=false` a `qc_pilot_people`. RLS denega les peticions següents; el contingut ja descarregat no es pot retirar del dispositiu del receptor.

La caducitat de 30 dies és per acceptar la invitació, no una caducitat de la participació acceptada. Canviar el correu de login o el rol requereix revisió administrativa explícita; editar l’email no transfereix permisos automàticament. Les identitats no s’autoritzen amb `user_metadata` ni pel domini universitari.

## Dades privades i documents

- `qc_projects`, `qc_tasks`, `qc_members`, `qc_project_events`, `qc_task_events` i `qc_submissions` són privats per treball. L’historial identifica actor i rol i conserva instantànies de fitxa/tasques.
- RLS comprova tant la participació activa com l’autoria o assignació al treball. Un login vàlid per si sol no dona accés als casos reals.
- Bucket privat `qc-campus-documents`: PDF fins a 10 MiB, noms amb UUID per projecte i versió, sense sobreescriptura ni esborrament des del client. El SDK descarrega el document amb la sessió actual. No s’emeten enllaços públics ni signats de llarga durada.
- La comprovació de capçalera `%PDF-` és una validació de format al client, no un antivirus. La retirada administrativa d’un document i l’escaneig de contingut queden pendents per ampliar el pilot.
- La clau publicable al frontend no concedeix permisos administratius. No s’hi incorpora cap service-role key.

## De cas real a aprenentatge compartit

L’estudiant redacta un extracte separat: títol, context/resultat i aprenentatge reutilitzable. Confirma que té dret a compartir-lo amb els participants del pilot. El docent assignat l’aprova o demana ajustos. Només llavors `qc_library_feed()` retorna els camps de l’extracte a altres participants actius. No retorna l’autoria, l’identificador del treball ni documents privats.

L’estudiant pot retirar l’extracte, que desapareix de les següents consultes de biblioteca. Per corregir un extracte retornat pot retirar-lo i presentar-ne un de nou; l’edició guiada de la proposta pendent és un increment futur. Els exemples BF simulats previs es mantenen separats i amb accés denegat al client.

Aquesta biblioteca està restringida al pilot; no publica contingut a Internet ni l’utilitza automàticament per entrenar IA. Obrir-la a altres espais, cercar similituds o activar una ingesta IA amb permisos requereix un increment posterior.

## Verificació i límits

- 95 proves Node superades al Site i 117 al repositori GitHub, incloent sessions, API, conflictes, errors i càrrega de PDF.
- `supabase/tests/campus-real-pilot.sql`: transacció amb ROLLBACK, invitació, TR, assignació docent, aïllament entre estudiants, revisió, versions, consentiment, retirada, documents privats i revocació. Sense usuaris de prova persistents.
- `supabase/tests/academic-workspace-rls.sql`: regressió actualitzada al nou model de participació; revisions, instantànies immutables i cicles de dependències comprovats amb ROLLBACK.
- Data API sense sessió: 401 per projectes, tasques, propostes i participació.
- Proves visuals amb xarxa/Auth simulats localment: alta de TR al viewport 393×852, edició de fitxa, retorn docent, navegació i redirecció d’una ruta antiga de Startup a Campus. No són proves de Safari ni una sessió real. Els fitxers de simulació no es publiquen.
- Pendent amb els comptes autoritzats: login d’estudiant i docent, PDF real, reentrada des d’un segon dispositiu, aïllament A/B, conflicte, error de xarxa i retirada d’extracte.
- La revisió automàtica va rebutjar crear comptes ficticis persistents per a E2E. No es van crear; es van fer proves transaccionals i visuals locals.
- Llistats inicials limitats a 100 treballs/documents/extractes; historial mostra 30 versions de fitxa i 50 esdeveniments de tasca. Cal paginació abans d’ampliar-ne el volum.

Advisors: les tres taules amb RLS sense polítiques (`qc_library_cases`, `qc_library_entries`, `qc_private.pilot_invites`) tenen denegació intencionada al client: [explicació del linter](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy). Continua l’avís existent de [protecció contra contrasenyes filtrades desactivada](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection); no s’ha canviat la configuració global d’Auth, i aquest portal només ofereix els proveïdors OAuth disponibles.

## Fitxers i migracions

Frontend: `campus-pilot-api.js`, `campus-pilot.js`, `campus-pilot.css`, integrats amb `quelcom-auth.js` i `campus-access.js`.

Migracions aplicades a `shnitfrpgzhwobsuotdl`:

| Versió real | Nom | Fitxer |
| --- | --- | --- |
| 20261118180900 | campus_real_pilot | supabase/schema/campus-real-pilot.sql |
| 20261118181412 | campus_pilot_project_insert_visibility | supabase/schema/campus-pilot-project-insert-visibility.sql |
| 20261118181932 | campus_private_documents | supabase/schema/campus-private-documents.sql |

En un entorn nou s’apliquen després d’`academic_workspace`, en aquest ordre. No tornar-les a executar contra DEV: ja consten a l’historial. No s’ha modificat Azure ni el projecte Supabase de BF.
