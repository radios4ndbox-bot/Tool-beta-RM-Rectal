# StructuRad × ESGAR — RM Retto

Referto strutturato della RM del retto secondo i criteri ESGAR, per la
stadiazione primaria e la ristadiazione. Il referto si aggiorna a ogni
modifica del form e conserva le correzioni manuali.

| file | |
|---|---|
| `index.html` | il tool, in un file unico: si apre in Chrome o Edge |
| `telefono.html` | la pagina del telefono, che fa da chiave per l'accesso |
| `test/accesso.test.js` | accesso e archivio, da capo a fondo |

## Accesso con il telefono

Il telefono è solo la **chiave**: conserva nome, cognome e titolo di chi
referta, nient'altro. I referti restano sul PC.

1. Sul PC, in alto a destra, «Accedi» → «Accedi con il telefono» mostra un QR.
2. Lo si inquadra con la fotocamera del telefono: si apre `telefono.html`.
   La prima volta chiede nome, cognome e titolo (Dr., Dr.ssa o nessuno).
3. Il telefono chiede conferma, poi manda i dati al PC. Il PC saluta per
   nome («Dr.ssa Bianchi») e salva i referti a nome di chi ha fatto l'accesso.

L'accesso dura 12 ore, oppure finché non si preme «Esci»: su un PC condiviso
conviene uscire a fine turno. Il QR vale 5 minuti.

Il PC e il telefono non si collegano direttamente: entrambi passano dal relay
pubblico [ntfy.sh](https://ntfy.sh), come in Protocol Cards. Il collegamento è
cifrato con AES-GCM a 256 bit, e la chiave passa solo nel QR, nel frammento
`#…` dell'indirizzo, che non arriva a nessun server. Il relay vede solo testo
cifrato. Finito l'accesso nessuno dei due conserva la chiave, e aprire il tool
non contatta la rete: la rete serve solo nel momento dell'accesso.

### Pubblicare la pagina del telefono

Il QR apre `telefono.html` da un indirizzo pubblico. Bisogna quindi attivare
GitHub Pages su questo repository: *Settings → Pages → Deploy from a branch →
`main` / `(root)`*. La pagina sarà su
`https://radios4ndbox-bot.github.io/Tool-beta-RM-Rectal/telefono.html`.

Se il tool stesso si apre da GitHub Pages, il QR punta alla `telefono.html`
accanto a lui; da una copia locale (`file://`) punta all'indirizzo qui sopra,
scritto in `TEL_PUBBLICO` in `index.html`.

## Archivio dei referti

Dal pannello del profilo, «Scegli cartella» collega una cartella del PC, anche
dentro Google Drive o OneDrive per desktop. «Salva nell'archivio», nella scheda
del referto, ci scrive il referto con numero d'accesso e data d'esame:

```
<cartella>/
└── Bianchi Giulia/
    ├── indice-referti.csv
    ├── Stadiazione primaria/
    │   └── 2026/
    │       └── 2026-09/
    │           └── 2026-09-28_1412_A123456_cT3c_cN+_MRF-_EMVI+.txt
    └── Ristadiazione/
        └── 2026/
            └── 2026-10/
                └── 2026-10-30_0930_A123456_near-cCR_ycT1-2_MRF-.txt
```

- **Operatore**, poi **tipo di esame**, poi **anno** e **mese** della data
  d'esame.
- Nel nome del file ci sono data d'esame, ora di salvataggio, numero d'accesso
  e la sintesi della stadiazione: cT, cN, MRF ed EMVI per la primaria; risposta,
  ycT, ycN, MRF ed EMVI per la ristadiazione.
- `indice-referti.csv` elenca tutti i referti dell'operatore, con le stesse
  informazioni in colonne. Si apre in Excel (separatore `;`) per cercare un
  numero d'accesso o ordinare per data o stadio.
- Ogni file ha in testa tipo di esame, data, numero d'accesso, chi l'ha
  refertato e quando è stato salvato. Un salvataggio nello stesso minuto non
  sovrascrive: aggiunge `_2`, `_3`…

Serve Chrome o Edge (File System Access). Il browser può chiedere di nuovo il
permesso a ogni apertura: lo si concede con «Riattiva» nel pannello, oppure al
primo salvataggio. Negli altri browser il referto si scarica come file, con lo
stesso nome.

Per salvare serve l'accesso: senza, «Salva nell'archivio» apre il pannello del
profilo. Copia, «Scarica .txt» e Stampa funzionano anche senza accesso.

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
```

Il test avvia un relay finto in locale, fa l'accesso da un telefono simulato,
salva referti di stadiazione primaria e ristadiazione e controlla cartelle,
nomi dei file, indice, durata della sessione e uscita.
