# StructuRad × ESGAR — RM Retto

Referto strutturato della RM del retto secondo i criteri ESGAR, per la
stadiazione primaria e la ristadiazione. Il referto si aggiorna a ogni
modifica del form e conserva le correzioni manuali.

## Il modello ESGAR 2026

Form e referto seguono, voce per voce, i modelli di referto strutturato ESGAR
2026, tradotti in italiano con la massima fedeltà: stadiazione primaria (Eur
Radiol 2026;36:4592–4607, Fig. 2) e ristadiazione dopo terapia neoadiuvante
(Eur Radiol 2026;36:4608–4621, Fig. 1). Non ci sono voci che il modello non
prevede.

- **Stadiazione primaria**: morfologia (composizione; forma polipoide,
  completamente o parzialmente anulare, con le ore), sede (distanza dalla
  giunzione anorettale e, facoltativa, dal margine anale; riflessione
  peritoneale anteriore; sigmoid take-off), dimensioni, categoria cT (cT1-2,
  cT3ab, cT3cd, cT4a, cT4b con le strutture invase), EMVI (no/sì), invasione
  sfinterica, MRF (con la causa e le ore), linfonodi e depositi tumorali
  (mesorettali, laterali, depositi, cN stimata), linfonodi non regionali (cM+).
- **Ristadiazione**: probabilità di tumore residuo (cCR, near-cCR, residuo
  minore o maggiore, con l'ycT stimato se c'è residuo), componente mucinosa,
  lesione residua, ycEMVI, invasione sfinterica, ycMRF, linfonodi e depositi,
  linfonodi non regionali.
- In fondo una **Conclusione** che riassume le categorie del modello, con
  «anal+» se c'è invasione sfinterica.
- Gli automatismi del modello: sfintere esterno e strutture cT4b danno cT4b;
  scrivere un dettaglio (numero, dimensioni, lato, ore) segna da solo «Sì».

Le **correzioni a mano** restano anche quando si cambia un'altra voce della
stessa sezione: il referto si fonde riga per riga, le righe che il form cambia
si aggiornano e le frasi aggiunte o riscritte sulle altre restano. Se si è
riscritta proprio la riga che il form cambia, vince il form (il dato nuovo);
«Indietro» riporta la versione di prima.

| file | |
|---|---|
| `index.html` | il tool, in un file unico: si apre in Chrome o Edge |
| `telefono.html` | la pagina del telefono, che fa da chiave per l'accesso |
| `test/accesso.test.js` | accesso e archivio, da capo a fondo |
| `test/descrizioni.test.js` | descrizioni delle categorie, ufficiali o del medico |
| `test/amministratore.test.js` | richiesta dal telefono, approvazione e delega di amministratore |
| `test/desktop.test.js` | archivio nel programma per Windows, attraverso il ponte |
| `test/indietro.test.js` | «Indietro» sopra il referto: testo e form tornano insieme |
| `test/interfaccia.test.js` | menu a tendina, calendario e campi che imparano |
| `test/memoria.test.js` | Memoria: le frasi del medico, voce per voce |
| `test/dal-referto.test.js` | Memoria: le frasi riconosciute da un referto già scritto (.txt, .docx) |

## Accesso con il telefono

Il telefono è solo la **chiave**: conserva nome, cognome e titolo di chi
referta, più una chiave di firma del dispositivo. I referti restano sul PC.

1. Sul PC, in alto a destra, «Accedi» → «Accedi con il telefono» mostra un QR.
2. Lo si inquadra con la fotocamera del telefono: si apre `telefono.html`.
   La prima volta chiede nome, cognome e titolo (Dr., Dr.ssa o nessuno).
3. Il telefono chiede conferma, poi manda i dati al PC. Il PC saluta per nome
   («Dr.ssa Bianchi») e salva i referti a nome di chi ha fatto l'accesso.

L'accesso dura 12 ore, oppure finché non si preme «Esci»: su un PC condiviso
conviene uscire a fine turno. Il QR vale 5 minuti.

