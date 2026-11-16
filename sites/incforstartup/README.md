# IncForStartUp / Quelcom — codi complet del Site

Snapshot del Site publicat, origen `fbfabe6328ebc74430c229ce35da29d8ca6e2650`.
IncForStartUp és el projecte mare; Quelcom és l’experiència de campus i projectes.
Els assets de `public/` es conserven amb normalització d’espais finals, verificables al manifest
`docs/site-source-manifest.json`. No es copia configuració privada de Sites ni dades del navegador.

## Executar

```sh
python3 -m http.server 4173 --directory sites/incforstartup/public
```

Obre http://localhost:4173. No cal compilació per al Site estàtic.

## Recorreguts implementats

| Ruta | Funció |
| --- | --- |
| Arrel / #entrada | Portada 0.3, òrbites i viatge |
| #inici | Campus universitari: arribada directa des de Quelcom |
| #noves-idees | Nova idea: tres perspectives Explorar, Investigar, Formar |
| #explorar | Observatori amb idees fictícies, filtres i desades |
| #demo-fitxa / #demo-desades | Fitxa de mostra i biblioteca local |
| #investigar / #formar | Laboratori demo i recorregut d’aprenentatge |
| #espai / #login | Cinc accessos pendents i escenaris simulats |
| #campus-demo / #espai-demo | Campus universitari fictici amb tres blocs |
| #uni-comunitat / #uni-oportunitats | Comunitat i proposta local de participació |
| #uni-projecte / #uni-revisio | Resum compartit i revisió docent simulada |
| #projectes | Tauler local dels Projectes Vius |
| #nova-idea | Pregunta mínima, intenció i context opcionals |
| #viu/ID/resum | Fitxa i decisions del projecte |
| #viu/ID/investigar | Prova, criteri, resultat i evidències textuals |
| #viu/ID/formar | Necessitats de coneixement, persones i recursos |
| #viu/ID/historial | Proves completades, decisions i versions |

Projectes desats a `incforstartup.workspace.v1`; demo fictícia a `quelcom.demo.v1`.
Exportació JSON disponible. Pausar/tancar no esborra el projecte. Cap publicació
ni invitació real. No hi ha autenticació, ACL entre usuaris, IA connectada,
matrícula, laboratoris remots ni càrrega de documents en aquest Site.

El frontend autenticat de `apps/web` i l’API són una implementació separada.
El selector de login preparat a #82 requereix activació de proveïdors (#83).
La integració visual React segueix a #81. Aquest snapshot no resol aquesta integració.

## Validació

```sh
node --test sites/incforstartup/tests/*.test.cjs
python3 scripts/check_repo.py
```

El CI executa les proves estàtiques. Inclou persistència, geometria, navegació,
Projecte Viu, entrades mínimes i fallades de storage. QA visual completa,
Safari/iOS i proveïdors reals continuen pendents.

`quelcom-preview/` conserva la previsualització anterior de #82; la versió completa
actual és `public/`. `entrada-dev.html` conserva l’experiment anterior separat.
La publicació a Sites segueix un flux propi: aquesta còpia no desplega Azure ni GitHub Pages.

## Fiabilitat del Projecte Viu

Propera acció segons estat, recuperació d’esborranys per formulari, indicador de desat,
exportació de text pendent i detecció de canvis d’una altra pestanya abans de confirmar.
Les vistes antigues no tenen encara la mateixa protecció. QA mòbil real pendent.

Campus fase 0: [recorregut i límits](docs/product/university-campus-phase0.md).

Espais de mostra: `#uni-a`, `#uni-b`, `#uni-equip` i `#uni-cotutoria`.

Campus: `#coworking`, `#sala-materials`, `#biblioteca`, `#biblioteca-projecte`, `#universitats`. Notes i recursos desats només al navegador; connectors pendents de configuració.

Viatge: llum central translúcida darrere les estrelles; densitat progressiva fins a 1290 partícules en mòbil i 1875 en PC. Durada i moviment reduït preservats. Revisió visual en dispositiu pendent.
