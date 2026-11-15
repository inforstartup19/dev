# Infraestructura Inc Campus: Terraform + Ansible + laboratoris/VDI

**Decisió:** arquitectura proposada, **no desplegada**. Cap canvi a `main`, cap `terraform apply`, cap VM ni PostgreSQL Azure nou sense aprovació.

## Auditoria real a `dev` (15/11/2026)

- Terraform existent: `bootstrap/` (estat), `github-identity/` (OIDC), `environments/dev/` (RG, VNet, subxarxes, Key Vault privat, ACR, Container Apps, Log Analytics). Proveïdor AzureRM `~>4.0` i Terraform `~>1.13`.
- No existeixen `environments/preprod` ni `prod`; la política d'entorns ho demana però no aprova la provisió.
- `terraform-plan.yml` i `terraform-apply.yml` són manuals i **només executables quan el ref és `main`**. No canviar-los a `dev` sense revisar OIDC/RBAC, aprovacions i efectes de xarxa; actualment no hem desplegat.
- No hi havia cap capa d'Ansible ni mòdul de virtual desktops.
- Segregació recomanada: `platform-dev`, `campus-control-plane`, `campus-labs` i futur `preprod/prod`; cada estat remot independent, cap accés a secrets de l'altre.
- Polítiques d'Azure: quota màxima, pressupostos i avisos, accessos RBAC amb OIDC federat i aprovacions de `apply` explícites. No guardar plans amb secrets ni credencials al repositori.

## Responsabilitats i ordre

```text
Git dev -> CI test/lint/scan (sense cloud)
           |
           +-> Terraform (pla revisat) -> xarxa/identitats/AVD host pools
                                         |
                                         +-> Build imatges Packer/Image Builder (futur)
                                                |
                                                +-> Ansible (configuració d'OS, eines, hardening)
                                                       |
                                                       +-> smoke, signatura imatge, publicació
                                                            |
                                                            +-> Inc Campus Lab Broker (futur):
                                                               demana/autorització/cost/TTL
                                                               no crida Terraform directament
```

**Terraform** té la propietat dels recursos, estats, xarxes, host pools, permisos i budgets. **Ansible** de la configuració declarativa i idempotent de màquines/imatges (paquets, usuaris de servei, agents, polítiques i proves). No usarem Ansible per crear recursos que ja governa Terraform. Un `lab-broker` amb identitat pròpia i permisos mínims tramitarà peticions de sessions sense oferir credencials del cloud a l'estudiant.

## Producte: Laboratori virtual dins de cada espai universitari

`Campus → Universitats → Facultat → Programa → Mòdul → Laboratoris → Entorn virtual`.

Catàleg per tipologia:
- **Web IDE/Jupyter**: primer candidat per programació i dades, sense VDI complet.
- **Linux efímer**: xarxes/DevOps, màquines o contenidors en entorn segmentat, sense privilegi sobre Azure.
- **Azure Virtual Desktop (AVD)**: Windows, eines CAD o programari d'escriptori específic; pools independents per organització/grup segons necessitat. AVD és *servei de lliurament*, no la capa universitària.
- **GPU/multimèdia**: quota especial, temps limitat, programari i llicències autoritzades; pressupost per assignatura.
- **Investigació/reproduïbilitat**: entorn persistent justificat, dades segregades i supervisió.

Per a AVD, primer provar `workspace → host pool → application group → association`, **sense session hosts**, imatges, tokens de registre, credencials, assignacions RBAC ni habilitar accés. Després una PR separada amb imatge, hosting, preflight de quota, Entra ID / RDP/FSLogix, gestió d'identitats institucionals, autoscale i costes. Autoscale requereix permisos i no substitueix la supervisió de consum: https://learn.microsoft.com/en-us/azure/virtual-desktop/autoscale-scaling-plan

**No usar Azure Lab Services com a fonament nou:** finalitza el 28/06/2027: https://learn.microsoft.com/en-us/azure/lab-services/retirement-guide

## Lifecycle de sessió i controls estrictes

`requested → policy_checked → approved → provisioning → ready → occupied → draining → destroyed | failed`.

- `requested`: usuari autentificat, mòdul, tipus, justificació, durada i límit de pressupost.
- `policy_checked`: pertinença verificable a institució/grup, plantilla aprovada, MFA/CA, quota per estudiant/assignatura, horari i llicència.
- `approved`: docent o admin segons llindar de cost; no activar automàticament per la IA.
- `provisioning`: treball de broker asíncron idempotent amb logs; cap credencial Azure en el navegador.
- `ready/occupied`: URL temporal autoritzada, sessió curta, RDP restringit, sense accés lateral a altres universitats.
- `draining/destroyed`: desconnexió/avís, retenció de treball explícita, snapshots només segons política, eliminació i cost verificable.
- Circuit de reversió: errors de provisió, cancel·lació, revocació de matrícula, tancament del mòdul, expirar TTL. No prometre recuperació de dades que s'han eliminat.

Controls: cost forecast per template; quota CPU/GPU i concurrència; tagging `university_id`, `course_id`, `env`, `owner_scope` **sense dades personals**; budgets amb alertes; inventari de software/llicències; desplegaments per regió per compliment; logs sense credencials; resposta a incidents; destrucció programada.

## Organització de codi prevista

```text
infra/
  terraform/
    bootstrap/                         # existent
    github-identity/                   # existent
    environments/dev/                  # existent; sense connexió VDI en aquesta PR
    modules/campus-avd/                # mòdul opcional: control-plane only, no VMs
    environments/preprod|prod/         # FUTUR després aprovació
  ansible/
    ansible.cfg                         # inventari local, no secrets
    inventory.example.ini               # sense endpoints reals
    playbooks/validate-lab-host.yml     # validació local segura; cap instal·lació
    README.md
```

## Gates d'execució

1. Validar HCL i proveïdor via `terraform fmt -check`, `terraform validate` i `terraform test` amb mocks; no executar `apply`.
2. Ansible `--syntax-check`, lint i execució local en CI sense objectius remots; després tests per imatge amb Molecule/VM efímera.
3. Aprovar cost total mensual i per sessió, política de dades, llicències i quotes per universitat abans de crear host pools.
4. Separar identitats de `plan` (lectura) i `apply` amb revisors; GitHub Environments per entorn i comprovacions preflight.
5. Provar session TTL, cancel·lació, destrucció, revocació i no-filtracions entre A/B/C; validar campus professor/alumne/admin.
6. No activar `preprod` ni `prod` fins que el cicle de promoció d'artefacte immutable estigui aprovat.

Referències:
- https://learn.microsoft.com/en-us/azure/developer/terraform/azurerm/configure-azure-virtual-desktop
- https://learn.microsoft.com/en-us/azure/architecture/virtual-desktop/virtual-desktop-get-started
- https://www.redhat.com/en/topics/automation/ansible-vs-terraform

## Dificultats conegudes a resoldre abans del pilot

La documentació pública d'AVD mostra exemples amb versions antigues del proveïdor: adaptar a AzureRM 4.x **i validar amb el lockfile actual** abans de crear host pools. El mòdul no inclou registre de màquines, imatges, DNS, FSLogix ni users/role assignments; per tant és deliberadament inutilitzable com a laboratori final fins a completes aquestes dependències.
