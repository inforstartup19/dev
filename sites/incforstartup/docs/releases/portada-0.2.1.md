# Portada 0.2.1 — òrbites 3D

Correcció després de l'informe de manca de moviment al mòbil i petició explícita
de recórrer 360 graus al voltant de tota l'esfera.

La separació plana de 0.2 pot quedar atrapada en equilibris locals en pantalles
estretes. Es retira d'aquest recorregut: ara cada satèl·lit té un pla orbital 3D,
velocitat, sentit i fase propis. El canvas dibuixa els satèl·lits llunyans, l'esfera
central opaca i els satèl·lits propers en aquest ordre. La mida varia amb profunditat.
Poden creuar-se en projecció: és una òrbita espacial, no un empaquetament de cercles.

Sis proves geomètriques inclouen 417×716, 360×640, 390×844 i horitzontal 568×320.
Comproven 360 passos per òrbita, profunditat positiva/negativa, moviment a cada
pas i límits del viewport. Ja no es fa la cerca de graella costosa de la 0.2.

No es pot inferir la preferència de moviment reduït d'una captura. Es continua
respectant la del sistema i aturant RAF en segon pla. Safari/iPhone real encara
requereix comprovació; no es declara resolt al dispositiu de l'usuari sense observar-lo.
