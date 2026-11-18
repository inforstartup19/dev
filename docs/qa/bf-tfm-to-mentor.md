# BF: del TFM a l’acompanyament de mentorització

Prova executada el 18 de novembre de 2026 sobre la demo estàtica de Quelcom, amb BeFirst com a TFM. Cas de dades sintètiques i perfils simulats: no acredita cap títol, resultat comercial, admissió, assignació de mentor o sessió real.

## Resultat observable

| Fase | Recorregut executat | Resultat |
| --- | --- | --- |
| Proposta TFM | Primera proposta, canvis del docent, segona proposta i revisió | 2 versions i 2 retorns conservats |
| Tauler acadèmic | Abast, recerca, protocol, evidències i continuïtat | 5 tasques revisades en ordre; 6 presentacions, perquè el protocol es reformula |
| Memòria i defensa | Síntesi, límits, assaig de defensa i retorn docent | 1 síntesi revisada; cap nota ni defensa real |
| Continuïtat | Equip, materials, autoria, destinataris i confirmació explícita | Origen TFM conservat; ID `demo-befirst-tfm`, sense duplicar Projecte Viu |
| Crea i creix | Necessitat, proposta, model, MVP i aprenentatge | 5 preparacions desades amb acció, evidència o escenari i pregunta |
| Enlaira | Tracció, clients, operacions, recursos i pla | 5 escenaris prospectius; recursos propis, cap admissió ni escalat |
| Mentorització | Paquet 1, petició de canvis, reformulació, paquet 2 i segon retorn | 2 versions del paquet i 2 retorns de mentor simulats |
| Propera acció | Reformular primer; després preparar una prova acotada | 2 decisions i 9 esdeveniments de continuïtat; recuperació després de recarregar |

Propera acció registrada: revisar consentiment i autoria, aclarir les fitxes de peça i dissenyador i acordar una prova qualitativa amb cinc adults voluntaris. El criteri exploratori 4/5 avalua comprensió d’unicitat, autoria i disponibilitat; no acredita demanda ni representativitat estadística. Reclutament, data i mentor real pendents.

## Comprovacions manuals al navegador

- Una tasca acadèmica posterior queda bloquejada mentre l’anterior no està validada.
- No es pot presentar una tasca sense evidències ni abans de desar els canvis. L’estudiant no disposa del control de validació docent.
- La continuïtat no es pot confirmar abans de revisar la síntesi i defensa de prova.
- El mentor de prova rep la instantània seleccionada, no la memòria sencera ni els esborranys locals.
- Intentar continuar després d’un retorn de canvis es bloqueja i conserva els camps.
- Editar l’MVP invalida el paquet anterior: el mentor no pot revisar-lo fins que es presenti una nova versió.
- La recàrrega conserva la decisió final i l’exportació JSON conté el recorregut realment executat en aquest navegador.
- PC: lectura i navegació del resum complet. Marc responsive de 393 × 852 CSS px: sense desbordament horitzontal, canvi de perfil i obertura d’evidències. Amplada útil observada 378 px amb barra de desplaçament de Chrome. No és una prova de Safari ni d’un iPhone físic.
- A la consola de la comprovació responsive s’han observat errors de l’extensió del navegador; no errors d’aplicació atribuïbles a aquest increment.

## Proves automatitzades

`node --test sites/incforstartup/tests/*.test.cjs`: **101 proves correctes**.

`python3 scripts/check_repo.py`: correcte.

La font del Site passa **79 proves**. El repositori inclou també 22 comprovacions prèvies que no formen part del checkout del Site.

Les proves noves cobreixen TFG i TFM, rols simulats, requisits acadèmics, continuïtat explícita, revisions del mentor, invalidació de versions, retirada reversible, selecció de materials, conflictes entre pestanyes, errors d’emmagatzematge i preservació de camps després d’un error. La prova manual completa s’ha fet amb TFM; TFG es cobreix al model automatitzat.

## Evidències i revisió

- `sites/incforstartup/public/bf-recorregut.html`: resum de lectura del cas executat, disponible des del peu del recorregut BF. No carrega dades al navegador de qui el visita.
- [Exportació de la prova](bf-tfm-mentor-walkthrough.json): proposta, tauler, preparacions, versions, decisions i historial de la simulació, sense dades d’altres projectes.
- [Vista PC](screenshots/bf-complete-journey-desktop.jpg).
- [Comprovació responsive](screenshots/bf-tfm-mobile-393.jpg).
- Rutes editables: `#befirst-tfm-recorregut`, `#befirst-tfm-mentoria` i les equivalents `tfg`.

## Límits i continuació

L’estat editable és local al navegador i no se sincronitza amb el compte d’Omar. El resum de lectura permet consultar la prova completa des d’un altre dispositiu. Els selectors de rol serveixen per assajar l’experiència i no són una frontera de seguretat.

Les issues #132, #135 i #136 continuen obertes: queden la persistència autenticada, permisos de servidor, documents protegits i assignació real de mentors. Aquest increment no modifica Supabase, Azure, el repositori de producció BF, els accessos del Site ni la implementació React de l’aplicació autenticada. La prova manual d’Omar a #126 i Safari/iOS a #55 continuen pendents de la seva verificació.
