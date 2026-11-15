# Gate #27 — auditoria de revisions Alembic abans d'integrar a `dev`

**Estat: pendent de l'inventari read-only de les bases de dades existents.** Aquest document registra les comprovacions necessàries, però no afirma que s'hagin executat sobre Azure, PostgreSQL real ni cap entorn de producció.

## 1. Cadena de codi que ha passat CI (en branques apilades)

| Revisió | Objecte | Branca/PR |
| --- | --- | --- |
| `0004` | Punt de partida existent | `dev` |
| `0005` | `idea_drafts`, propietari i RLS | PR #17 |
| `0006` | `knowledge_sources` autoritzades | PR #47 |
| `0007` | Proves, resultats i evidències declarades | PR #48 |

La PR #48 ha passat els workflows *Campus API* (SQLite i PostgreSQL), *Campus connected flow* i *Repository checks*, amb el HEAD `64420a1` en el moment de documentar-ho. Això verifica la cadena en bases de prova noves, **no els estats d'una base ja migrada**.

### Risc conegut

Abans de reconciliar, les branques de la fitxa curta i del coneixement definien una revisió `0005` diferent. Si una base real ja va executar la versió alternativa de `0005`, el simple registre de `alembic_version = '0005'` **no permet distingir què va executar**. Ni `alembic upgrade head` ni `alembic stamp` poden aplicar-se a cegues.

## 2. Evidències a recollir per cada entorn (sense modificar res)

Identificar **nom de l'entorn i host lògic**, responsable i data de la lectura, sense desar cadenes de connexió, contrasenyes ni dades personals a GitHub.

A través d'una connexió **read-only** al PostgreSQL de l'entorn:

```sql
-- 1. Revisions que la base declara com a aplicades
SELECT version_num FROM alembic_version;

-- 2. Presència de les taules associades al conflicte i a les migracions següents
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'idea_drafts',
    'knowledge_sources',
    'project_experiments',
    'experiment_results',
    'experiment_evidence'
  )
ORDER BY table_name;

-- 3. RLS activada i forçada a aquestes taules, si existeixen
SELECT n.nspname AS schema_name, c.relname AS table_name,
       c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'idea_drafts', 'knowledge_sources', 'project_experiments',
    'experiment_results', 'experiment_evidence'
  )
ORDER BY c.relname;
```

Comprovar també si existeixen altres esquemes, bases o repositoris de dades associats al mateix entorn. La presència de taules és **un indicador**, no una prova exhaustiva de quin SQL es va aplicar; per a un estat `0005` ambigu cal inspeccionar també columnes, constraints, índexs i registres de desplegament.

## 3. Matriu de decisió

| Estat observat | Acció |
| --- | --- |
| Base nova/sense migracions | Desplegament només en **preproducció aïllada** amb revisió i backup aplicables |
| `0004` i sense artefactes conflictius | Candidata a l'upgrade ordenat després de proves, backup i autorització |
| `0005` amb `idea_drafts` i sense la versió alternativa coneguda | Revisar esquema i verificar traçabilitat abans de `0006` |
| `0005` amb `knowledge_sources` o contingut incongruent | **NO GO**; documentar comparació real i preparar migració correctiva específica, sense `stamp` |
| `0006` / `0007` | Verificar que correspon a les revisions i al DDL esperats; no assumir-ne equivalència pel número |
| Sense accés read-only o estat desconegut | **NO GO** per a migracions en entorns reals |

## 4. Condicions del merge de #17 → #47 → #48

- [ ] Confirmar entorns que contenen PostgreSQL i responsables d'operació.
- [ ] Registrar lectura read-only de `alembic_version`, taules i RLS per entorn, sense dades sensibles.
- [ ] Resoldre qualsevol `0005` ambigu amb un pla de migració explícit, revisat i provat en una còpia aïllada.
- [x] Proves de codi de la cadena apilada correctes en GitHub Actions (HEAD #48 `64420a1`).
- [ ] Revisió final del diff i permisos, incloses restriccions de l'API i casuística de revocació.
- [ ] Validar l'últim SHA de cada PR després d'actualitzacions de base i repetir CI si canvia.
- [ ] Aprovar el merge individualment en ordre (PR #17, després #47, després #48), revisant cada vegada la base i l'abast de cada PR.
- [ ] Provar el recorregut de la web Next.js a l'entorn previst. **CI apilada verda no vol dir UI de Projecte Viu completa.**

**Sense aquests passos no s'ha d'executar cap `upgrade`, `stamp` o `apply` contra un entorn amb dades existents.** La lectura de l'estat real de la base requereix accés autoritzat a l'entorn; el connector GitHub no aporta aquest estat.

Referències: [Issue #27](https://github.com/inforstartup19/dev/issues/27), [PR #17](https://github.com/inforstartup19/dev/pull/17), [PR #47](https://github.com/inforstartup19/dev/pull/47), [PR #48](https://github.com/inforstartup19/dev/pull/48).
