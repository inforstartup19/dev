# Campus: login obligatori i preparació del pilot

## Implementat

L’entrada a Campus (inici, campus, campus-demo, espai-demo), subespais universitaris i recorreguts TFG/TFM demana sessió Supabase verificada. Els enllaços directes conserven el destí després del login. S’eliminen els enllaços de demo sense sessió de la pantalla de login. Quelcom i les quatre esferes continuen accessibles segons la compartició del Site. Es revalida la identitat quan es torna a la pestanya, sense reconstruir formularis si el compte no ha canviat.

Aquest control de navegació no és una frontera d’autorització de dades: el Site és estàtic, les demos continuen locals i no s’hi han de recollir treballs reals encara. L’autorització de dades ha de ser al servidor amb RLS i membresia per projecte.

## Com donar accés a proves de navegació ara

1. Compartir el Site amb cada correu com a visitant/visualitzador, no editor del projecte Sites. L’audiència actual és custom i admet convidats externs. No s’ha ampliat en aquest increment.
2. El participant obre el Site i tria Campus. Si Sites li demana identificar-se, ha d’utilitzar el compte autoritzat en compartir-lo.
3. Inicia sessió a Quelcom amb un proveïdor disponible (Microsoft o GitHub verificats fins ara). La identitat de Quelcom és independent de la compartició Sites.
4. Pot provar formularis amb dades fictícies. Desar a la demo només desa en aquell navegador; no crea un lliurament al docent ni una còpia al núvol.

## Condicions abans del pilot TFG/TFM real

- Recollir en privat correu de login, rol estudiant/docent, universitat i TFG/TFM de cada participant. No publicar el llistat en issues, codi o assets.
- Invitació amb caducitat, acceptació pel correu verificat, revocació i assignació explícita a qc_projects/qc_members; evitar permisos basats en user_metadata o en el domini del correu.
- Connectar formularis al model Supabase existent, amb desament confirmat, conflictes, recuperació entre dispositius i errors sense pèrdua de text. Importació local només amb previsualització i confirmació.
- El docent només accedeix als treballs assignats; l’estudiant només als propis. El selector de perfil de demo no concedeix rols reals.
- Provar amb dos estudiants i un docent autenticats: aïllament, edició, reentrada, revocació, retorn docent i connexió interrompuda.
- L’accés per correu del login encara està desactivat. Cal verificar enviament SMTP, límits i plantilla/flux d’invitació abans d’activar-lo. Una invitació Supabase per si sola no assigna un treball ni connecta els formularis.
- La càrrega de documents requereix un flux separat amb bucket privat i permisos verificats; encara no disponible en aquesta demo.

## Verificació

Proves automatitzades del gate: ruta directa anònima, recuperació de destí, sessió verificada, invalidació en logout i àlies acadèmics. Prova de navegador anònim sobre #befirst-tfm-tauler: redirecció a #login, destí TFM conservat i sense botó per saltar el login. El login real dels proveïdors ja havia estat comprovat per Omar; no s’ha iniciat cap sessió de participant durant aquesta verificació.
