# Full de ruta Supabase–Azure i Campus

Decisió del 17 de novembre de 2026: Supabase serà la base principal d’IncForStartUp; Azure allotjarà web/API, identitat interna, laboratoris i processos analítics. No s’ha executat cap migració productiva ni contractat cap ampliació de pla.

## Issues per apartat

| Issue | Lliurable |
|---|---|
| [#89](https://github.com/inforstartup19/dev/issues/89) | Supabase com a base principal d’IncForStartUp |
| [#90](https://github.com/inforstartup19/dev/issues/90) | Supabase Auth i permisos contextuals del portal |
| [#91](https://github.com/inforstartup19/dev/issues/91) | Supabase Storage privat i versions d’entregues |
| [#92](https://github.com/inforstartup19/dev/issues/92) | Allotjament del portal i API amb Supabase |
| [#93](https://github.com/inforstartup19/dev/issues/93) | Entra ID per gestió interna i accés federat al portal |
| [#94](https://github.com/inforstartup19/dev/issues/94) | Entorns VDI universitaris provisionats pel Lab Broker |
| [#95](https://github.com/inforstartup19/dev/issues/95) | Data Factory per ingesta autoritzada i incremental |
| [#96](https://github.com/inforstartup19/dev/issues/96) | Databricks per transformacions versionades i retorn al portal |
| [#97](https://github.com/inforstartup19/dev/issues/97) | DNS i Key Vault per dominis i secrets d’IncForStartUp |
| [#98](https://github.com/inforstartup19/dev/issues/98) | Laboratori vinculat a una tasca TFG/TFM |
| [#99](https://github.com/inforstartup19/dev/issues/99) | Passaport de datasets i traçabilitat de transformacions |
| [#100](https://github.com/inforstartup19/dev/issues/100) | Biblioteca de datasets compartits entre universitats |
| [#101](https://github.com/inforstartup19/dev/issues/101) | Connexions explicables entre projectes i TFG/TFM |
| [#102](https://github.com/inforstartup19/dev/issues/102) | Reproducció d’experiments amb dades, codi i entorn |
| [#103](https://github.com/inforstartup19/dev/issues/103) | Assistent del Campus amb evidències i cites autoritzades |
| [#104](https://github.com/inforstartup19/dev/issues/104) | Pressupost i límits operatius per projecte i laboratori |
| [#105](https://github.com/inforstartup19/dev/issues/105) | Canvi d’idioma català / anglès a tot el portal |

## Ordre executable

1. #86: recuperar esborranys del circuit existent abans del pilot i de canviar l’idioma.
2. #89: reconciliar FastAPI/Alembic i qc_*; definir esquema autoritatiu i pla de migració DEV.
3. #90: sessions reals i permisos contextuals; s’alinea amb #83 i substitueix qualsevol confiança en selectors de demo.
4. #91: documents versionats, privats i recuperables; #105 pot avançar quan la recuperació de formularis sigui estable.
5. #92, #93, #97: preparar web/API, identitat interna, dominis i secrets a Azure.
6. #99 i #103: procedència dels datasets i assistent amb cites autoritzades.
7. #104 abans de provisionar recursos; #94 i #98 per laboratoris.
8. #95 i #96 per ingesta/transformació; #100, #101 i #102 per reutilització, connexions i reproducció.

Les dependències no impliquen desplegar serveis abans de necessitar-los. Els èpics existents continuen oberts i vinculats a les noves issues. #105 crea la feina d’internacionalització; encara no hi ha un selector anglès implementat.

## Primer increment de #86

Esborranys persistents de proposta TFG/TFM, retorn docent i Coworking. Separació per treball, perfil, formulari i versió acadèmica. Restauració sense presentar; només es neteja el context desat correctament. Validació profunda, no sobreescriptura d’historial corrupte, detecció de canvis de pestanya i exportació de text en memòria i originals no recuperables. LocalStorage no garanteix atomicitat entre pestanyes ni sincronització entre dispositius.

57 proves Node passen, incloses 8 noves proves de recuperació, quota, corrupció, conflictes i circuit V1/retorn/V2. QA manual PC/iPhone 15 Pro pendent: #86 no es tanca. Sense publicació al Site, merge a dev ni canvi de Supabase en aquest increment. El nou editor Kanban de #88 manté la seva recuperació en memòria pendent d’unificar; no s’ha confós amb els formularis de proposta de #86.

