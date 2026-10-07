# Programma per Windows — piano di lavoro

Da completare a casa, sul PC Windows, con Cowork (Claude sul desktop) che lavora
nella cartella del repository; poi si porta in reparto l'installer finito.

## Stato attuale (versione di prova 0.1.0)

- `main.js`: finestra Electron, configurazione in
  `C:\Users\Public\StructuRad ESGAR\config.json` (comune a tutti gli utenti
  Windows; se non è scrivibile, cartella dati dell'utente).
- `preload.js`: il ponte `window.EsgarDesktop` — `stato`, `scegli`, `scrivi`,
  `leggi`, `elenca`, `esiste`, `apriCartella`, `apriTool`. Solo dentro la
  cartella comune; i percorsi che ne escono sono rifiutati.
- `prova.html`: pagina di prova (scegli la cartella, scrivi, rileggi).
- Sicurezza: `contextIsolation`, `sandbox`, niente Node nella pagina; il ponte
  risponde solo a `prova.html` e al tool su GitHub Pages; ogni altro link si
  apre nel browser.
- Provato su Linux: scrittura con sottocartelle, rilettura, rifiuto di `../`.

## Comandi (Windows, con Node 22)

```
cd desktop
npm install
npm start          # apre il programma senza installarlo
npm run dist       # crea dist\StructuRad-ESGAR-Setup-x.y.z.exe e la versione portatile
```

Su Windows `npm run dist` non ha bisogno di wine.

## Versione completa: cosa manca

1. **Il tool nella finestra.** All'avvio caricare `index.html` del tool. Due
   strade, da decidere:
   - dal web (GitHub Pages): si aggiorna da solo, serve la rete;
   - copia dentro il programma (`files` di electron-builder): funziona anche
     senza rete, si aggiorna solo reinstallando.
   Consigliata: dal web, con la copia interna come riserva se la rete manca.
2. **Salvataggio tramite il ponte.** In `index.html`, quando esiste
   `window.EsgarDesktop`:
   - `radice` non è più un handle del browser: le funzioni dell'archivio
     (`dirMedico`, salvataggio del referto, `indice-referti.csv`,
     `scansionaCasi`, «Ricerca precedente») usano `EsgarDesktop.scrivi /
     leggi / elenca` con percorsi relativi alla cartella comune;
   - niente `requestPermission`, niente «Riattiva», niente «Ricollega»;
   - «Scegli la cartella comune» (solo amministratore) chiama
     `EsgarDesktop.scegli()`;
   - nel browser normale tutto resta com'è oggi.
   Il modo più pulito: un piccolo adattatore con la stessa interfaccia degli
   handle usati oggi (`getDirectoryHandle`, `getFileHandle`, `createWritable`,
   `entries`), così il resto del codice dell'archivio non cambia.
3. **Ponte da completare in `main.js`:** scrittura in coda o sostituzione
   atomica per l'indice CSV, `rinomina` (per `indice-referti-precedente.csv`),
   errori chiari se la cartella non è raggiungibile (disco di rete scollegato).
4. **Accesso con il telefono:** il relay ntfy.sh e il QR dovrebbero
   funzionare anche nella finestra (il PC mostra solo il QR, non serve la
   fotocamera); da verificare.
5. **Pagina del telefono:** resta sul web (`telefono.html`), il telefono non
   usa il programma.
6. **Icona e nome:** già impostati (`build/icon.png`, «StructuRad ESGAR»).
7. **Aggiornamenti del programma** (solo se si sceglie la copia interna o
   cambia il ponte): `electron-updater` con le Release di GitHub, oppure si
   reinstalla a mano la nuova versione.

## Prove prima di portarlo in reparto

- [ ] Installazione per utente senza credenziali di amministratore.
- [ ] Amministratore: sceglie la cartella comune; chiudere e riaprire il
      programma, riavviare il PC: la cartella resta.
- [ ] Un secondo utente Windows sullo stesso PC trova la stessa cartella.
- [ ] Accesso con il telefono, salvataggio di stadiazione e ristadiazione
      nello stesso caso, «Ricerca precedente», indice CSV apribile in Excel.
- [ ] Cartella su disco di rete: salvataggio, e messaggio chiaro se il disco
      è scollegato.
- [ ] Senza rete: il programma lo dice (o usa la copia interna).
- [ ] I test esistenti del tool (`test/*.test.js`) passano ancora nel browser.

## In reparto

- Prima di tutto provare l'installer di prova 0.1.0: se i criteri
  dell'ospedale bloccano i programmi non approvati, bloccano anche quello
  completo, e serve l'informatica.
- Al primo avvio compare l'avviso SmartScreen (programma senza firma):
  «Ulteriori informazioni» → «Esegui comunque».
- L'amministratore imposta la cartella comune una volta per PC.
