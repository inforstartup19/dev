# IncForStartUp / Quelcom — checkpoint 16 novembre 2026

## Producte acordat

IncForStartUp és el projecte mare. Quelcom és la marca i experiència; el punt de partida és una idea. Universitats són la fase 0, amb continuïtat voluntària cap a iniciativa pròpia/startup/empresa. Campus és la segona pantalla; Explorar, Investigar i Formar s’obren des de Nova idea.

## Tres estats diferents

- Site publicat: portada vectorial, Campus, Coworking, Biblioteca, Universitats, equip/cotutoria i demos TFG/TFM. Source af57e81662fc8e04fad0ea83448802d82cf83493.
- PR #85: snapshot i selector de login preparat, HEAD revisat 1c6cb1dd7500535a2ea24f6d4ad6ed7dac92f72e. Draft oberta, no fusionada. 41 proves locals aprovades al lliurament TFG/TFM; no equival a CI del nou checkpoint.
- Git dev: 1303b2526dd6167ee591d375aaef12492918e27e. Backend/React amb OIDC configurable, API i controls d’accés. No equival al Site ni a un pilot desplegat amb comptes reals.

## Què existeix i què falta

| Àmbit | Disponible | Pendent |
| --- | --- | --- |
| Entrada | Malla vectorial, hover individual, viatge, contrast | Mesures de rendiment i accessibilitat real |
| Campus | Coworking, cerca/desats Biblioteca, institucions i equip ficticis | Dades compartides i membresies institucionals |
| TFG/TFM | Proposta, retorn docent, canvis, versions i historial local | Esborranys recuperables, sessions separades i autorització servidor |
| Identitat | Cinc proveïdors preparats i desactivats a la demo | Configuració i proves reals #83 |
| Projecte Viu | Proves/resultats/decisions locals i backend existent separat | Reconciliar UI/servidor #84 |
| Proof | Backend parcial integrat; panell en PR #80 | Revisió PR #79/#80, permisos i QA #23/#55 |
| IA | Cites extractives protegides segons checkpoint #24 | Corpus, RAG opt-in i revocació de caches; cap model actiu a la demo |
| Infraestructura | Codi/topologia/preflight deny-by-default | #49, aprovacions i desplegament controlat; cap nou apply |

L’usuari ha validat aspecte i llegibilitat de la portada en PC i iPhone 15 Pro. Això no tanca #55: falten VoiceOver, contrast mesurat, sessions i circuit complet. La nova demo acadèmica encara s’ha de provar.

## Ordre executable

1. #86 (slice #84): protecció d’esborranys TFG/TFM i Coworking. Evitar pèrdua de feina abans del pilot.
2. #55 + #84: recollir prova estudiant/docent i corregir incidències reproduïbles. No donar per validades funcionalitats només pel disseny.
3. #60 + #84: mapar proposta/versionat/retorn acadèmic al model existent i preparar contracte API, amb universitat, titulació, tutoria i permisos explícits.
4. #83 + #77: connectar identitats reals i integrar frontend. Validar primer un proveïdor viable del pilot; mantenir altres desactivats fins a proves.
5. #23: revisar panell Proof ja preparat (#79/#80); després #24 coneixement amb ACL.
6. #21/#22: antiabús distribuït i política institucional abans d’obertura pública; #32–#35 federació després dels contractes de permisos.
7. #62 preparació IaC; #49/#61 mantenen gate de desplegament/cost. No són requisit per continuar validant la demo local.

## PR revisades directament

| PR | Estat | Tractament |
| --- | --- | --- |
| #78 | Oberta, no fusionada | Portada antiga: reconciliar amb snapshot #85 |
| #79 | Oberta, no fusionada | Contracte de capabilities Proof |
| #80 | Oberta, no fusionada | Panell Proof, revisar dependència amb #79 |
| #81 | Oberta, no fusionada | Entrada React separada; no és la portada vectorial publicada |
| #82 | Oberta, no fusionada | Login; #85 n’inclou la línia de treball |
| #85 | Draft oberta, no fusionada | Consolidació Site i preparació login; actualitzar descripció |

