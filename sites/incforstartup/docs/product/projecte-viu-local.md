# Projecte Viu — circuit local dins de Quelcom

Nova idea → fitxa pròpia → preparar prova → registrar resultat/evidències →
decisió humana → següent prova. Formar guarda necessitats i proposa pistes
educatives dins del mateix projecte. Historial conserva resultats i decisions.

Nom, intenció, origen i propera prova poden quedar pendents; només cal la pregunta.
Un títol provisional es deriva de la pregunta si no s'indica. La identitat del
projecte es conserva i les proves completades no són substituïdes per les noves.
Pausar o tancar és reversible amb Continuar, sense esborrar cap dada.

Reutilitza `incforstartup.workspace.v1`: amplia cada projecte amb `live`,
conserva propietats i historial previs, i no modifica `lab` ni `records`.
Exportació JSON compatible amb el format existent. Cap import nou en aquest increment.
Els botons Nou projecte/Nova idea i les fitxes existents obren l'experiència nova.
La demo fictícia d'Explorar continua separada dels projectes propis; les idees
pròpies no es publiquen a Explorar. El meu espai manté el login pendent i ofereix
Demostració local per accedir al tauler de Projectes Vius.

Límits: desat local, no backend, ACL, IA, equip real, publicació ni càrrega de fitxers.
Les evidències són text/referències. No s'ha completat QA visual/Safari en aquesta ronda.
Proves automatitzades: creació mínima, prova/resultat/decisió, reinici des de JSON,
pausa/tancament reversibles, preservació del llegat, validació i rollback si storage falla.
