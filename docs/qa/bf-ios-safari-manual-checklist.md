# BF · QA manual i accessibilitat — issue #55

**Estat:** proves responsive automatitzades en Chromium ≠ Safari/iOS real, VoiceOver o certificació WCAG. No donar la #55 per completada sense evidències manuals.

## Matriu mínima per executar en un entorn autoritzat

| Dispositiu | Navegador | Rols i flux | Evidència |
| --- | --- | --- | --- |
| iPhone (iOS actual) | Safari real | A crea BF, pausa, represa, tanca i reobre, necessitat selectiva | Captura/vídeo i versió d'iOS |
| iPad (iPadOS actual) | Safari real | Eines de selecció, formularis, rols B i C, orientació vertical/horitzontal | Captura + incidències |
| macOS | Safari + teclat | Tab, Shift+Tab, Space/Enter, focus visible, errors i confirmacions | Checklist d'ordre de focus |
| iOS | VoiceOver | etiquetes, landmarks, avisos de canvi d'estat i validació | Observacions assistives |
| Chromium en CI | Emulació 390px / 820px | overflow i control de pausa autenticada | Run d'Actions amb SHA |

## Cas de prova C (usuaris múltiples)

A és titular BF, B està autoritzat a veure **només** una necessitat, C és un tercer sense grant. Verificar que ni els IDs coneguts ni la cerca permeten veure esborrany, evidència, prova o acord d'altres persones. Revocar la necessitat: B deixa de poder-la consultar. Anotar l'estat de sessió/identitat, mai enregistrar tokens, dades reals, rostres o converses d'estudiants.

## Gate de contrast i navegació

- WCAG 2.2 AA: text normal >= 4.5:1, text gran >= 3:1; controls i focus no textuals >= 3:1 quan aplica.
- Zoom 200/400%, reflow sense scroll horitzontal per contingut ordinari, labels llegibles, objectius tàctils i mínim 24x24 CSS px segons condicions WCAG 2.2.
- Sense dependència exclusiva de color, text d'error associat als camps, ordre de focus consistent, estat busy/loading explicat.
- Pausa/tancament són accions destructives operativament: la confirmació exigeix checklist i no activa acords externs.

**Registre de resultats:** SHA `dev`, URL/entorn efímer, dispositiu, iOS/Safari, data, passos, esperat, observat, captura sanitzada, severitat, issue oberta i revalidació. No hi ha dispositiu Safari remot connectat a aquest xat. Tot el que no consti provat manualment roman PENDENT.
