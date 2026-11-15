# Vincular GitHub amb Azure sense contrasenyes

## Disseny

Identitat administrada assignada per l’usuari `id-incforstartup-github-dev`, amb federació OIDC:

- Emissor: `https://token.actions.githubusercontent.com`.
- Audiència: `api://AzureADTokenExchange`.
- Subjecte exacte: `repo:inforstartup19@354242787/dev@1450737434:environment:dev`.
- Contributor només al grup de recursos `rg-incforstartup-dev`.
- Storage Blob Data Contributor només al contenidor `tfstate-dev`.

La identitat no té Owner ni permisos per assignar rols. L’estat del bootstrap i de la vinculació queda al contenidor `tfstate`, sense accés per a la identitat GitHub. No es creen secrets de client ni es modifica l’usuari `developer`.

## 1. Preparació a Azure

Completa el [bootstrap i l’entorn dev](infrastructure.md) amb la identitat d’operador existent. El bootstrap ha d’incloure `tfstate-dev`. Un administrador ha de registrar també `Microsoft.ManagedIdentity`.

L’operador que crea la vinculació necessita permisos per crear la identitat i les credencials federades al grup dev, assignar els dos rols als abasts indicats i accedir a l’estat remot. Contributor per si sol no pot assignar rols; l’administrador ha de proporcionar, per exemple, Role Based Access Control Administrator als abasts necessaris. No s’assignen aquests permisos administratius al workflow.

A `infra/terraform/github-identity`:

```bash
cp terraform.tfvars.example terraform.tfvars
cp backend.hcl.example backend.hcl
```

Edita la subscripció i el nom real del Storage Account. El backend d’aquest directori utilitza `container_name = "tfstate"` i `key = "github-identity/terraform.tfstate"`.

```bash
az login
az account set --subscription <subscription-id>
terraform init -backend-config=backend.hcl
terraform plan -out=identity.tfplan
terraform apply identity.tfplan
terraform output github_variables
```

Les sortides són identificadors públics de configuració, no secrets. La creació de la identitat pot trigar a propagar-se a Entra ID i els rols també poden necessitar temps abans del primer login.

## 2. Configuració GitHub

Un administrador del repositori ha de crear l’entorn GitHub `dev` a Settings → Environments, restringir les branques de desplegament a **només `main`** i configurar-hi aquestes variables amb les sortides de Terraform:

- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`

Utilitza Environment variables, no secrets. Si el pla GitHub ho permet, configura també revisors per a futures operacions d’apply. L’entorn és part del subjecte OIDC: una acció sense `environment: dev` no coincideix amb la credencial federada. Qualsevol futur workflow que utilitzi aquest entorn podrà demanar la identitat, de manera que la restricció de branques i el control de canvis als workflows són necessaris.

La comprovació manual del workflow es limita també a `main`. La configuració de l’entorn al servidor GitHub no s’inclou automàticament en un git push.

## 3. Verificar la vinculació

A GitHub → Actions → **Verify Azure connection** → Run workflow, selecciona `main`.

Alternativament:

```bash
gh workflow run azure-connection.yml --repo inforstartup19/dev --ref main
gh run list --repo inforstartup19/dev --workflow azure-connection.yml
```

El workflow obté un token OIDC, inicia sessió a Azure, comprova l’ID de subscripció i consulta el grup dev. No executa Terraform apply ni crea recursos. Aquesta prova confirma login i lectura del grup; l’accés de dades al backend es comprovarà amb el primer pla Terraform autenticat.

Si retorna AADSTS70021, comprova emissor, audiència i subjecte exactes. Si retorna AuthorizationFailed, revisa l’abast dels rols i la seva propagació. Si falten variables, configura-les a l’entorn `dev`.

## Estat actual

Codi i workflow preparats. La vinculació només estarà activa després de crear la identitat a Azure, configurar l’entorn GitHub i obtenir una execució correcta del workflow. No s’ha configurat cap replica ni site recovery.

## Correspondència exacta del subjecte OIDC

El primer intent real del workflow ha mostrat el subjecte `repo:inforstartup19@354242787/dev@1450737434:environment:dev`. La credencial federada ha de coincidir exactament amb aquest valor, incloent-hi els IDs, l’emissor i l’audiència. La configuració anterior sense IDs provocava `AADSTS700213`.

Per actualitzar una vinculació ja creada, fes `git pull --ff-only` i executa `terraform plan -out=github-subject.tfplan` des de `infra/terraform/github-identity`, amb el backend existent inicialitzat. Revisa que només s’actualitzi el subjecte de la credencial; aplica aquest pla i torna a executar el workflow. No cal `az logout`, crear secrets ni substituir la identitat administrada.


## Auditoria Alembic DEV — bloqueig OIDC del 15 de novembre de 2026

El workflow de lectura [IncForStartUp DEV Alembic inventory](https://github.com/inforstartup19/dev/actions/runs/43708319091) ha arrencat, però la connexió Azure ha retornat **AADSTS700213**: la credencial federada d'Azure encara no coincideix amb el subjecte emès ara per GitHub.

- **Subjecte presentat pel token GitHub:** `repo:inforstartup19@354242787/dev@1450737434:environment:dev`.
- **Subjecte que figurava al Terraform anterior:** `repo:IncFortartUp19@354242787/dev@1450737434:environment:dev`.
- La identitat d'usuari de GitHub té el mateix identificador numèric; el propietari del repositori ha canviat de nom. Emissor i audiència mantenen els valors documentats.
- El fitxer `infra/terraform/github-identity/main.tf` s'ha actualitzat a Git, però **cap credencial federada d'Azure s'ha actualitzat encara**. Un canvi de Terraform al repositori no aplica infraestructura.

**Acció d'un operador Azure autoritzat, abans de repetir l'auditoria:** comprovar el backend i la subscripció correctes, executar un `terraform plan` des de `infra/terraform/github-identity`, confirmar que únicament es modifica el subjecte de la credencial federada `github-dev`, i aplicar només després de revisar el pla. No eliminar la identitat ni substituir el rol Contributor. Si el pla proposa altres canvis, aturar i investigar abans d'aplicar.

Un cop la credencial federada coincideixi a Azure, repetir el workflow d'inventari **només lectura**. Encara no llegirà `alembic_version` si PostgreSQL està en xarxa privada: per això caldrà una connexió SQL de lectura autoritzada des de la xarxa adequada. El gate #27 continua en **NO GO** per a migracions en entorns existents.
