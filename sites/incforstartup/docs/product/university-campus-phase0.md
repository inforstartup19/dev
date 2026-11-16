# Campus universitari compartit: fase 0

Demo navegable amb La meva feina, La meva comunitat i Oportunitats per participar. Entrada: #campus-demo (també #espai-demo). Comunitat: #uni-comunitat; necessitat: #uni-oportunitats; resum compartit: #uni-projecte; revisió: #uni-revisio.

Les universitats A i B i el projecte de materials són ficticis. La proposta i la revisió es desen només al navegador, separades dels projectes propis. El selector estudiant/docent és una simulació visual, no autenticació ni autorització. No s’envien invitacions ni es creen membresies.

Circuit de demostració: llegir la necessitat, preparar una aportació, desar-la, seleccionar la vista docent, simular acceptació o no acceptació. Es pot restablir l’estat pendent. Un error de desament conserva el text en memòria i avisa l’usuari.

Implementació posterior: identitat personal amb afiliacions verificades per institució; projecte compartit amb identitat única; membresies explícites i revocables; permisos separats per necessitats, evidències i espais acadèmics; cotutories amb responsabilitats i decisions registrades. Cap afiliació inferida del proveïdor de login concedeix accés automàtic.

Validació automatitzada: rutes, distinció entre mostra i projectes propis, revisió reservada al perfil de demostració docent, persistència, escapament del text i error de quota. QA visual i Safari/iOS pendent: el navegador de comprovació està bloquejat per la política de navegació de l’entorn.

## Campus com a entrada principal

La portada Quelcom conserva el viatge i arriba a #inici, ara Campus. #campus-demo i #espai-demo es mantenen com a àlies compatibles. Nova idea al Campus obre #noves-idees amb les tres perspectives Explorar, Investigar i Formar. La fitxa directa #nova-idea continua disponible des d’aquest recorregut i als projectes propis. El logotip Quelcom de les vistes internes retorna al Campus; Torna a Quelcom al peu del Campus recupera la portada. No es requereix login per consultar la demo.

## Institucions, equip i cotutoria

#uni-a i #uni-b mostren les aportacions, l’activitat acadèmica fictícia i la propera tasca de cada universitat. #uni-equip concreta quatre perfils ficticis, les seves responsabilitats i aportacions. #uni-cotutoria diferencia la revisió compartida del projecte de l’avaluació acadèmica institucional. Comunitat i projecte enllacen aquests espais amb retorn explícit. No es creen membresies, expedients, qualificacions ni invitacions.

El fundador ha validat la visualització mòbil de la versió anterior el 16 de novembre de 2026. Aquest increment reutilitza els components responsius; no s’ha fet una nova verificació visual automatitzada.

## Coworking, Biblioteca i Universitats

Campus ofereix tres accessos i una continuïtat basada en l’últim desament local. #coworking porta a #sala-materials: tasca, nota local, marca de preparació, equip, cotutoria i biblioteca vinculada. #biblioteca permet cercar guies de mostra, filtrar per Personal (desats), Projectes o Comunitat, llegir i desar sense duplicar el recurs. #biblioteca-projecte conserva el retorn a la sala. #universitats mostra institucions fictícies i un repte amb proposta i visita a la sala.

Les connexions institucionals estan plegades per defecte i pendents de configuració: identitat, catàleg, campus virtual i eines de treball. No es connecta cap proveïdor ni s’importen dades. La sala és visitable com a mostra independentment de la proposta; no representa acceptació o membresia real.

Dades a quelcom.campus-hub.v1, només navegador: recursos desats, nota de fins a 3000 caràcters, tasca preparada i darrer espai desat. Desament explícit, sense sincronització entre dispositius ni protecció de concurrència entre pestanyes. No hi ha xat, presència, documents privats ni videotrucada. Error de quota: nota conservada al formulari i avís visible. Verificació visual del nou increment pendent; components responsius reutilitzats.

## Iteració mòbil: llegibilitat i jerarquia

A petició del fundador, es revisa el mòbil després de la validació inicial: navegació inferior amb Campus, Coworking, Biblioteca i Universitats; Menú per a Nova idea, projectes propis i compte; context i perfil de prova plegables. Tipografia de formularis de 16 px, controls de 44–48 px, espai per a la zona segura inferior i accions apilades. Les regles de disposició noves estan limitades a 800 px. L’escriptori conserva les columnes i la navegació superior.

La continuïtat diferencia començar una mostra de reprendre una aportació desada. El projecte indica institucions fictícies i fase de primera prova. La sala indica preparació local i absència d’enviament. No s’inventen persones connectades, terminis o activitat recent. La nova disposició no ha estat verificada visualment en un dispositiu; la restricció del navegador de comprovació continua vigent.

## Coherència visual i guia del pilot

portal-polish.css trasllada la paleta perla/cian/lila/ambre a les vistes internes, amb llum continguda, targetes contrastades, focus i controls llegibles en mòbil. No modifica la portada validada. Cian: feina; lila: investigació/revisió; ambre: comunitat i universitats.

#circuit-pilot guia l’estudiant i el docent amb passos enllaçats i estats derivats de la proposta i nota locals. Accessible des de la franja de context del Campus. La simulació es prova al mateix navegador: no hi ha lliurament entre comptes, comentaris ni sincronització real. Els permisos de compartició del Site es preserven. Validació visual del nou increment pendent.