Il PC e il telefono non si collegano direttamente: entrambi passano dal relay
pubblico [ntfy.sh](https://ntfy.sh), come in Protocol Cards. Il collegamento è
cifrato con AES-GCM a 256 bit, e la chiave passa solo nel QR, nel frammento
`#…` dell'indirizzo, che non arriva a nessun server. Il relay vede solo testo
cifrato. Finito l'accesso nessuno dei due conserva la chiave, e aprire il tool
non contatta la rete: la rete serve solo nel momento dell'accesso.

### Codice dispositivo e amministratore

Al primo uso il telefono crea una coppia di chiavi ECDSA P-256. La privata non
è esportabile e non lascia mai il telefono. A ogni accesso il telefono firma
l'argomento del QR e l'id del profilo, e il PC verifica la firma: una firma
copiata da un altro accesso non vale. Dalla chiave pubblica nasce il **codice
dispositivo** (per esempio `22FC-5461-8834-94AA`), visibile sul telefono in «La
tua chiave».

L'**amministratore** si riconosce dal codice dispositivo, non dal nome. Solo
lui sceglie o cambia la cartella comune del PC.

- I codici in `ADMIN_DISPOSITIVI`, in `index.html`, sono amministratori su ogni
  PC. Oggi la lista contiene un solo codice, `9407-BEE0-7B5F-AED2`.
- Se la lista fosse vuota, su un PC senza cartella comune il primo che entra
  potrebbe configurarlo: sceglierebbe la cartella comune e ne diventerebbe
  l'amministratore per quel PC. Con la lista piena questa regola non vale.
- Per aggiungere o sostituire un amministratore (telefono nuovo, browser
  ripulito) si aggiorna la lista con il codice mostrato dal nuovo telefono.

### Pubblicare la pagina del telefono

Il QR apre `telefono.html` da un indirizzo pubblico. Bisogna quindi attivare
GitHub Pages su questo repository: *Settings → Pages → Deploy from a branch →
`main` / `(root)`*. La pagina sarà su
`https://radios4ndbox-bot.github.io/Tool-beta-RM-Rectal/telefono.html`.

Se il tool stesso si apre da GitHub Pages, il QR punta alla `telefono.html`
accanto a lui; da una copia locale (`file://`) punta all'indirizzo qui sopra,
scritto in `TEL_PUBBLICO` in `index.html`.

## Archivio dei referti

I referti vanno in una **cartella comune** del PC, anche dentro Google Drive o
OneDrive per desktop. La sceglie l'amministratore dal pannello del profilo,
«Amministrazione di questo PC».

A ogni accesso il tool crea, se manca, la **cartella del medico** («Cognome
Nome») dentro la cartella comune: è la sua directory.

### Casi: stadiazione e ristadiazione vicine

Al primo salvataggio di un paziente il tool crea un **codice del caso** univoco,
per esempio `RT26-7K4M` (anno e quattro caratteri senza ambiguità). Il codice
va nel referto, nel nome della cartella del caso e nell'indice. Stadiazione e
ristadiazione dello stesso paziente stanno nella **stessa cartella**, una
accanto all'altra in ordine di data:

```
<cartella comune>/
├── Bianchi Giulia/
│   ├── indice-referti.csv
│   └── 2026/
│       └── 2026-03-10_RT26-7K4M_Rossi Mario/
│           ├── caso.json
│           ├── 2026-03-10_1412_Stadiazione_A123456_cT3cd_cN+_MRF-_EMVI+.txt
│           └── 2026-06-20_0930_Ristadiazione_A178902_near-cCR_ycN0_MRF-_EMVI-.txt
└── Neri Marco/
    └── …
```

- **Paziente** (facoltativo, «Cognome Nome»), accanto al numero d'accesso:
  entra nell'intestazione del file, nella colonna «Paziente» dell'indice, nel
  nome della cartella del caso (quando il caso si apre) e in `caso.json`, che
  tiene il nome aggiornato se lo si aggiunge o corregge dopo. Non entra nel
  testo del referto, né nel nome del file, né nella memoria del tool.
- **Ricerca precedente** (in ristadiazione) scorre tutta la cartella comune, le
  cartelle di tutti i medici, e trova il caso dal nome del paziente, dal codice
  o dal numero d'accesso della stadiazione, con anteprima del referto.
  «Associa» collega la ristadiazione al caso e ne compila il nome del paziente. Anche «Mostra archivio» cerca per nome;
  maiuscole e accenti non contano.
- La ristadiazione si salva nella cartella del caso, anche se la stadiazione
  l'ha fatta un altro medico; chi la salva la ritrova nel proprio indice, con il
  percorso dalla cartella comune.
- Una ristadiazione senza stadiazione associata chiede conferma prima di aprire
  un caso nuovo.
- Il caso resta aperto per i salvataggi successivi dello stesso paziente. Si
  chiude con «Nuovo paziente», cambiando il numero d'accesso dopo un salvataggio,
  o quando il medico esce.
- Nel nome del file ci sono data d'esame, ora di salvataggio, tipo, numero
  d'accesso e sintesi della stadiazione: cT, cN, MRF ed EMVI per la primaria;
  risposta, ycT, ycN, MRF ed EMVI per la ristadiazione. Ogni file ha in testa
  tipo di esame, codice del caso, paziente, data, numero d'accesso, chi l'ha refertato e
  quando è stato salvato. Un salvataggio nello stesso minuto non sovrascrive:
  aggiunge `_2`, `_3`…
- `indice-referti.csv` elenca i referti salvati dal medico, con codice del caso
  e percorso; si apre in Excel (separatore `;`). Un indice con le colonne di una
  versione precedente viene conservato come `indice-referti-precedente.csv`;
  quello della versione appena prima, senza «Paziente», si aggiorna sul posto
  con la colonna vuota nelle righe già scritte.

Chrome può chiedere di nuovo il permesso di scrivere nella cartella comune: lo
chiede da solo al primo salvataggio, o lo si concede con «Riattiva». Scegliendo
«Consenti a ogni visita» (Chrome 122 e successivi) non lo chiede più; con il
tool installato come app il permesso tende a restare. Il tool chiede anche al
browser di non sfoltire da solo i dati del sito (`navigator.storage.persist`).

La cartella comune contiene il file `structurad-esgar.json`, che la segna. Se il
browser la dimentica (dati del sito cancellati, pulizia all'uscita), qualunque
medico entrato la ricollega dal pannello del profilo con «Ricollega la cartella
comune», senza l'amministratore: il tool accetta solo una cartella segnata, o
un archivio di prima della marca, riconosciuto dagli indici dei medici. Finché
l'amministratore non ha scelto la cartella comune, i referti si scaricano come
file, con lo stesso nome; lo stesso vale nei browser senza File System Access
(serve Chrome o Edge).

Per salvare serve l'accesso: senza, «Salva nell'archivio» apre il pannello del
profilo. Copia, «Scarica .txt» e Stampa funzionano anche senza accesso.

## Memoria: le tue frasi

Ogni riga che il tool scrive nel referto è una **voce**: il testo ufficiale del
modello ESGAR, tradotto, con i **segnaposto** fra parentesi quadre per i dati
del modulo (`[cm]`, `[ore]`, `[dettagli]`, `[categorie]`…). Le voci sono
nell'elenco `VOCI_ELENCO` di `index.html`.

La pagina **Memoria** (icona nella colonna delle impostazioni) si apre su una
mappa con un passo per ogni scheda del modulo, più la conclusione. Aperto un
passo:

- **a sinistra** la sezione, voce per voce come nel modulo (No, Sì, cT3ab,
  Iliaci esterni…);
- **a destra**, per ogni voce, la riga che scrive nel referto. La si riscrive
  con le proprie sfumature e la si salva (Invio o «Salva»); sotto si vede
  **come verrà nel referto**, con dati d'esempio;
- da allora, scegliendo quella voce nel modulo, nel referto compare la tua
  frase, in questo referto e in tutti i successivi. Le correzioni scritte a
  mano nel referto restano;
- i segnaposto restano tutti: il dato lo scrive sempre il modulo. Una frase
  senza un segnaposto della voce, o con uno inventato, non si salva. I
  segnaposto si inseriscono anche con un clic;
- accanto resta il testo ufficiale ESGAR; **Ufficiale** riporta la voce a quel
  testo.

**Dal tuo referto** (sulla mappa) parte da un referto già scritto dal medico:
un file `.txt` o Word `.docx`, oppure il testo incollato. Il tool lo divide in
frasi; la sezione la decidono i titoli, se ci sono, altrimenti le parole chiave
(fascia mesorettale, EMVI, sfinteri, linfonodi, iliaci esterni, cT3…); dentro la
sezione sceglie la voce più vicina (anche dalla negazione: «non», «libera»,
«indenne» → No). Riconosce da solo stadiazione o ristadiazione, e lo si può
cambiare. Per ogni frase propone la voce, che si può cambiare, e la frase già
pronta come tua: misure e ore diventano `[cm]` e `[ore]`, la categoria scritta
(«T3b») diventa quella della voce, le categorie della conclusione `[categorie]`.
Un numero del caso rimasto nella frase è segnalato, perché resterebbe uguale in
ogni referto. Le frasi già uguali al testo del tool si saltano. «Salva come tua
frase» o «Ignora», frase per frase.

Sulla mappa ogni passo conta le tue frasi. **Esporta / Importa le frasi**
portano le frasi in un file JSON e su un altro PC; **Tutte al testo ufficiale**
le toglie.
Le frasi sono del medico che ha fatto l'accesso (`frasi-esgar.json` nella sua
cartella, e sul PC); senza accesso sono quelle del PC. Nessun dato del paziente.

## Menu e date

I menu a tendina hanno lo stile del tool, come in Archivist; il menu nativo
resta nascosto e continua a dare il valore al referto. Le date si scrivono e si
mostrano in **gg/mm/aaaa**, con il calendario («Data esame»). Digitando bastano
le cifre: le barre le mette il campo. Nei nomi di file e cartelle dell'archivio la data resta anno-mese-giorno,
così l'ordine alfabetico è anche quello cronologico.

## Impostazioni

A destra, come in ER Oncology Archivist, una colonna di icone si allarga nel
pannello della voce scelta; la pagina rientra, così il pannello non copre il
form né il referto.

- **Archivio**: la cartella comune del PC e quella del medico entrato, il
  collegamento al pannello del profilo, quante voci hanno una tua frase, «Apri
  la Memoria» e «Tutte al testo ufficiale».
- **Aspetto**: form compatto, riduci le animazioni, salta l'intro all'avvio.
  Sono scelte della postazione (localStorage), non dati clinici.
- **Info**: i criteri ESGAR come li applica il tool. Ci sono la tabella cT, cosa
  si descrive in stadiazione primaria (sede e morfologia, sfinteri e organi,
  MRF, EMVI, linfonodi regionali, depositi tumorali), le categorie di risposta e
  le voci della ristadiazione, come lavora il tool e la versione. Per i casi
  dubbi fa fede la pubblicazione ESGAR.

## Stile personale

Ogni medico regola la **forma** del suo referto; le voci e i criteri ESGAR
restano tutti, nessuna sezione si può omettere.

- titoli delle sezioni in MAIUSCOLO o con la sola iniziale, e un titolo suo
  sezione per sezione;
- frase fissa di apertura, di chiusura e in fondo a ogni sezione;
- **descrizioni delle categorie**: il testo fra parentesi accanto a cT3ab,
  cT3cd, cT4a, alle classi di risposta e agli ycT. Di base è quello ufficiale
  ESGAR; il medico lo riscrive o lo lascia vuoto, e «Ufficiale» lo riporta. Nella
  Memoria le voci delle categorie usano la descrizione in vigore (`[descrizione]`).

Lo stile è del medico che ha fatto l'accesso (`stile-esgar.json` nella sua
cartella); senza accesso il referto è quello del tool.

