# Quelcom — prévia de la continuïtat i dels accessos

Còpia del Site publicat al commit `bde6d16366c601fd47ed5079108667dd7153c109`.
Reutilitza els assets comuns de `../public` sense substituir-ne l’entrada.
IncForStartUp és el projecte mare. La portada 0.3 continua a la PR #78;
la integració React continua a #81. Aquesta prévia acompanya el login de #82.

Des de l’arrel del repositori:

```sh
python3 -m http.server 4173 --directory sites/incforstartup
```

Obre `http://localhost:4173/quelcom-preview/#espai` per revisar els cinc accessos,
o `/quelcom-preview/#inici` per Explorar, Investigar i Formar.
El desplegable d’escenaris és una simulació explícita; no crea sessions, no envia
codis i no concedeix permisos. «Demostració local» conserva el prototip del navegador.
No inclou dades locals de l’usuari, credencials ni configuració privada de Sites.

```sh
node --test sites/incforstartup/tests/quelcom-*.test.cjs
```

Activació real: `docs/product/quelcom-login-options.md`.
