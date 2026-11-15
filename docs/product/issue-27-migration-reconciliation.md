# Issue #27 — auditories i reconciliació del graf Alembic

**Estat:** diagnòstic de codi verificat a les branques dels PR; aquesta PR només prepara l'invariant de graf i el pla, no resol encara la integració de les dues funcionalitats. **No és segur fusionar PR #17 i PR #2 sense reconciliació explícita.**

## Resultat de comparar les branques actuals

| Àrea | PR #17 (base `dev`) | PR #2 (base `main`) | Conflicte |
|---|---|---|---|
| Migració | `0005_idea_drafts.py`, `revision="0005"`, `down_revision="0004"` | `0005_knowledge.py`, `revision="0005"`, `down_revision="0004"` | **Crític:** revisions duplicades; no resoldre amb renombrat únicament de fitxer |
| Models | `IdeaDraft` a `models.py` | `KnowledgeSource` a `models.py` | Incorporar ambdues classes, sense substituir el fitxer |
| API | Router `/v1/idea-drafts` al `main.py` | Router de `knowledge` al `main.py` | Integrar ambdós i verificar política d'autenticació |
| Seguretat | `database_security.py` comprova **6** taules RLS inclosa `idea_drafts` | Comprova **6** inclosa `knowledge_sources` | Integrat haurà de comprovar **7**: 5 preexistents + 2 noves |
| Rol runtime | `runtime-role.sql` concedeix operacions `idea_drafts` | Concedeix operacions `knowledge_sources` | Cal reunió dels GRANTs, sense privilegis extra, ni duplicar `CREATE ROLE` |
| Tests | `test_idea_drafts.py` amb denegació actor aliè, RLS, errors | `test_knowledge.py` amb aprovació/revocació/cites | S'han d'executar conjuntament, també amb PostgreSQL real |

Comparació via API GitHub: PR #17 inclou 26 fitxers modificats respecte `dev`; PR #2 n'inclou 8 respecte `main`. A més, els PR tenen bases diferents. La PR #26 és una demo conceptual i no aporta backend per reconciliar.

## Estratègia de migració escollida per a la proposta (sense executar)

**Seqüència lineal:**

```
0004 (base comuna)
  ↓
0005 (idea_drafts, de PR #17; sense canviar el seu ID)
  ↓
0006 (knowledge_sources, migració de PR #2 adaptada)
```

- **No** canviar identificadors de migracions aplicades a entorns que ja tinguin dades.
- Abans d'adoptar aquesta seqüència, fer inventari de `SELECT version_num FROM alembic_version;` en els entorns reals, només amb autorització, sense revelar dades sensibles.
- Si algun entorn ja aplica **l'altre** `0005` de knowledge, aturar. Dos esquemes diferents amb la mateixa `version_num=0005` no es poden distingir amb el metadada d'Alembic. Cal inspecció de `information_schema` i procediment de reconciliació específic abans de continuar.
- Afegir `knowledge_sources` en una branca correctora sobre la PR #17, preservant el seu model i API de draft. La nova migració ha de tenir `revision="0006"`, `down_revision="0005"` i restablir les mateixes polítiques RLS de knowledge.
- Integrar `KnowledgeSource`, router, comprovacions de seguretat i permisos de rols. **No usar el fitxer sencer de cap branca per sobreescriure l'altra.**
- Ambdues taules han de tenir `ENABLE` i `FORCE ROW LEVEL SECURITY`, i el rol de runtime mai ha de tenir superuser, propietat, `BYPASSRLS` o `CREATE` en public.
- Per `downgrade`, provar `0006 → 0005` i `0005 → 0004` exclusivament en PostgreSQL efímer, amb dades de prova. `downgrade` de taules amb dades és potencialment destructiu, **no** és una estratègia de rollback en producció. Un rollback productiu requereix pla de restauració i compatibilitat.
- Abans d'aplicar, revisar la política d'aprovació i les referències de `KnowledgeSource` i no validar com a RAG de producció sense proves d'accés després de revocació.

## Comprovació afegida

`python apps/api/scripts/check_migration_graph.py`

Revisa revisions duplicades, pares inexistents, múltiples caps de migració i sintaxi/assignacions canòniques. Serveix per detectar regressions quan les dues branques es combinen. No substitueix `alembic upgrade head`, `alembic downgrade`, les proves RLS ni CI. **Encara no està incorporada a CI** i s'ha de provar en l'entorn del repositori.

## Gate d'acceptació #27

- [x] Identificat conflicte de revision ID, models, rutatge, guard de RLS i GRANTs.
- [x] Definida estratègia lineal i escenari d'error en entorns amb `0005` divergent.
- [x] Afegit preflight estàtic al repositori en branca separada.
- [ ] Execució del preflight i tests unitaris en entorn local/CI real.
- [ ] PR combinada de migracions `0005 → 0006` i integració completa de models/routers/rols.
- [ ] Test amb PostgreSQL efímer: upgrade 0004→0005→0006 i downgrade 0006→0005→0004.
- [ ] Proves simultànies d'idees i knowledge, amb actor A/B, retirada d'aprovació i rol runtime no privilegiat.
- [ ] Revisió de `dev` i aprovació explícita abans de cap merge.
- [ ] Actualitzar la issue #27 amb evidències d'execució abans de tancar-la.

## Fase següent: MVP BF Projecte Viu

Fins que passi el gate, mantenir la demo BF de la PR #46 aïllada. El contracte primer (PR #17 / issue #11) és: pregunta obligatòria, intenció/nom/propera prova opcionals, autenticació, desat i recuperació, estat privat immutable en aquesta etapa. A continuació: prova activa (#12), resultat/evidència (#13), decisió humana (#14), ampliació progressiva (#15). L'accés real no es pot basar en les condicions visuals de la demo; cal l'ACL d'API i RLS testades amb comptes diferents.
