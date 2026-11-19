# Quelcom · accés amb Supabase (18 novembre 2026)

Increment preparat; cap proveïdor social activat ni sessió real provada.

La consulta real `/auth/v1/settings` a quelcom-campus-dev (`shnitfrpgzhwobsuotdl`) retorna Google, GitHub, Azure/Microsoft i Apple desactivats; email activat. No s’han enviat correus ni creat usuaris. No s’han alterat polítiques, biblioteca interna, membres ni rols.

## Què funciona en aquest increment

- Entrada amb context del recorregut, retorn al TFG/TFM, enllaç «El meu compte» i separació de demostració i identitat.
- Adaptador Supabase JS 2.119.0: PKCE, callback, verificació `getUser`, refresc i logout local. SDK oficial venedoritzat amb llicència i lockfile de procedència.
- Sessions i verificador PKCE en sessionStorage, limitats a la pestanya. Els esborranys locals existents no es modifiquen. Els camps no presentats d’un formulari de demo continuen subjectes al comportament preexistent: cal desar-los abans de sortir.
- Destins interns coneguts, errors acotats, supressió del codi OAuth de l’URL, estats pendents que no permeten iniciar un accés no configurat.
- Correu per enllaç, només per comptes ja provisionats (`shouldCreateUser:false`). No es promet enviament fins a comprovar SMTP, plantilla, retorn i invitacions.

## Activació pendent

1. A Supabase > Authentication > Sign In / Providers, configurar les aplicacions Google, GitHub, Azure (Microsoft) i Apple. Les credencials es guarden exclusivament a Supabase. No copiar secrets al repositori ni al xat.
2. Registrar als proveïdors el callback de Supabase: `https://shnitfrpgzhwobsuotdl.supabase.co/auth/v1/callback`.
3. Decidir el públic Microsoft (universitats/tenants concrets o multitenant). Cap domini de correu ni user_metadata concedeix afiliació, rol docent o accés a projectes.
4. Configurar i verificar l’allowlist exacta de retorn: `https://incforstartup.independentankle2.chatgpt.site/auth-callback.html`. La protecció ChatGPT del Site es conserva; el login Supabase no la substitueix. Cal provar la tornada a través d’aquesta protecció. Per un desplegament extern cal registrar el seu origen real separat.
5. Fer QA de cada proveïdor amb comptes de prova: entrada correcta, cancel·lació, denegació, codi expirat/reutilitzat, logout i retorn al mateix projecte. Només llavors posar `redirectReady:true` a `quelcom-auth-config.js`. Encara cal que `/settings` retorni el proveïdor habilitat.
6. Per correu: validar SMTP i el flux PKCE de la plantilla amb un compte convidat i posar `emailReady:true`. Email activat al servidor no demostra lliurament ni retorn correctes.

No s’ha modificat l’autenticació Campus OIDC de l’app Next.js: els seus tokens, audiència i permisos requereixen una migració pròpia abans de consumir Supabase. La sessió preparada en aquest Site no connecta automàticament els esborranys locals amb PostgreSQL. La vinculació de comptes i les seves col·lisions s’han de verificar contra la configuració real de Supabase; no fem una fusió pròpia pel correu.

## Verificació

84 tests del Site passen, inclosos 6 de login: retorn segur, bloqueig de proveïdors, PKCE, Microsoft email scope, callback verificat, preservació d’esborranys i correu per invitació. SDK simulat als tests; això no és una prova OAuth externa.

Navegador Chrome: login, enllaç Demo TFM, «El meu compte» amb retorn a BF i persistència del destí després de reload. Callback cancel·lat: error segur i URL neta. Vista iframe de 393 × 852 revisada; pendent Safari/iPhone físic. No s’han iniciat sessions externes ni enviat missatges.

Fonts: https://supabase.com/docs/guides/auth/sessions/pkce-flow ; https://supabase.com/docs/guides/auth/auth-email-passwordless ; https://supabase.com/docs/guides/auth/social-sign-in/auth-google .

## Activació del pilot GitHub

El 18 de novembre, la consulta de configuració pública confirma `github:true`; Google, Microsoft i Apple continuen desactivats. Omar confirma que ha desat la URL de retorn del portal. S’activa `redirectReady` per permetre la prova real amb GitHub; `emailReady` continua desactivat. La configuració i el botó estan habilitats, però la validació OAuth completa (consentiment, intercanvi i retorn al projecte) queda pendent de la prova de l’usuari. Aquesta actualització substitueix l’estat inicial de GitHub descrit més amunt.
