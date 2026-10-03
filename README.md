# StructuRad × ESGAR — RM Retto

Referto strutturato della RM del retto secondo i criteri ESGAR, per la
stadiazione primaria e la ristadiazione. Il referto si aggiorna a ogni
modifica del form e conserva le correzioni manuali.

| file | |
|---|---|
| `index.html` | il tool, in un file unico: si apre in Chrome o Edge |
| `telefono.html` | la pagina del telefono, che fa da chiave per l'accesso |
| `test/accesso.test.js` | accesso e archivio, da capo a fondo |
| `test/interfaccia.test.js` | menu a tendina, calendario e campi che imparano |
| `test/struttura.test.js` | apprendimento dalla struttura del referto finito |

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
│       └── 2026-03-10_RT26-7K4M/
│           ├── 2026-03-10_1412_Stadiazione_A123456_cT3c_cN+_MRF-_EMVI+.txt
│           └── 2026-06-20_0930_Ristadiazione_A178902_near-cCR_ycT1-2_MRF-.txt
└── Neri Marco/
    └── …
```

- **Ricerca precedente** (in ristadiazione) scorre tutta la cartella comune, le
  cartelle di tutti i medici, e trova il caso dal codice o dal numero d'accesso
  della stadiazione, con anteprima del referto. «Associa» collega la
  ristadiazione al caso e compila la data della RM basale di confronto.
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
  tipo di esame, codice del caso, data, numero d'accesso, chi l'ha refertato e
  quando è stato salvato. Un salvataggio nello stesso minuto non sovrascrive:
  aggiunge `_2`, `_3`…
- `indice-referti.csv` elenca i referti salvati dal medico, con codice del caso
  e percorso; si apre in Excel (separatore `;`). Un indice con le colonne di una
  versione precedente viene conservato come `indice-referti-precedente.csv`.

Chrome può chiedere di nuovo il permesso di scrivere nella cartella comune: lo
chiede da solo al primo salvataggio, o lo si concede con «Riattiva». Finché
l'amministratore non ha scelto la cartella comune, i referti si scaricano come
file, con lo stesso nome; lo stesso vale nei browser senza File System Access
(serve Chrome o Edge).

Per salvare serve l'accesso: senza, «Salva nell'archivio» apre il pannello del
profilo. Copia, «Scarica .txt» e Stampa funzionano anche senza accesso.

## Campi che imparano

Come il quesito PS di ER Oncology Archivist, tutti i campi di testo libero
(sequenze, premedicazione, dettagli di MRF, cT4b, EMVI, linfonodi, depositi,
noduli…) propongono le frasi già scritte nei referti precedenti. Il pannello si
apre sul campo: frecce e Invio per scegliere, × per non proporre più una frase.

Il tool impara quando un referto si **copia, scarica, stampa o salva
nell'archivio**; lo stesso referto conta una volta sola. Per ogni frase ricorda
quante volte è stata usata e quando, le varianti con cui è stata scritta e in
quale **contesto**, cioè le scelte del form in quel momento (cT, organi
infiltrati, EMVI, campo magnetico…). Il punteggio somma:

- **somiglianza** con quanto si sta scrivendo, con più peso alle parole rare;
- **frequenza** d'uso;
- **contesto**: le scelte presenti ora nel form che compaiono più spesso con
  quella frase. Con la prostata spuntata sale la nota sulla prostata, con
  l'elevatore quella sull'elevatore;
- **recenza**, per sei mesi;
- **gradimento**: le frasi scelte salgono, quelle proposte in alto e scavalcate
  scendono. Il tool corregge da solo l'ordine con l'uso.

La memoria resta nel browser di questo PC (localStorage): solo le frasi dei
campi liberi e le scelte del form, nessun dato del paziente.

### Struttura del referto

Il tool impara anche dal **referto finito**. A ogni «Scarica .txt» confronta,
sezione per sezione, il referto scaricato con quello che il form genera da solo,
riga per riga come un diff. Le differenze sono il lavoro del medico:

- **aggiunte**: frasi scritte di suo in una sezione, per esempio una nota fissa
  in MRF;
- **riformulazioni**: una frase generata riscritta a modo suo, per esempio
  «- non coinvolta» → «- fascia mesorettale indenne».

Le impara con le scelte del form, come i campi liberi. Sopra il referto il
riquadro **«Dai tuoi referti»** propone le aggiunte tipiche per le scelte attuali
e le riformulazioni delle frasi presenti, con un clic su «Aggiungi» o
«Sostituisci»; la × nasconde una proposta per quel referto. Si propone solo ciò
che è stato scritto almeno due volte, o che è preferito. Lo stesso referto
scaricato più volte conta una volta sola. Nella pagina Memoria le sezioni
compaiono sotto «Struttura del referto», con aggiunte e riformulazioni da
provare, correggere o dimenticare.

### Memoria del tool

Come la «Personalizzazione del reparto» di ER Oncology Archivist, la pagina
**Memoria** (icona nella colonna delle impostazioni, o «Gestisci la memoria» nel
pannello Archivio) mostra cosa ha imparato il tool e permette di gestirlo.

- **Panoramica**: quante frasi, campi, referti letti e preferite; come il tool
  ordina le proposte; i campi con più frasi.
- **Campo per campo**, divisi fra stadiazione primaria e ristadiazione:
  - **Prova**: si scrive come nel campo e si vede cosa proporrebbe il tool, con
    o senza le scelte del form attuale, con il punteggio;
  - **Insegna**: si aggiunge a mano una frase, che entra già come preferita;
  - per ogni frase: usi, ultima data, quante volte è stata scelta o scavalcata,
    varianti e scelte del form con cui è tipica; ★ la fissa in cima alle proposte
    e la protegge dallo sfoltimento; la matita la corregge (se diventa uguale a
    un'altra frase, le due si uniscono sommando gli usi); il cestino la dimentica;
  - ordinamento per punteggio, uso, recenza o alfabetico.
- **Esporta / Importa**: la memoria va in un file JSON e si importa su un altro
  PC; le frasi uguali si uniscono. **Azzera tutto** la cancella.

## Menu e date

I menu a tendina hanno lo stile del tool, come in Archivist; il menu nativo
resta nascosto e continua a dare il valore al referto. Le date si scrivono e si
mostrano in **gg/mm/aaaa**, con il calendario: «Confronto con imaging
precedente» (esame + data, per esempio «TC del 05/03/2026»), «RM basale di
confronto» e «Data esame». Digitando bastano le cifre: le barre le mette il
campo. Nei nomi di file e cartelle dell'archivio la data resta anno-mese-giorno,
così l'ordine alfabetico è anche quello cronologico.

## Impostazioni

A destra, come in ER Oncology Archivist, una colonna di icone si allarga nel
pannello della voce scelta; la pagina rientra, così il pannello non copre il
form né il referto.

- **Archivio**: la cartella comune del PC e quella del medico entrato, il
  collegamento al pannello del profilo, quante frasi ricordano i campi che
  imparano e «Azzera la memoria».
- **Aspetto**: form compatto, riduci le animazioni, salta l'intro all'avvio.
  Sono scelte della postazione (localStorage), non dati clinici.
- **Info**: i criteri ESGAR come li applica il tool. Ci sono la tabella cT, cosa
  si descrive in stadiazione primaria (sede e morfologia, sfinteri e organi,
  MRF, EMVI, linfonodi regionali, depositi tumorali), le categorie di risposta e
  le voci della ristadiazione, come lavora il tool e la versione. Per i casi
  dubbi fa fede la pubblicazione ESGAR.

Nella scheda **cT stage** ogni stadio ha a sinistra un pulsante «i»: apre una
piccola finestra che spiega a cosa corrisponde lo stadio secondo le
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

## Licenze incluse

- Anton (SIL Open Font License), incorporato solo per le lettere di ESGAR.
- [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) di
  Kazuhiko Arase, licenza MIT, per il QR dell'accesso.

## Test

```
npm i playwright
node test/accesso.test.js
node test/interfaccia.test.js
node test/struttura.test.js
```

Il test avvia un relay finto in locale, fa l'accesso da un telefono simulato,
salva referti di stadiazione primaria e ristadiazione e controlla cartelle,
nomi dei file, indice, durata della sessione e uscita.
