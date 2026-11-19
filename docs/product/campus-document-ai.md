# Documents privats i Inc AI al Campus

El pilot admet PDF, Word (DOC/DOCX), Excel (XLS/XLSX) i PowerPoint (PPT/PPTX), fins a 50 MiB per fitxer (52.428.800 bytes; la interfície mostra 50 MB). Cada càrrega crea una versió immutable al bucket privat `qc-campus-documents`. L'estudiant i el docent assignat poden consultar el document; cap original ni anàlisi es publica automàticament a la biblioteca.

## Experiència

1. Adjunta el document dins del treball TFG, TFM o TR.
2. Per a un document de fins a 10 MiB, selecciona «Analitza amb Inc AI», escriu opcionalment una pregunta i autoritza expressament enviar aquest fitxer a OpenAI per analitzar-lo.
3. L'anàlisi privada conté resum, millores, idees, preguntes i limitacions. Conserva nom, versió, SHA-256, model i data. La referència és al fitxer original: no es prometen cites de pàgina o cel·la verificades.
4. «Prepara una tasca» transforma una proposta en un esborrany editable. L'usuari decideix si el desa. La IA no aprova treballs, modifica notes ni publica aprenentatges.

## Activació segura

La funció `campus-document-review` usa secrets exclusivament de servidor, a **Supabase → Edge Functions → Secrets**:

- `OPENAI_API_KEY`: clau d'un projecte API d'OpenAI amb pressupost i límits del pilot.
- `INC_AI_MODEL`: `gpt-4.1-mini` és una opció compatible per al pilot; cal habilitar-lo al compte API. És l’identificador d'un model d'aquest compte compatible amb Responses API, fitxers PDF/visió i Structured Outputs. No s'assumeix un model ni s'inicia despesa si no està configurat.

Les variables estàndard `SUPABASE_URL`, `SUPABASE_ANON_KEY` i `SUPABASE_SERVICE_ROLE_KEY` les proporciona Supabase. No s'han de copiar secrets al frontend, al repositori ni al xat. Una subscripció de ChatGPT o un canvi de pla de Supabase no configura aquesta integració.

Sense les dues variables de proveïdor, l'endpoint autenticat retorna `available:false` i la UI mostra que la IA està pendent d'activació. Els adjunts continuen funcionant. Cal validar una anàlisi sintètica amb el model seleccionat abans d'usar documents reals.

## Contracte i controls

- GET `/functions/v1/campus-document-review`: estat del servei, només per a participants autenticats i actius.
- POST: `{projectId,storageName,requestId,question,consent:true}`. No accepta URLs externes ni un actor proporcionat pel client.
- Auth valida el JWT i el compte verificat. La consulta del projecte i la lectura de Storage es fan amb el JWT de l'usuari i RLS.
- El servidor valida estructura/format, calcula SHA-256 i reclama una anàlisi mitjançant RPC exclusiu de `service_role`. L'actor ve de l'usuari verificat. El servidor revalida permisos abans de guardar.
- Límit de 10 peticions per hora i usuari; una anàlisi simultània per treball; arrendament de 120 segons, proveïdor amb timeout de 60 segons. L'identificador de petició fa els reintents idempotents.
- `qc_document_reviews` té RLS de lectura per membre actual i cap escriptura directa del client. Els resultats completats són immutables; fallades i processaments en curs es distingeixen.
- OpenAI Responses API rep el fitxer en base64, `store:false`, sense eines, URLs públiques ni fitxers persistits a Files API. `store:false` no equival a una garantia de retenció zero; s'aplica la política de dades del compte API.
- El contingut del document és entrada no fiable: no pot instruir el servidor ni activar eines. Sortida JSON limitada i validada; renderització escapada; cap acció automàtica sobre el projecte.

## Càrregues de fins a 50 MB

A partir de 6 MiB s’utilitza TUS al domini directe de Storage, amb fragments de 6 MiB i progrés accessible. Els reintents consulten l’offset del servidor; el JWT es renova a cada petició i ha de correspondre al compte verificat. No s’activa upsert. La URL de càrrega ha de pertànyer al mateix endpoint de Storage.

La recuperació es manté només en memòria: després d’una interrupció, conserva la mateixa selecció i la pàgina oberta, i torna a prémer el botó. Recarregar la pàgina, canviar de compte o seleccionar un altre fitxer inicia un intent nou. No es desen documents ni tokens de càrrega a localStorage.

La validació del navegador llegeix només les capçaleres i les estructures ZIP necessàries, sense carregar l’original sencer. Els originals poden arribar a 50 MiB; l’anàlisi síncrona continua limitada a 10 MiB per document. Per analitzar-ne un de més gran, prepara un extracte o una versió reduïda; el document complet continua disponible per als membres del treball.

## Límits coneguts

La inspecció estructural no és un antivirus. La signatura OLE dels formats antics no permet distingir DOC/XLS/PPT ni descartar macros incrustades; l'aplicació no les executa. No s'admeten extensions DOCM/XLSM/PPTM. Els OOXML tenen límits de mida expandida declarada, nombre d'entrades i proporció de compressió, sense descompressió local.

La lectura de PDF inclou text i imatges de pàgina. Word/PowerPoint s'analitzen principalment com a text: exportar a PDF quan els gràfics siguin essencials. Excel usa fins a les primeres 1.000 files per full; no és una auditoria ni un càlcul exhaustiu. Documents corruptes, protegits, massa grans o sense contingut interpretable han de mostrar límits/error, mai resultats inventats.

Aquesta primera integració analitza un document cada vegada. Una futura fase pot afegir OCR específic, extracció amb localitzacions verificades, comparació entre versions, càlcul complet d'Excel i síntesi entre documents autoritzats. La biblioteca continua requerint consentiment de l'autoria i revisió docent separats.

## Desplegament i comprovació

Aplicar `supabase/schema/campus-document-ai.sql` després de les migracions del pilot. Desplegar `supabase/functions/campus-document-review/index.ts` amb `verify_jwt=true`, incloent `handler.mjs` i el mòdul compartit `sites/incforstartup/public/campus-document-formats.js` (mateixa ruta relativa). Aplicar després `supabase/schema/campus-document-limit-50mb.sql` per ampliar només el bucket privat a 50 MiB. Publicar el frontend després de la migració i la funció.

Proves locals: `node --test sites/incforstartup/tests/*.test.cjs supabase/tests/campus-document-review.test.mjs`. Proves SQL: `supabase/tests/campus-document-ai.sql`, fixtures sintètiques dins de transacció amb ROLLBACK. Validació real pendent de credencials/model i d'un participant autenticat: pujar els set formats, anàlisi, canvi de permisos, reintent, historial i esborrany de tasca.

Referències primàries verificades el 19/11/2026:
- https://developers.openai.com/api/docs/guides/file-inputs
- https://developers.openai.com/api/docs/guides/your-data
- https://supabase.com/docs/guides/functions/auth-headers
- https://supabase.com/docs/guides/functions/secrets

- https://supabase.com/docs/guides/storage/uploads/resumable-uploads
- https://supabase.com/docs/guides/storage/uploads/file-limits
- https://developers.openai.com/api/docs/models/gpt-4.1-mini
