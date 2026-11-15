# Inc Campus — estructura acadèmica oberta i verificable

**Estat:** proposta de producte basada en catàlegs oficials; cap integració acadèmica ni tractament de dades estudiantils en producció. **Pilot:** BF i dades sintètiques.

## Fonts acadèmiques i aprenentatges

| Institució / programa | Tipologies observables | Conseqüència de producte |
| --- | --- | --- |
| UPC · FIB Enginyeria Informàtica (catàleg 2026–27) | formació bàsica, obligatòries, especialitat, optatives, projectes, TFG; enginyeria del software, IA, sistemes, viabilitat | catàleg d'assignatures per període i itinerari, projectes transversals i laboratoris especialitzats |
| UPC · Emprenedoria i Innovació | projectes interdisciplinaris, Lean Startup, Canvas, metodologia àgil, entitats externes i equips | reptes externs, incubació, milestones i transferència a startup |
| UAB · Gestió d'Empreses / Empresa i Tecnologia | emprenedoria, pràctiques externes, estades en empresa, TFG, optatives i guies docents | convenis/propostes externes sense confondre-les amb contractes; seguiment docent |
| UB · Lingüística / ensenyaments | programes de matèries, TFG i pràctiques curriculars/no curriculars | camps i laboratoris no tecnològics; tipologia sector-neutral |
| UOC · Grau Enginyeria Informàtica | treball en equip a la xarxa, projectes programari, pràctiques, TFG, optatives | espais híbrids/asíncrons, metodologia per lliurables |
| UOC · Grau d'Arts (laboratoris virtuals) | laboratoris de documentació, disseny, fotografia, programació i creació vinculats a assignatures | laboratori com a recurs d'assignatura, no sols un VDI Windows |

Fonts oficials:
- UPC FIB, assignatures: https://www.fib.upc.edu/ca/graus/grau-en-enginyeria-informatica/pla-destudis/assignatures
- UPC FIB, estructura ECTS i TFG: https://www.fib.upc.edu/ca/graus/grau-en-enginyeria-informatica/pla-destudis
- UPC Emprenedoria: https://www.fib.upc.edu/ca/graus/grau-en-ciencia-i-enginyeria-de-dades/pla-destudis/assignatures/EI-GCED
- UAB Pla d'estudis: https://www.uab.cat/web/estudiar/llistat-de-graus/pla-d-estudis/pla-d-estudis-i-horaris-1345467811493.html?param1=1265372034497
- UAB guies: https://www.uab.cat/sites/ContentServer/estudiar/llistat-de-graus/pla-d-estudis/guies-docents-1345467811508.html?param1=1231314902485
- UB Lingüística: https://linguistica.ub.edu/grau-de-linguistica
- UOC grau: https://www.uoc.edu/ca/estudis/graus/grau-enginyeria-informatica
- UOC laboratoris Arts: https://www.uoc.edu/content/dam/studies/documents/pdf/ca/PC01461_2.pdf

## Taxonomia, no un currículum únic

`institution → faculty/school → degree/program → academic_year → term → course/module → cohort/group → activity/project → resource/lab`.

- `institution`: universitat, campus, polítiques d'identitat i governança institucional.
- `faculty` / `program`: estructura i itinerari; identificadors externs mai pressuposen equivalència.
- `course`: codi d'assignatura, ECTS, tipologia (bàsica, obligatòria, optativa, pràctica, projecte, TFG/TFM, microcredencial), resultats d'aprenentatge i font/any de vigència.
- `cohort`: matrícula/adscripció verificada per la universitat; cap rol derivat d'una faceta autodeclarada.
- `activity`: treball individual, equip, repte, laboratori, recerca, incubació, pràctiques i revisió.
- `lab_template`: web IDE, Linux, Windows AVD, GPU, dades, multimèdia o CAD; costos, durada, imatge, xarxa i habilitació.
- `project_link`: vinculació **opt-in i amb permisos** entre activitat acadèmica i Projecte Viu que pot continuar com startup/empresa sense traspassar dades acadèmiques per defecte.

## Regles de governança

1. No importem planes docents com a dades operatives fins a conveni/permís/identificador i versió acadèmica confirmats. La documentació pública és **referència**, no autorització de sincronització.
2. Els cursos canvien cada any: `source_url`, `source_updated_at`, `academic_year` i revisió humana abans de publicar cap programa.
3. Rols separats: estudiant, docent, coordinador, administració TI i mentor extern. Cap rol campus implica accés a Projecte Viu privat o a laboratoris aliens.
4. Una assignatura no és una empresa; el TFG/TFM pot generar un projecte incubat, amb consentiment i projeccions selectives.
5. Dades educatives, resultats, notes, sessions i identitat estudiantil requereixen minimització, retenció i controls institucionals.
6. Primer pilot de producte: **un mòdul interdisciplinari sobre emprenedoria, una necessitat BF publicada selectivament i un laboratori sintètic**. Sense dades d'estudiants reals.

## Contrastos pendents abans de modelar la BD

Validar amb una universitat partner: SSO/SAML/OIDC, LMS (Moodle/Canvas), LTI 1.3 / OneRoster quan pertoqui, matrícula/catàleg, calendari, processos d'autorització, exercicis i rol legal de les dades. No assumir que cap integració és disponible.
