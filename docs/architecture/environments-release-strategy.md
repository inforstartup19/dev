# Estratègia d'entorns i promoció: DEV → PREPROD → PROD

**Decisió arquitectònica — 15/11/2026**  
**Estat:** aprovada com a estratègia; **no desplegada**. Tot el treball preparatori queda a la branca Git `dev`. No crear PostgreSQL ni altres serveis Azure fins a l'aprovació explícita del desplegament controlat.

## Principis
- `dev` és **la branca de desenvolupament de GitHub**; no s'ha de confondre amb el **runtime Azure DEV**, que encara no està desplegat completament.
- `main` és actualment la branca predeterminada del repositori. No és un entorn PROD ni una autorització implícita de desplegament. Canvis futurs, documentació i codi: **només `dev`**, excepte petició expressa.
- Promoció de la **mateixa versió immutable** (commit + artifact/digest) en ordre **DEV → PREPROD → PROD**, sense reconstruir un artifact diferent per entorn.
- Recursos, dades, identitats, secrets, estats Terraform, xarxes i permisos **aïllats per entorn**; mai copiar dades reals de PROD a DEV/PREPROD sense procés de sanitització aprovat.
- El pas d'un entorn a l'altre requereix evidència de proves i aprovació; **cap `terraform apply`, `alembic upgrade`, publicació o canvi de trànsit automàtic** en aquesta fase.
- BF és el projecte de prova UX funcional amb **dades sintètiques** i privacitat inicial; els casos universitaris també han de provar permisos per rol.

## Matriu operativa

| Dimensió | DEV | PREPROD | PROD |
|---|---|---|---|
| Objectiu | Integració i proves funcionals | Validació realista i prova de release | Servei estable i supervisat |
| Públic | Equip tècnic | QA i validadors designats | Usuaris autoritzats |
| Dades | Sintètiques | Sintètiques, escenaris realistes | Reals, segons compliment i consentiment |
| Persistència prevista | PostgreSQL DEV separat | PostgreSQL PREPROD separat | PostgreSQL PROD separat |
| Secrets/identitats | Identitat de DEV | Identitat de PREPROD | Identitat de PROD i mínim privilegi |
| Terraform | Estat i `plan` DEV propis | Estat i `plan` PREPROD propis | Estat i `plan` PROD propis |
| Promoció | CI i smoke tests | Tests E2E, càrrega bàsica, seguretat, restauració | Go/no-go formal, rollout, monitoratge i rollback |
| Aplicació | Desenvolupament iteratiu | Release candidate congelada | Artifact aprovat de PREPROD |

Els noms definitius de subscripcions, grups, ubicacions, capacitats i pressupostos s'aprovaran abans de definir recursos nous. Es pot optar per subscripcions separades o una segregació RBAC equivalent, segons política i cost. La regió documentada per al primer DEV és `francecentral`; **no es pressuposa** automàticament que els altres dos entorns utilitzin la mateixa regió.

## Distribució prevista del repositori

```text
apps/
  web/                         # Next.js
  api/                         # FastAPI + Alembic
infra/
  terraform/
    bootstrap/                 # Bootstrap existent: revisar segregació abans del 3-env
    github-identity/           # OIDC DEV existent; pendent aplicar canvi a Azure
    environments/
      dev/                     # Terraform DEV existent
      preprod/                 # Pendent de disseny i aprovació: no creat
      prod/                    # Pendent de disseny i aprovació: no creat
docs/
  architecture/
    environments-release-strategy.md
```

No es creen directoris Terraform PREPROD/PROD buits que suggereixin un desplegament preparat. Quan s'aprovi la fase Azure, es crearan amb paràmetres i backends independents, proves i costos revisats.

## Pipeline previst, per gates

1. **Integració Git (`dev`):** revisió de PR, lint, tests web/API, suites PostgreSQL efímeres i escenaris d'accés. Permet integrar codi sense exigir PostgreSQL persistent a Azure.
2. **Preparació del desplegament:** aprovar pressupost, topologia, segmentació, DNS, TLS, identitats OIDC i estats Terraform independents; després `plan` revisat per entorn.
3. **Deploy DEV:** aprovar l'aplicació Terraform, crear la base nova, aplicar migracions a partir de `base` fins a `head`, desplegar API/web, proves BF i controls de permisos.
4. **Promoció PREPROD:** artifact exacte aprovat DEV, secrets i BD propis; repetir migracions i regressió, E2E, escaneig i validació de restauració.
5. **Promoció PROD:** aprovació explícita, backup/PITR i rollback documentats, finestra i alertes, canary/blue-green si es justifica, monitoratge post-release.

`plan` és informatiu i la seva aprovació no significa `apply`. Separar les identitats de CI (read-only) de les de desplegament, i preferir GitHub Environments amb permisos específics i aprovacions exigides abans de qualsevol acció irreversible.

## Requisits d'Alembic per entorn

- **Abans del primer desplegament**, revisar el graf únic de migracions, provar `upgrade head` contra una base de dades **nova de CI**, la reversibilitat de l'esquema i les polítiques RLS amb un rol sense privilegis.
- La incidència #27 de col·lisió `0005` s'ha resolt **en codi de les PR apilades** (#17 → #47 → #48); CI exitosa no és equivalent a merge. El fet que **Azure no tingui PostgreSQL** implica que **no és necessari auditar una base Azure DEV inexistent per integrar codi a la branca Git `dev`**.
- Quan es provisioni cada BD persistent, crear-la inicialment sense dades reals, migrar-la controladament, capturar `alembic_version` i l'evidència de RLS.
- Si en el futur s'identifica una altra BD persistent preexistent, cal verificar-ne estat, esquemes i revisions abans d'executar cap `upgrade` o `stamp`; mai aplicar migracions a cegues.

## Criteris de promoció (release gates)

| Gate | Evidència mínima | Responsable/aprovació |
|---|---|---|
| CI → branca Git `dev` | PR revisada, migracions lineals, tests verds, controls de privacitat | Revisió tècnica |
| Git `dev` → Azure DEV | Arquitectura, pressupost, OIDC, IaC plan, base nova i dades sintètiques | Aprovació d'infraestructura |
| Azure DEV → PREPROD | Build immutable, smoke/E2E BF, tests entre usuaris, logs i alertes | QA/Producte |
| PREPROD → PROD | Seguretat, performance, backup/restore, rollback, aprovació formal | Responsable de release |

## Decisions pendents

- Hosting Azure de Next.js/FastAPI, PostgreSQL Flexible Server, configuració privada i estimació de costos per entorn.
- Reorganització de l'estat del bootstrap: **no duplicar ni moure estats existents automàticament**.
- Noms de subscripcions/identitats GitHub Environments `dev`, `preprod`, `prod`, reviewers i controls de branca.
- Observabilitat, backups, disponibilitat, retenció, polítiques d'accés i procés de desactivació.
- Calendari de posada en marxa i aprovacions dels desplegaments; cap data ni servei s'assumeix actiu.

## Referències
- [Issue #27](https://github.com/inforstartup19/dev/issues/27) i PR [#17](https://github.com/inforstartup19/dev/pull/17), [#47](https://github.com/inforstartup19/dev/pull/47) i [#48](https://github.com/inforstartup19/dev/pull/48)
- [Infraestructura actual](../infrastructure.md)
- [Gate Alembic](../product/issue-27-alembic-release-gate.md)
