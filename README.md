# IncForStartUp — plataforma de projectes vius

**IncForStartUp** és una plataforma en desenvolupament per convertir idees en projectes vius: definir una intenció, preparar proves, registrar resultats i evidències, incorporar col·laboradors i evolucionar —quan correspongui— cap a una startup o empresa. La proposta és transversal a sectors i perfils, amb un **primer focus en universitats**, sense limitar l'accés a iniciatives independents o empresarials.

> **Estat:** repositori de desenvolupament, no producte públic desplegat. Les capacitats experimentals de *Projecte Viu* es validen en pull requests abans d'incorporar-les a `dev`. No confonguis una demostració local amb serveis Azure operatius.

## 🧭 On som?

| Àrea | Estat del desenvolupament |
| --- | --- |
| Campus universitari | Web Next.js i API FastAPI; recorregut connectat professor–alumne comprovat amb identitat OIDC **de proves** |
| Projectes privats | Model d'espais i permisos, RLS PostgreSQL, endpoints i documentació; la integració completa de documents sensibles requereix més validació |
| Projecte Viu | Fitxa curta, proves i evidències **en revisió**; no integrades encara a `dev` ni a la UI productiva |
| Inc AI i coneixement | Arquitectura i inici d'implementació sota controls d'accés; no és un servei d'IA productiu |
| Azure i Terraform | Bootstrap, entorn de desenvolupament i integració OIDC documentats; web i API encara no desplegades a Azure |
| BF — Be First | Primer projecte de referència per validar el recorregut UX; les dades del pilot no equivalen a dades reals o públiques |

**Desenvolupament actiu:** [Issue #27 — reconciliació tècnica](https://github.com/inforstartup19/dev/issues/27) · [PR #17 — fitxa curta](https://github.com/inforstartup19/dev/pull/17) · [PR #47 — migracions reconciliades](https://github.com/inforstartup19/dev/pull/47) · [PR #48 — proves i evidències](https://github.com/inforstartup19/dev/pull/48).

## 🗂️ Estructura real del repositori

| Directori | Propòsit |
| --- | --- |
| [`apps/web/`](apps/web/) | Aplicació Next.js: experiència Campus, sessions, espais privats, demos i proves de la web |
| [`apps/api/`](apps/api/) | API FastAPI/Python: autenticació, permisos, dades, migracions Alembic i proves SQLite/PostgreSQL |
| [`sites/incforstartup/`](https://github.com/inforstartup19/dev/tree/dev/sites/incforstartup) | Exploració del portal i del recorregut UX; **actualment a `dev`**, no a `main` |
| [`infra/terraform/`](infra/terraform/) | Bootstrap de l'estat, infraestructura Azure dev, OIDC i mòduls reutilitzables |
| [`docs/`](docs/) | Arquitectura, decisions, seguretat, producte, referències i full de ruta |
| [`scripts/`](scripts/) | Automatitzacions, controls locals i comprovacions del repositori |
| [`.github/workflows/`](.github/workflows/) | GitHub Actions: CI, API, web, flux connectat i validacions Terraform |
| `src/` i `tests/` | Directoris reservats de la plantilla inicial; les proves vigents són a `apps/api/tests/`, `apps/web/tests/` i als mòduls corresponents |

La distribució de carpetes reflecteix el codi actual. No es presenta `src/` com una tecnologia pendent: les tecnologies del portal i de l'API ja estan definides.

## 🚀 Com començar

Per a les comprovacions bàsiques del repositori calen Git i Python 3.11 o superior:

```bash
git clone https://github.com/inforstartup19/dev.git
cd dev
python3 scripts/check_repo.py
```

Alternativament, `make check` quan `make` sigui disponible. Aquesta comprovació **no** substitueix els tests de les aplicacions.

Per desenvolupar l'API i la web, consulta les instruccions específiques: [API FastAPI](apps/api/README.md) i [Next.js](apps/web/README.md). Les dependències s'instal·len per aplicació; no calen per executar exclusivament `scripts/check_repo.py`.

## 🔀 Flux de treball i branques

- **`main`** és la branca predeterminada i la portada general del repositori.
- **`dev`** és la branca d'integració del desenvolupament actiu.
- Cada funcionalitat es treballa en una branca específica i entra per PR amb proves i revisió. Les PR apilades han de mantenir l'ordre de dependències.
- El conjunt actual segueix **#17 → #47 → #48**. Les tres PR **no** s'han fusionat a `dev`; abans cal revisar l'estat real de les migracions Alembic i els criteris de seguretat.
- No s'han d'executar `terraform apply`, desplegaments o migracions en entorns amb dades reals només perquè la CI sigui verda.

Consulta [CONTRIBUTING.md](CONTRIBUTING.md) i [les decisions d'infraestructura](docs/infrastructure.md). Els controls de branca obligatoris s'han de verificar a GitHub Settings; la presència de workflows no prova que estiguin imposats.

## 🧩 Àrees del producte

**Campus i universitats.** Espais docents, equips, projectes, entregues i avaluacions amb rúbrica. [Abast del MVP](docs/product/campus-mvp.md) · [Campus connectat](docs/product/connected-campus.md) · [Model de dades](docs/product/data-model.md).

**Projecte Viu.** Fitxa curta privada, prova activa, registre de resultats, evidències declarades i reformulació sense perdre la traçabilitat. La primera integració continua en PR; els tests de CI no acrediten encara el recorregut visual complet. [Roadmap de producte](docs/product/incforstartup-roadmap.md).

**Privacitat i col·laboració.** Membresies independents per projecte, polítiques RLS, accés reforçat i circuit de documents privats deshabilitat per defecte fins a verificar els prerequisits d'Azure. [Espais privats](docs/product/private-startup-security.md) · [RLS i emmagatzematge](docs/product/rls-and-document-storage.md) · [Documents privats](docs/product/private-document-pipeline.md) · [Validació del pilot](docs/product/private-pilot-validation.md).

**Projecte de referència.** [BF — Be First](docs/projects/be-first.md) ajuda a verificar la UX sense publicar informació privada del projecte.

## ☁️ Infraestructura i desplegament

Terraform **1.13.5** defineix bootstrap, estat remot, identitat federada GitHub–Azure i entorn `dev`. Els workflows validen configuració i plans segons el cas; el `plan` no autoritza un `apply` automàtic.

[Infraestructura](docs/infrastructure.md) · [OIDC GitHub–Azure](docs/github-azure.md) · [Terraform plan](docs/terraform-plan.md) · [Xarxa privada](docs/private-network.md) · [Allotjament de les aplicacions](docs/application-hosting.md).

---

**Principi de desenvolupament:** cada nova capacitat ha de respectar la privacitat inicial, mantenir la traçabilitat i passar les validacions abans de considerar-se disponible. Les característiques encara proposades o pendents de desplegament s'identifiquen com a tals.
