# Contribuir a IncForStartUp

El codi de la plataforma es desenvolupa de manera incremental, amb revisions i comprovacions abans de cada integració.

## Branques i pull requests

1. `main` és la branca predeterminada del repositori i el punt d'entrada de la documentació general.
2. `dev` és la branca d'integració del producte en desenvolupament.
3. Crea una branca de treball amb un objectiu concret (`feat/`, `fix/`, `docs/` o `chore/`). Per als canvis de producte, obre habitualment una PR cap a `dev`.
4. Quan un canvi depèn de codi encara no fusionat, pots crear una **PR apilada** cap a la branca anterior. Exemple: `feat/issue-11-short-project-card` → `fix/issue-27-combined-idea-knowledge` → `feat/projecte-viu-experiments-evidence`.
5. Comprova el diff i els workflows de la PR, documenta la validació i resol els bloquejos abans de considerar el merge. Després de cada merge, actualitza/revisa la base de la següent PR.
6. Canvis cap a `main` han de ser conscients i revisats, especialment per a publicacions o infraestructura. Una PR aprovada no implica desplegament automàtic.

## Validacions

La comprovació bàsica des de l'arrel requereix Python 3.11 o superior:

```bash
python3 scripts/check_repo.py
```

Per a la web Next.js, consulta [apps/web/README.md](apps/web/README.md); per a l'API FastAPI, les migracions i les proves SQLite/PostgreSQL, consulta [apps/api/README.md](apps/api/README.md). GitHub Actions verifica també les suites connectades segons el canvi.

**Abans de canviar migracions Alembic:** comprova que el graf de revisions és lineal o que la fusió està explicitada i valida la compatibilitat amb les bases de dades existents. La CI sobre una base neta **no** demostra que sigui segur aplicar una migració sobre un entorn ja desplegat. Sense verificar l'historial de la base real, no executar cap `upgrade` sobre dades reals.

Per a Terraform, inspecciona un `plan` abans de qualsevol `apply`. Els workflows de CI, un `plan` i un `apply` tenen propòsits diferents.

## Format, seguretat i traçabilitat

- Usa UTF-8, salts de línia LF i un salt de línia final; `.editorconfig` defineix el format compartit.
- No incloguis contrasenyes, tokens, claus privades, estats Terraform, plans amb dades sensibles ni fitxers `.env` reals.
- Mantén variables d'exemple en `.env.example` sense valors sensibles.
- Afegeix o actualitza tests i documentació per als canvis de comportament.
- Identifica el número de la issue i conserva proves de CI, decisions i limitacions de privacitat.
- Els permisos d'usuari i la visibilitat d'un projecte no s'han de modificar implícitament per afegir-hi funcions o col·laboradors.

La protecció de branques, els reviewers obligatoris i les regles de publicació s'han de comprovar a la configuració efectiva de GitHub; no es consideren actius només per estar descrits aquí.