Nella scheda **Categoria cT** ogni voce ha a sinistra un pulsante «i»: apre una
piccola finestra che spiega a cosa corrisponde la voce secondo le
raccomandazioni ESGAR 2026 per la stadiazione primaria (Eur Radiol
2026;36:4592–4607), con le percentuali di consenso del panel. Le soglie dei
singoli sottostadi sono quelle del TNM; il modello di referto ESGAR le raggruppa
in cT1-2, cT3ab, cT3cd, cT4a e cT4b. Anche la sezione Info riassume le due
pubblicazioni 2026, stadiazione primaria e ristadiazione (4608–4621).

Il codice dispositivo non compare nel tool: il pannello del profilo dice solo
se l'accesso è firmato. Il codice si legge sul telefono, in «La tua chiave».

## Intro

All'apertura: ESGAR gigante a contorno che scorre; stacco su ESGAR media sul
gradiente, che entra da destra; stacco su ESGAR piccola, che si ferma accanto
al logo StructuRad con la firma «A StructuRad product». Poi il logo vola nella
barra e porta su la pagina. Si salta con un clic, Esc, Invio o Spazio; non parte
con «riduci movimento» attivo nel sistema né con `?nointro` nell'indirizzo.

## Icona e app sul desktop

L'icona è il simbolo StructuRad (SD) in bianco metallico su fondo rosso-nero, in `icone/`. Favicon SVG e PNG sono incorporati nella pagina, così l'icona resta anche in una copia salvata sul PC. `manifest.webmanifest` permette a Chrome ed Edge di installare il tool come app (⋮ → Trasmetti, salva e condividi → Installa pagina come app, o «Crea scorciatoia»), con icona sul desktop e finestra propria.

