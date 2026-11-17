# Supabase Auth — límit de verificació (#90)

## Estat

Component de backend preparat i provat, encara no connectat a get_principal.
El portal continua amb el proveïdor OIDC existent i la demo no crea sessions reals.
No hi ha canvis de configuració, claus, comptes ni dades al projecte Supabase.

SupabaseSessionVerifier rep una referència de projecte configurada pel servidor
(Quelcom DEV: shnitfrpgzhwobsuotdl). Deriva un únic issuer i endpoint JWKS;
cap URL inclosa al token determina on consulta les claus. Accepta signatures
ES256/RS256, audience authenticated i un únic usuari amb UUID, sessió UUID,
caducitat i nivell aal vàlids. Rebutja tokens anònims, claus service_role,
HS256, tokens sense signatura, metadades que simulen privilegis i claims absents.
El nivell aal2 es pot exigir explícitament. Ni aal ni role concedeixen el rol
docent: continuen aplicant les pertinences i permisos interns.

El resultat és VerifiedSupabaseSession, separat de Principal deliberadament:
verificar la signatura no activa per si sol el nou circuit d'autenticació.
La clau subject manté issuer|sub per resoldre user_identities de #118.

## Contracte de sessió imprescindible

La funció session_is_active(user_id, session_id) és obligatòria i ha de consultar
una font de confiança. Només True permet continuar. Una excepció, absència o
resposta amb un altre tipus denega l'accés. El callback real encara no està
implementat: els tests substitueixen expressament aquesta frontera.

L'adaptador real haurà de comprovar la parella exacta usuari/sessió, revocació,
existència de l'usuari i límits temporals configurats, sense confiar en
user_metadata. Una sessió que expira no necessàriament desapareix immediatament
d'auth.sessions. No es donarà accés de lectura general a l'esquema auth als clients.
Cal definir un accés mínim de backend abans d'integrar aquesta consulta.

## Passos pendents d'activació

1. Validar l'esquema privat i els privilegis de #89 amb el rol real del backend.
2. Implementar i provar l'adaptador de sessió, incloent logout/revocació i caigudes.
3. Integrar el verificador amb configuració explícita de proveïdor i adaptar MFA;
   no aplicar els claims acrs d'Entra a una sessió Supabase.
4. Connectar login, callback PKCE, renovació i logout; configurar els proveïdors
   Microsoft/Google/Apple/GitHub només quan tinguin credencials i redirects vàlids.
5. Provar estudiant, docent i extern en dispositius separats, permisos de Data API,
   documents, sessió revocada i retorn al projecte després del login.

## Evidència

Tests criptogràfics locals amb claus temporals RSA i EC, tokens adversaris,
MFA, claims absents, metadades no fiables i denegació davant errors de sessió/JWKS.
No constitueixen una prova de login real, rotació real de claus o revocació remota.
La CI API de #118 ja ha passat a PostgreSQL i SQLite:
https://github.com/inforstartup19/dev/actions/runs/43990814403

## Referències revisades el 2026-11-17

- https://supabase.com/docs/guides/auth/jwt-fields
- https://supabase.com/docs/guides/auth/signing-keys
- https://supabase.com/docs/guides/auth/sessions
- https://supabase.com/changelog.md
