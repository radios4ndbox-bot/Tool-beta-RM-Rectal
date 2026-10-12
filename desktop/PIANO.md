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
   **Fatto:** all'avvio si carica il tool dal web; se la rete manca (o non
   risponde entro 8 secondi) la copia interna risponde allo stesso indirizzo,
   così i dati salvati nel browser restano gli stessi, e il titolo della
   finestra dice «copia interna (senza rete)». La pagina di prova si apre dal
   menu (Alt → Programma) o con `npm run prova`.
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
   **Fatto:** l'adattatore è in `index.html` (`dirDesktop`, `fileDesktop`);
   il ponte ha in più `tipo` e `creaCartella`, e le operazioni sui file sono
   in `ponte.js`, senza Electron, così si provano con Node. Un programma più
   vecchio, senza le funzioni nuove, fa come il browser. Prova:
   `node test/desktop.test.js`. Per vedere nel programma l'`index.html` del
   repository invece di quello sul web: `npm run locale`.
3. **Ponte da completare in `main.js`:** scrittura in coda o sostituzione
   atomica per l'indice CSV, `rinomina` (per `indice-referti-precedente.csv`),
   errori chiari se la cartella non è raggiungibile (disco di rete scollegato).
   **Fatto** in `ponte.js`: operazioni in coda, una alla volta; ogni file si
   scrive con un nome provvisorio e poi sostituisce il vecchio; `rinomina`
   (usata per `indice-referti-precedente.csv`); niente chiamate bloccanti,
   con un limite di 15 secondi, così un disco di rete scollegato non ferma
   la finestra; messaggi leggibili per cartella non raggiungibile, file
   aperto in Excel o protetto, disco pieno.
4. **Accesso con il telefono:** il relay ntfy.sh e il QR dovrebbero
   funzionare anche nella finestra (il PC mostra solo il QR, non serve la
   fotocamera); da verificare.
5. **Pagina del telefono:** resta sul web (`telefono.html`), il telefono non
   usa il programma.
6. **Icona e nome:** già impostati (`build/icon.png`, «StructuRad ESGAR»).
   **Aggiornamenti del tool — fatto:** ogni versione scaricata resta sul PC
   (cartella dati dell'utente) ed è quella che si apre senza rete. Con il
   programma aperto, ogni 15 minuti si confronta la pagina sul web con quella
   nella finestra: se è cambiata compare il riquadro «È disponibile una nuova
   versione del tool» (Aggiorna ora / Più tardi). Non si ricarica mai da
   soli. Dal menu: «Controlla aggiornamenti del tool».
7. **Aggiornamenti del programma** (solo se si sceglie la copia interna o
   cambia il ponte): `electron-updater` con le Release di GitHub, oppure si
   reinstalla a mano la nuova versione.
   **Fatto con `electron-updater`:** il programma installato cerca una nuova
   Release all'avvio e ogni 4 ore, la scarica e la installa alla chiusura;
   nella pagina compare «Aggiornamento del programma pronto». La versione
   portatile e `npm start` non si aggiornano. Se il controllo fallisce non
   succede nulla. Per pubblicare una versione nuova del programma:
   1. aumentare `version` in `package.json` (es. 0.2.0) e fare commit e push;
   2. creare e inviare il tag con lo stesso numero:
      `git tag desktop-v0.2.0` e `git push origin desktop-v0.2.0`;
   3. il workflow «Programma Windows» crea la Release con l'installer,
      `latest.yml` e il `.blockmap`. La Release non deve essere «pre-release».
   Da provare con una Release vera: da 0.2.0 a 0.2.1.

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