## Licenze incluse

- Anton (SIL Open Font License), incorporato solo per le lettere di ESGAR.
- [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) di
  Kazuhiko Arase, licenza MIT, per il QR dell'accesso.

## Test

```
npm i playwright
node test/accesso.test.js
node test/interfaccia.test.js
node test/indietro.test.js
node test/descrizioni.test.js
node test/memoria.test.js
node test/dal-referto.test.js
```

Il test avvia un relay finto in locale, fa l'accesso da un telefono simulato,
salva referti di stadiazione primaria e ristadiazione e controlla cartelle,
nomi dei file, indice, durata della sessione e uscita.

## Programma per Windows

In `desktop/` c'è il programma Electron per Windows: il tool in una finestra, con il salvataggio nella cartella comune attraverso un ponte.

- La cartella comune è scritta in `C:\Users\Public\StructuRad ESGAR\config.json`, comune a tutti gli utenti Windows del PC: nessuna pulizia del browser la cancella.
- La pagina non ha accesso a Node: dal ponte (`window.EsgarDesktop`) legge e scrive solo dentro la cartella comune.
- GitHub compila i file `.exe` su una macchina Windows (workflow «Programma Windows»): `StructuRad-ESGAR-Setup-x.y.z.exe`, che si installa per l'utente senza credenziali di amministratore, `StructuRad-ESGAR-x.y.z.msi`, per macchina, che l'IT distribuisce su tutti i PC (`msiexec /i StructuRad-ESGAR-x.y.z.msi /qn`, in Program Files per tutti gli utenti), e `StructuRad-ESGAR-portatile-x.y.z.exe`, che parte senza installazione.
- Aggiornamenti: il tool si aggiorna sempre dal web. Il programma installato per utente si aggiorna da solo dalle Release; quello installato dall'MSI no (in Program Files serve l'amministratore): le versioni nuove le distribuisce l'IT con il nuovo MSI, che sostituisce il precedente (stesso `upgradeCode`).
- Release: Actions → «Programma Windows» → «Run workflow» con **rilascia**: pubblica `desktop-v<versione>` con installer, MSI, versione portatile e `latest.yml`.
