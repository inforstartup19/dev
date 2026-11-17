# Quelcom — identitat i escenaris d’accés

IncForStartUp és la identitat mare; Quelcom és l'experiència. Opcions previstes:
universitat, Microsoft, Google, Apple i correu amb codi temporal.

## Implementació d’aquest increment

El frontend conserva `campus-oidc`: un emissor, una audiència API i una identitat
interna. No s'envien access tokens de Google/Apple directament a l'API Campus.
El nou selector només habilita els mètodes configurats al servidor i verificats
per l'operador amb `CAMPUS_LOGIN_METHODS`. Cada entrada és `{enabled:true,
domainHint:"domini-exacte-configurat"}`. No copiar un exemple de domini a producció.
Sense mapa es conserva l'accés Campus anterior. Un mapa buit els desactiva tots.
La base OIDC completa continua sent obligatòria. Els hints només orienten el broker;
no verifiquen identitat institucional ni assignen rols. No acceptem hints, URLs,
claims ni proveïdors arbitraris des del formulari.

El Site estàtic mostra cinc opcions pendents i un laboratori d'escenaris clarament
simulat. No recull credencials, no envia correu, no crea sessions ni amplia permisos.
La demostració local és independent de l'autenticació.

## Activació real pendent

1. Configurar i desplegar el broker/issuer Campus, callbacks HTTPS, client secret,
   AUTH_SECRET, scopes i audiència de l'API; no hi ha aquests valors al Site actual.
2. Universitat: acord i federació amb cada institució participant. Una adreça de
   correu institucional no equival a una afiliació verificada.
3. Microsoft: precisar i provar el conjunt de tenants i si s'admeten comptes
   personals; no confondre Microsoft Entra institucional amb Microsoft personal.
4. Google: client OAuth, consentiment, retorns i federació al broker.
5. Apple: App ID amb Sign in with Apple, Services ID, domini i retorn, Team ID,
   Key ID i clau privada al gestor de secrets. Provar Hide My Email i absència del
   nom en accessos posteriors. Rotació de la credencial segons el proveïdor.
6. Correu: flux OTP real al broker, lliurament, caducitat, un sol ús, limitació
   d'intents/reenviaments i resposta que no reveli si el compte existeix.
7. Verificar subject estable, tokens per a l'API, permisos i revocació abans
   d'habilitar cada opció. No fusionar comptes pel correu ni per correu d'Apple.

Si el broker no proporciona un hint directe per a un mètode (p. ex. correu),
cal adaptar el seu flux documentat abans d'habilitar-lo; no inventar-ne el hint.

## Matriu d’experiència i proves pendents de proveïdor

| Escenari | Resultat exigit |
| --- | --- |
| Primer accés | Compte intern únic, sense membresies automàtiques |
| Sessió vàlida | Obrir el destí autoritzat sense login redundant |
| Sessió caducada | Tornar al login i conservar destí intern autoritzat |
| Invitació vàlida | Verificar destinatari i vigència abans d'acceptar |
| Invitació revocada/caducada | Denegar sense exposar informació del projecte |
| Cancel·lació o error OAuth | Reintent clar, sense sessió falsa |
| Proveïdor caigut | Alternativa ja vinculada; mai crear un duplicat silenciós |
| Correu OTP | Provar codi incorrecte/caducat/reutilitzat, throttling i reenviament |
| Apple privat | Identitat estable independent del correu relay |
| Vincular/desvincular | Reautenticació explícita; conservar almenys un accés vàlid |
| Graduació | Conservar projectes propis i retirar grants institucionals segons política |
| Privilegis elevats | Mantenir claims de step-up i verificació al servidor |
| Retorn maliciós | Acceptar només destins interns de la llista tancada existent |

Ara hi ha proves unitàries d'opcions, hints i errors; aquests casos de proveïdor
no estan validats en viu. Safari/iOS i lector de pantalla segueixen pendents.

Fonts: https://learn.microsoft.com/entra/external-id/customers/concept-authentication-methods-customers
https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web/