No fusionar totes les PR en bloc. La cerca de PR via connector ha retornat issues i no és fiable com a inventari; la taula anterior prové de consultes individuals. No es declara CI actualitzat sense consultar-ne els runs.

## Inventari d’issues obertes retornat per GitHub

Aquest inventari no significa que cada issue estigui sense implementar: moltes són èpics parcials o criteris residuals. No tancar automàticament #5–#15/#27 sense comparar criteris i evidències.

- [#84](https://github.com/inforstartup19/dev/issues/84) Quelcom: consolidar qualitat i integrar el Projecte Viu visual amb el portal autenticat
- [#83](https://github.com/inforstartup19/dev/issues/83) Quelcom: activar i validar els cinc mètodes d’accés abans del pilot
- [#77](https://github.com/inforstartup19/dev/issues/77) [INC ENTRADA][P1] Integració autenticada i QA accessible del recorregut espacial
- [#75](https://github.com/inforstartup19/dev/issues/75) [INC ENTRADA][P1] Portar la portada espacial recurrent a dev
- [#76](https://github.com/inforstartup19/dev/issues/76) [INC ENTRADA][P2] Refinar esfera, profunditat i viatge espacial
- [#62](https://github.com/inforstartup19/dev/issues/62) [INC IAC][P1] Evolució Terraform + Ansible, estats separats i validacions abans d'Azure
- [#61](https://github.com/inforstartup19/dev/issues/61) [INC CAMPUS LABS][P2] Laboratoris i Virtual Desktops amb broker, quotes i cicle de vida
- [#60](https://github.com/inforstartup19/dev/issues/60) [INC CAMPUS][P1] Taxonomia acadèmica: universitats, mòduls, assignatures i laboratoris
- [#55](https://github.com/inforstartup19/dev/issues/55) [QA][Projecte Viu BF] Revisió manual Safari/iOS, teclat i contrast després de #52
- [#54](https://github.com/inforstartup19/dev/issues/54) [POST #52] QA Safari/iOS, exportació, excepcions governades i obligacions externes
- [#49](https://github.com/inforstartup19/dev/issues/49) [INFRA · FUTUR] Estratègia de desplegament Azure DEV → PREPROD → PROD
- [#45](https://github.com/inforstartup19/dev/issues/45) [INC UX PILOT] BF — Be First: recorregut demostrable de Projecte Viu
- [#44](https://github.com/inforstartup19/dev/issues/44) [INC AUDIT / ROADMAP] Estat global, cobertura conceptual i ordre executable
- [#43](https://github.com/inforstartup19/dev/issues/43) [INC VALIDATION TRANSFER] Vigència contextual, reutilització condicionada i lineage
- [#42](https://github.com/inforstartup19/dev/issues/42) [INC CONTINUITY] Avisos governats, seguiment i represa verificable
- [#41](https://github.com/inforstartup19/dev/issues/41) [INC TRUST GRAPH] Dependències per afirmació, propagació selectiva i checkpoints
- [#40](https://github.com/inforstartup19/dev/issues/40) [INC EVIDENCE] Evidence Passport, provenance, revisions i verificacions reutilitzables
- [#39](https://github.com/inforstartup19/dev/issues/39) [INC COMMITMENTS] Seguiment, revisions per impacte i verificació de compliment
- [#38](https://github.com/inforstartup19/dev/issues/38) [INC RESOLUTION] Incidències, imparcialitat i mediació consentida
- [#37](https://github.com/inforstartup19/dev/issues/37) [INC GOVERNANCE] Charter adaptable, decisions per tipus i transicions selectives
- [#35](https://github.com/inforstartup19/dev/issues/35) [INC FEDERATED E2E] Pilot de 3 projectes, sortida C i proves de seguretat
- [#34](https://github.com/inforstartup19/dev/issues/34) [INC KNOWLEDGE IMPACT] Retorn de valor progressiu, autoria, lineage i connexions
- [#33](https://github.com/inforstartup19/dev/issues/33) [INC COLLAB LIFECYCLE] Opció C: continuïtat governada i reversible de Collaborative Spaces
- [#32](https://github.com/inforstartup19/dev/issues/32) [INC COLLAB SPACES] Espais federats de projectes, accions i recursos compartits
- [#31](https://github.com/inforstartup19/dev/issues/31) [INC KNOWLEDGE] Governança contextual, Knowledge Passport i federació per audiències
- [#30](https://github.com/inforstartup19/dev/issues/30) [INC MEMORY] Preferències temporals, desades amb opt-in i dret de revisió
- [#29](https://github.com/inforstartup19/dev/issues/29) [INC DISCOVERY] Recomanacions híbrides, adaptació controlada i microaportacions
- [#28](https://github.com/inforstartup19/dev/issues/28) [INC PASSPORT] Evolució híbrida, competències, facetes, Proof i Journey
- [#27](https://github.com/inforstartup19/dev/issues/27) [INC DEV / BLOCKER] Reconciliar PR #17, #26 i PR #2 abans d'integrar el circuit
- [#25](https://github.com/inforstartup19/dev/issues/25) [INC UX 7/7] Demo integrada i proves del circuit d'identitat a aportació
- [#24](https://github.com/inforstartup19/dev/issues/24) [INC AI 6/7] Coneixement de decisions aprovades i recomanacions amb cites i ACL
- [#23](https://github.com/inforstartup19/dev/issues/23) [INC PROOF 5/7] Registre d'aportacions i reconeixement verificable controlat
- [#22](https://github.com/inforstartup19/dev/issues/22) [INC AGREEMENTS 4/7] Proposta compartida, versions i confirmació bilateral
- [#21](https://github.com/inforstartup19/dev/issues/21) [INC CONNECT 3/7] Descobriment bidireccional i primer contacte consentit
- [#20](https://github.com/inforstartup19/dev/issues/20) [INC PRIVACY 2/7] Visibilitat granular i progressiva per projectes, facetes i aportacions
- [#19](https://github.com/inforstartup19/dev/issues/19) [INC IDENTITY 1/7] Identitat única amb facetes adaptables i visibilitat per context
- [#18](https://github.com/inforstartup19/dev/issues/18) [INC / EPIC] Identitat adaptable, Inc Connect, Agreements, Proof i coneixement per a Inc AI
- [#16](https://github.com/inforstartup19/dev/issues/16) [ATLAS / COORDINATION] Protocol compartit Work · Codex · GitHub · Canva — IncForStartUp
- [#15](https://github.com/inforstartup19/dev/issues/15) [Flux operatiu 5/5] Ampliar només el que es necessita
- [#14](https://github.com/inforstartup19/dev/issues/14) [Flux operatiu 4/5] Triar com continuar
- [#13](https://github.com/inforstartup19/dev/issues/13) [Flux operatiu 3/5] Registrar què ha canviat
- [#12](https://github.com/inforstartup19/dev/issues/12) [Flux operatiu 2/5] Treballar sobre una acció concreta
- [#11](https://github.com/inforstartup19/dev/issues/11) [Flux operatiu 1/5] Començar amb una fitxa curta
- [#10](https://github.com/inforstartup19/dev/issues/10) [Projecte progressiu 6/6] Preparar un espai propi de finançament vinculat al projecte
- [#9](https://github.com/inforstartup19/dev/issues/9) [Projecte progressiu 5/6] Organitzar compromisos i recursos de manera progressiva
- [#8](https://github.com/inforstartup19/dev/issues/8) [Projecte progressiu 4/6] Activar col·laboració quan el projecte la necessita
- [#7](https://github.com/inforstartup19/dev/issues/7) [Projecte progressiu 3/6] Recollir aprenentatges i decidir la continuïtat
- [#6](https://github.com/inforstartup19/dev/issues/6) [Projecte progressiu 2/6] Preparar una primera prova assumible
- [#5](https://github.com/inforstartup19/dev/issues/5) [Projecte progressiu 1/6] Capturar la idea amb una fitxa mínima
- [#86](https://github.com/inforstartup19/dev/issues/86) Protecció d’esborranys acadèmics i Coworking, creada en aquesta revisió.

## Primer increment #86

Reutilitzar recuperació per formulari; separar esborrany de versió presentada; conservar text davant quota/corrupció; detectar sobreescriptura entre pestanyes; exportació local explícita. Provar proposta V1, retorn docent, V2 i validació, sense barrejar TFG/TFM. No migrar automàticament dades locals a cap compte.

