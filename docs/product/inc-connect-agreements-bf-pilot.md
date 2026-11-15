# #21 Inc Connect → #22 Agreements — pilot BF

**Estat:** contracte de primer increment; implementar només amb dades fictícies i controls ACL/RLS. Cap contacte extern o missatge iniciat per Inc AI.

## Flux vertical segur

A crea necessitat BF privada → publica projecció amb audiència selectiva B (#20) → B consulta necessitat autoritzada → **B demana contacte (opt-in, text curt)** → A veu interès i **accepta o denega** → només amb acceptació es crea una conversa limitada → proposta d'acord optativa → proposta amb versió/hash → confirmació A i B independents → estat `confirmed`.

### Rols

- A: propietari del Projecte Viu / necessitat; mai cedeix accés a projecte intern.
- B: usuari identificat i destinatari autoritzat; veu només necessitat projectada, la seva petició i eventual proposta.
- C: usuari aliè; ni necessitat selectiva, ni peticions, ni proposta o confirmacions, inclús amb ID conegut.
- Inc AI: només suggeriments explicables; no envia peticions, no confirma acords i no atorga permisos.

## Models mínims

`connect_requests`: `id`, `need_id`, `owner_id`, `requester_id`, `status`, `version`, `note`, `created_at` i `updated_at`. Únic requester per necessitat (antispam). Transicions: `pending → accepted | declined | withdrawn`. A accepta/denega; B es pot retirar. Una necessitat revocada impossibilita **peticions noves**. Missatges i dades de contacte no s'exposen fins a acord d'intercanvi explícit (futura fase).

`collaboration_agreements`: només sobre una request `accepted`, amb `owner_id/requester_id`, text de proposta, dedicació, lliurables, condicions, accessos previstos, versió i hash del contingut. `agreement_revisions` append-only i `agreement_confirmations` (únic per actor i versió). Qualsevol nova revisió invalida les confirmacions anteriors; acord final només quan **dues identitats diferents** confirmen la versió vigent. Confirmació NO és signatura legal ni grant d'ACL.

**MVP de contacte = petició consentida i resposta autoritzada.** No desplegar xat, dades de contacte, onboarding de tercers ni signatures legals en el primer increment. `blocked/report/rate limits` de #21 requereixen disseny d'antiabús operatiu addicional abans de trànsit públic.

## Proves exigides A/B/C

1. B sense grant sobre necessitat → 404, no pot contactar ni deduir-ne l'existència.
2. Amb grant, B pot crear **una** petició, però no veure el projecte, dades, evidències o membres.
3. C, sense grant, no pot veure contacte ni acord, per cerca ni per ID.
4. B no pot acceptar la seva pròpia petició; A no pot auto-solicitar.
5. Una request retirada/denegada no pot entrar a Agreements.
6. A acorda amb B sobre request acceptada, revisions amb hash i versions CAS; A sola no pot completar l'acord.
7. Si A canvia termes després de confirmar, la confirmació vella no compta; B confirma la nova versió per separat.
8. Provar concurrència/reintents, revocació, estat de projecte pausat i RLS de runtime amb un rol no privilegiat.
9. Cap mutació d'audiència del projecte o dades privades en el flux.

## Seqüència de PR petites

1. **PR Connect schema + RLS + API**: request i transicions, A/B/C negatius i test PostgreSQL.
2. **PR Agreements schema + RLS + API**: versions i confirmacions, proves de concurrència.
3. **PR BF UX + E2E**: CTA d'interès, revisió de sol·licituds i vista acord; regressions.
4. Fases següents: perfil públic opt-in, missatgeria consentida, mecanismes de bloqueig/denúncia, matching explicable i permisos més fins per organització.

## Dependències

#19, #20 (primer slice integrat); #21, #22 (obertes fins a criteris complets); #24 (ACL en Inc AI). Cap desplegament Azure o canvi `main` fins a pla #49.
