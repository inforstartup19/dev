# Recorreguts de dades Supabase–Azure

Data: 17 de novembre de 2026. Proposta preparada per implementació progressiva; serveis Azure no desplegats.

| Issue | Lliurable |
|---|---|
| [#108](https://github.com/inforstartup19/dev/issues/108) | [P1][Dades] ADLS Bronze/Silver/Gold amb aïllament i retenció |
| [#109](https://github.com/inforstartup19/dev/issues/109) | [P0][Dades] Contracte d’execució i API de retorn Azure–Supabase |
| [#110](https://github.com/inforstartup19/dev/issues/110) | [P1][Pilot] TFG CSV: Supabase → Azure → resultat revisable |
| [#111](https://github.com/inforstartup19/dev/issues/111) | [P2][Analítica] Synapse i Power BI per seguiment universitari |
| [#112](https://github.com/inforstartup19/dev/issues/112) | [P2][Temps real] Outbox Supabase, Event Hubs i Stream Analytics |
| [#113](https://github.com/inforstartup19/dev/issues/113) | [P2][Documents] Extracció autoritzada de text, imatge i metadades |
| [#114](https://github.com/inforstartup19/dev/issues/114) | [P2][ML] Models predictius amb Azure ML i Databricks |
| [#115](https://github.com/inforstartup19/dev/issues/115) | [P3][Arquitectura] Criteris per afegir Azure SQL o Cosmos DB |

Ampliades #95 (ADF), #96 (Databricks i harmonització universitària), #98 (laboratori des de tasca), #99 (passaport/ACL) i #102 (reproducció).

## Recorreguts

| Cas | Origen i processament | Retorn |
|---|---|---|
| CSV TFG (#110) | Supabase Storage + petició → ADF → ADLS → worker mínim | Resultat versionat a la tasca via API; docent revisa |
| Seguiment (#111) | Supabase autoritzat → ADF → ADLS Gold → Synapse → Power BI | Indicadors agregats limitats a cada àmbit |
| Recerca entre universitats (#96) | Datasets seleccionats → Bronze → Databricks → Silver/Gold | Dataset harmonitzat i limitacions, amb permisos |
| Experiments (#98/#102) | Petició Supabase → laboratori Azure/VDI → ADLS | Manifest amb codi, dades, entorn i evidències |
| Temps real (#112) | Outbox Supabase → publicador → Event Hubs → Stream Analytics | Avisos via API; reintents i replay sense duplicats |
| Documents (#113) | Storage → còpia autoritzada → extracció i validació | Text/metadades amb cites al document i versió |
| Models (#114) | Dades autoritzades → ADLS → Databricks/Azure ML | Inferències amb versió, mètriques i límits |

## Ordre

#89 consolidació de dades → #90 identitat real → #91 documents + #109 contracte d’execució → #108 ADLS + #95 ingesta + #104 costos → #110 pilot CSV. La #86 manté QA manual pendent. Synapse, streaming i ML segueixen quan el pilot i la necessitat ho justifiquin. #115 és una avaluació condicionada, no un desplegament de bases addicionals.

## Regles comunes

- ADF és l’orquestrador principal; Databricks transforma quan cal; Synapse serveix analítica. No duplicar el mateix procés entre plataformes.
- Supabase continua com a origen operatiu. Azure rep només còpies amb finalitat, abast, versions i caducitat.
- Retorn autenticat i idempotent amb comprovació de permisos vigents, projecte, versió i esquema. Resultats no aproven automàticament treballs.
- Revocació, eliminacions i permisos de derivacions s’han de propagar explícitament: RLS no viatja amb una còpia.
- El portal continua disponible quan l’analítica falla; estat i errors explicats a l’usuari.
- Registre d’intents, costos, origen, codi/model, versions i destinataris. Originals no es reescriuen.

Referències tècniques consultades: https://learn.microsoft.com/en-us/azure/data-factory/connector-postgresql ; https://learn.microsoft.com/en-us/azure/databricks/lakehouse/medallion ; https://learn.microsoft.com/en-us/azure/stream-analytics/stream-analytics-add-inputs ; https://learn.microsoft.com/en-us/azure/synapse-analytics/sql/overview-architecture .

