# Gestió d’Universitat Quelcom al pilot

Universitat Quelcom agrupa els estudiants i docents ja convidats al circuit de TFG, TFM i TR. El centre que consta al directori governa les assignacions. El nom d’universitat que un estudiant escriu a la fitxa del treball és una dada acadèmica que pot editar.

## Qui decideix què

| Actor | Decisió |
| --- | --- |
| Operació d’IncForStartUp | Dona d’alta centres i nomena o revoca la persona que n’assumeix la gestió. |
| Gestor del centre | Consulta el directori del seu centre, vincula docents amb estudiants i concedeix o retira el permís d’avaluació de cada vincle. |
| Docent assignat | Acompanya els estudiants que té assignats. Quan rep el permís d’avaluació, pot fer el retorn avaluable previst al pilot. |
| Estudiant | Consulta qui el tutoritza i continua treballant al seu espai privat. |

Una mateixa persona pot tenir funcions docents i de gestió. El càrrec de gestor, per si mateix, dona accés a les assignacions. Per obrir treballs privats, cal complir les regles de participació del treball. La constitució del tribunal i les qualificacions oficials es tracten a la [issue de convocatòries i actes](https://github.com/inforstartup19/dev/issues/144).

## Primer nomenament

1. El responsable d’IncForStartUp identifica el centre i indica el compte exacte que ha d’assumir-ne la gestió. Dues identitats d’una mateixa persona poden tenir funcions diferents.
2. L’operador verifica la identitat del circuit i l’adscripció al centre abans de crear el nomenament. Per a una persona ja convidada, crida `qc_private.operator_set_manager(institution_id, correu_verificat, true)` amb els paràmetres vinculats a la petició autoritzada. La funció valida que la invitació sigui vigent i conserva el rol acadèmic. Per a un compte dedicat, la invitació porta el rol `manager` i `can_manage=true`. Les credencials d’operació es mantenen al servidor.
3. El gestor obre el Campus amb el seu compte, consulta el directori i confirma les assignacions. Es pot assignar un estudiant a tutoria i decidir expressament si el docent l’ha de poder avaluar.
4. Per donar d’alta una altra universitat, l’operador crida `qc_private.operator_create_university(codi, nom)`, i indica explícitament el seu `institution_id` en cada invitació. L’assignació de docents es fa dins del centre un cop s’ha nomenat el gestor.
5. En retirar el càrrec de gestió, l’operador crida `qc_private.operator_set_manager(institution_id, correu_verificat, false)` i verifica que la persona ja no pot administrar el directori. Les seves possibles tutories es revisen per separat.

## Prova a fer amb els comptes autoritzats

Fer aquesta comprovació amb comptes autoritzats de prova i materials ficticis. Anotar el permís inicial del vincle abans de modificar-lo.

1. Des de gestió, assignar un estudiant a un docent en mode de seguiment. Comprovar què mostra cada compte i que el docent pot acompanyar l’estudiant.
2. Activar l’avaluació en el mateix vincle. L’estudiant envia un guió d’assaig. El docent hi deixa un retorn.
3. Tornar a seguiment. Comprovar que el docent conserva la tutoria i que el servidor rebutja una nova valoració. L’estudiant continua veient el retorn que ja té.
4. Retirar l’assignació. El docent perd l’accés derivat del vincle, i l’estudiant conserva el treball, l’enviament i les revisions anteriors.
5. Si el vincle tenia una funció anterior a la prova, el gestor restaura expressament aquell permís i el comprova amb els dos comptes. Les valoracions de la prova es fan sempre sobre materials ficticis.
