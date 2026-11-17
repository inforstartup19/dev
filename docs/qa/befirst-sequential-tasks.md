# Cinc tasques seqüencials BeFirst — TFG / TFM

17/11/2026. Increment sol·licitat després de la #125. Base PR #128 / Site v56.

## Recorregut
1. Definir l’abast.
2. Investigar i preparar la proposta.
3. Dissenyar la primera prova.
4. Recollir evidències i revisar.
5. Acordar el següent pas.

Cada pas s'habilita només quan tots els anteriors estan validats pel docent. Presentar una tasca no desbloqueja la següent: cal la validació. Les tasques futures es poden consultar, però no editar, iniciar, presentar ni validar. El bloqueig es comprova tant en la presentació com en l'operació de domini, també per al perfil docent de prova.

La política `sequence` és opcional al model acadèmic compartit: només s'activa al tauler BeFirst. Els altres espais conserven el comportament anterior. La seqüència no es pot saltar eliminant les dependències d'un formulari.

Si es reobre un pas anterior, els posteriors queden bloquejats per a noves accions. No s'esborren evidències, esborranys, versions ni validacions històriques. No es reescriuen estats en cascada. En tornar a validar-lo, es recupera el recorregut segons els estats conservats.

Els registres locals anteriors adquireixen la política de seqüència en memòria en carregar-se, sense sobreescriure storage. Es persisteix amb la següent acció vàlida, mantenint la comprovació de concurrència existent. No es reinicia el circuit de l'usuari.

## Validació
- Proves del recorregut complet dels cinc passos en TFG i TFM.
- Rebuig d'edició i inici de passos futurs, ambdós perfils, també eliminant dependències de l'entrada.
- Presentació pendent de validació no desbloqueja el pas següent.
- Reobertura anterior bloqueja transitivament tasques posteriors ja avançades sense pèrdua d'evidències o snapshots.
- Càrrega de dades antigues sense escriptura ni reinici; seqüències invàlides rebutjades.
- Comprovació visual del detall bloquejat: formulari deshabilitat, motiu visible i cap acció per avançar.

La demo continua sent local. El selector docent no és autenticació. L'API i les sessions reals hauran d'aplicar la mateixa política quan s'integri el tauler (#87/#90). Safari físic segueix pendent a #55.
