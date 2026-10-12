// ============================================================
// StructuRad × ESGAR — RM Retto · programma per Windows
//
// VERSIONE DI PROVA: verifica che il programma si avvii sul PC e salvi
// nella cartella scelta. La cartella comune sta in un file di
// configurazione sul PC, non nei dati del browser: nessuna pulizia la
// cancella.
//
// Configurazione: C:\Users\Public\StructuRad ESGAR\config.json, comune a
// tutti gli utenti Windows del PC (la cartella Pubblica è scrivibile da
// tutti senza permessi di amministratore). Se non è scrivibile, si usa la
// cartella dati dell'utente.
//
// Sicurezza: la pagina non ha accesso a Node. Dal preload può solo
// leggere e scrivere file DENTRO la cartella comune; i percorsi che ne
// escono sono rifiutati.
// ============================================================
const { app, BrowserWindow, Menu, ipcMain, dialog, shell, net, session } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { pathToFileURL } = require('url');

const TOOL_URL = 'https://radios4ndbox-bot.github.io/Tool-beta-RM-Rectal/';
const PROVA = path.join(__dirname, 'prova.html');

/* ── il tool: dal web, con la copia interna come riserva ──
   La copia interna risponde allo STESSO indirizzo del tool (non come
   file://): così preferenze, memoria e sessione salvate nel browser
   (localStorage, IndexedDB) sono le stesse con e senza rete, e il ponte
   resta autorizzato. Nel programma installato la copia sta in tool/
   (vedi «files» in package.json); con npm start è la radice del repository. */
const DIR_RISERVA = app.isPackaged ? path.join(__dirname, 'tool') : path.join(__dirname, '..');
const ATTESA_RETE = 8000;     // ms per la risposta: oltre, si passa alla copia interna
const ATTESA_PAGINA = 20000;  // ms per scaricare la pagina
const OGNI = 15 * 60 * 1000;  // ogni quanto si cerca una versione nuova del tool
let daRiserva = false;
// solo in sviluppo (npm run locale): il tool è l'index.html del repository, non quello sul web
const LOCALE = !app.isPackaged && process.argv.includes('--tool-locale');

function fileRiserva(url){
  if (!url.startsWith(TOOL_URL)) return '';
  let rel;
  try { rel = decodeURIComponent(new URL(url).pathname.slice(new URL(TOOL_URL).pathname.length)) || 'index.html'; }
  catch (_) { return ''; }
  if (!(rel === 'index.html' || rel === 'manifest.webmanifest' || rel.startsWith('icone/'))) return '';
  const p = path.resolve(DIR_RISERVA, rel);
  const r = path.relative(DIR_RISERVA, p);
  if (r.startsWith('..') || path.isAbsolute(r) || !fs.existsSync(p)) return '';
  return p;
}
/* L'ultima versione del tool scaricata resta sul PC (cartella dati
   dell'utente): senza rete si apre quella, non quella dell'installer. */
const fileCopia = () => path.join(app.getPath('userData'), 'tool', 'index.html');
const impronta = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const HTML = { headers: { 'content-type': 'text/html; charset=utf-8' } };
let versioneCaricata = '';   // impronta della pagina mostrata nella finestra
let versioneAvvisata = '';   // impronta della versione nuova già segnalata
function conserva(buf){
  try {
    const f = fileCopia();
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f + '.tmp', buf);
    fs.renameSync(f + '.tmp', f);
  } catch (_) {}
}
function serviTool(){
  session.defaultSession.protocol.handle('https', async (req) => {
    const riserva = fileRiserva(req.url);
    if (!riserva) return net.fetch(req, { bypassCustomProtocolHandlers: true });
    const pagina = path.basename(riserva) === 'index.html';
    const stop = new AbortController();
    let timer = setTimeout(() => stop.abort(), ATTESA_RETE);
    try {
      if (LOCALE) throw new Error('tool locale');
      const r = await net.fetch(req.url, { signal: stop.signal, cache: 'no-cache', bypassCustomProtocolHandlers: true });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      if (!pagina) return r;
      clearTimeout(timer);
      timer = setTimeout(() => stop.abort(), ATTESA_PAGINA);
      const buf = Buffer.from(await r.arrayBuffer());
      daRiserva = false;
      versioneCaricata = impronta(buf);
      conserva(buf);
      return new Response(buf, HTML);
    } catch (_) {
      if (!pagina) return net.fetch(pathToFileURL(riserva).href);
      daRiserva = true;
      const buf = fs.readFileSync(!LOCALE && fs.existsSync(fileCopia()) ? fileCopia() : riserva);
      versioneCaricata = impronta(buf);
      return new Response(buf, HTML);
    } finally { clearTimeout(timer); }
  });
}

/* ── aggiornamenti del tool ──
   Il tool si aggiorna da solo a ogni avvio. Se resta aperto, ogni tanto si
   guarda se sul web c'è una versione diversa da quella nella finestra e lo
   si segnala nella pagina. Non si ricarica mai da soli: si perderebbe il
   referto in corso. */
const urlTool = (url) => String(url || '').startsWith(TOOL_URL);
async function controllaTool(aMano){
  if (LOCALE || !win || !urlTool(win.webContents.getURL())) return;
  if (!app.isPackaged && process.argv.includes('--prova-aggiornamento')) versioneCaricata = 'prova';
  const dico = (message) => { if (aMano === true) dialog.showMessageBox(win, { type: 'info', title: 'Aggiornamenti', message }); };
  let nuova = '';
  try {
    const r = await net.fetch(TOOL_URL, { signal: AbortSignal.timeout(ATTESA_PAGINA), cache: 'no-store', bypassCustomProtocolHandlers: true });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    nuova = impronta(Buffer.from(await r.arrayBuffer()));
  } catch (_) { return dico('Controllo non riuscito: la rete non risponde.'); }
  if (nuova === versioneCaricata) {
    // era la copia interna ed è già l'ultima versione: la rete è tornata
    if (daRiserva) { daRiserva = false; win.setTitle(win.webContents.getTitle()); }
    return dico('Il tool è aggiornato.');
  }
  if (aMano !== true && nuova === versioneAvvisata) return;
  versioneAvvisata = nuova;
  avvisa({
    id: 'esgar-aggiornamento',
    titolo: 'È disponibile una nuova versione del tool',
    testo: 'Aggiornando la pagina si ricarica: completa prima il referto in corso.',
    ricarica: true
  });
}
function avvisa(a){
  if (win) win.webContents.executeJavaScript(`(${riquadroAvviso})(${JSON.stringify(a)})`).catch(() => {});
}

/* ── aggiornamenti del programma (finestra e ponte) ──
   Solo nel programma installato: la nuova versione si scarica dalle Release
   di GitHub e si installa alla chiusura, mai mentre si lavora. Se qualcosa
   non va (rete, criteri del PC, Release mancante) non succede nulla e il
   programma resta quello che è. La versione portatile non si aggiorna. */
function aggiornaProgramma(){
  if (!app.isPackaged || process.env.PORTABLE_EXECUTABLE_DIR) return;
  try {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on('error', () => {});
    autoUpdater.on('update-downloaded', (info) => avvisa({
      id: 'esgar-programma',
      titolo: 'Aggiornamento del programma pronto',
      testo: `La versione ${info.version} si installa da sola alla chiusura del programma.`,
      ricarica: false
    }));
    const cerca = () => { autoUpdater.checkForUpdates().catch(() => {}); };
    cerca();
    setInterval(cerca, 4 * 60 * 60 * 1000);
  } catch (_) {}
}

// eseguita NELLA pagina: un riquadro in basso a destra
function riquadroAvviso(a){
  const ID = a.id;
  if (document.getElementById(ID)) return;
  const el = (tag, stile, testo) => { const e = document.createElement(tag); e.style.cssText = stile; if (testo) e.textContent = testo; return e; };
  const bottone = 'font:inherit;font-size:13px;padding:7px 12px;border-radius:8px;cursor:pointer;border:1px solid #fff;';
  // i riquadri si impilano: il secondo sta sopra il primo
  const sotto = document.querySelectorAll('[data-esgar-avviso]').length;
  const box = el('div', `position:fixed;right:18px;bottom:${18 + sotto * 150}px;z-index:2147483647;max-width:340px;padding:14px 16px;border-radius:12px;`
    + 'background:#7B1E34;color:#fff;font:13px/1.5 "IBM Plex Sans","Segoe UI",system-ui,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.35);');
  box.id = ID;
  box.dataset.esgarAvviso = '1';
  box.setAttribute('role', 'status');
  box.append(
    el('div', 'font-weight:600;margin-bottom:4px;', a.titolo),
    el('div', 'opacity:.9;', a.testo));
  const azioni = el('div', 'display:flex;gap:8px;margin-top:12px;');
  const dopo = el('button', bottone + 'background:transparent;color:#fff;', a.ricarica ? 'Più tardi' : 'Ho capito');
  dopo.addEventListener('click', () => box.remove());
  if (a.ricarica) {
    const ora = el('button', bottone + 'background:#fff;color:#7B1E34;', 'Aggiorna ora');
    ora.addEventListener('click', () => location.reload());
    azioni.append(ora);
  }
  azioni.append(dopo);
  box.append(azioni);
  document.body.append(box);
}

/* ── configurazione ── */
function dirConfig(){
  const pubblica = process.env.PUBLIC || (process.platform === 'win32' ? 'C:\\Users\\Public' : '');
  const candidati = [pubblica && path.join(pubblica, 'StructuRad ESGAR'), app.getPath('userData')].filter(Boolean);
  for (const d of candidati) {
    try { fs.mkdirSync(d, { recursive: true }); fs.accessSync(d, fs.constants.W_OK); return d; } catch (_) {}
  }
  return app.getPath('userData');
}
let FILE_CONFIG = '';
function leggiConfig(){
  try { return JSON.parse(fs.readFileSync(FILE_CONFIG, 'utf8')); } catch (_) { return {}; }
}
function scriviConfig(c){
  fs.writeFileSync(FILE_CONFIG, JSON.stringify(c, null, 2), 'utf8');
}

/* ── file: solo dentro la cartella comune (vedi ponte.js) ── */
const ponte = require('./ponte')(() => leggiConfig().cartella || '');

/* ── chi può chiamare il ponte: solo la pagina di prova e il tool ── */
function consentito(url){
  try {
    const u = new URL(url);
    if (u.protocol === 'file:') return u.pathname.endsWith('/prova.html');
    return u.origin + u.pathname.replace(/[^/]*$/, '') === TOOL_URL;
  } catch (_) { return false; }
}
function gestisci(canale, fn){
  ipcMain.handle(canale, async (ev, ...args) => {
    if (!consentito(ev.senderFrame && ev.senderFrame.url)) throw new Error('Pagina non autorizzata');
    return fn(...args);
  });
}

gestisci('stato', () => {
  const c = leggiConfig();
  return {
    versione: app.getVersion(),
    config: FILE_CONFIG,
    cartella: c.cartella || '',
    raggiungibile: !!(c.cartella && fs.existsSync(c.cartella)),
    utente: os.userInfo().username,
    pc: os.hostname()
  };
});
gestisci('scegli', async () => {
  const c = leggiConfig();
  const r = await dialog.showOpenDialog(win, {
    title: 'Cartella comune dei referti',
    defaultPath: c.cartella || app.getPath('documents'),
    properties: ['openDirectory', 'createDirectory']
  });
  if (r.canceled || !r.filePaths[0]) return '';
  c.cartella = r.filePaths[0];
  c.impostata = new Date().toISOString();
  scriviConfig(c);
  return c.cartella;
});
for (const op of ['scrivi', 'leggi', 'elenca', 'esiste', 'tipo', 'creaCartella']) gestisci(op, ponte[op]);
gestisci('apriCartella', () => { const c = leggiConfig().cartella; return c ? shell.openPath(c) : ''; });
gestisci('apriTool', () => win.loadURL(TOOL_URL));

/* ── finestra ── */
let win = null;
function crea(){
  win = new BrowserWindow({
    width: 1280, height: 860, minWidth: 900, minHeight: 600,
    title: 'StructuRad ESGAR',
    icon: path.join(__dirname, 'build', 'icon.png'),
    backgroundColor: '#12070A',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  });
  // si naviga solo fra la pagina di prova e il tool; il resto si apre nel browser
  win.webContents.on('will-navigate', (ev, url) => { if (!consentito(url)) { ev.preventDefault(); shell.openExternal(url); } });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  // senza rete il tool è la copia interna: lo si dice nel titolo
  win.webContents.on('page-title-updated', (ev, titolo) => {
    if (!daRiserva || !consentito(win.webContents.getURL()) || win.webContents.getURL().startsWith('file:')) return;
    ev.preventDefault();
    win.setTitle(titolo + ' — copia interna (senza rete)');
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate([{
    label: 'Programma',
    submenu: [
      { label: 'Tool', click: () => win.loadURL(TOOL_URL) },
      { label: 'Ricarica', accelerator: 'F5', click: () => win.webContents.reload() },
      { label: 'Controlla aggiornamenti del tool', click: () => controllaTool(true) },
      { label: 'Pagina di prova', click: () => win.loadFile(PROVA) },
      ...(app.isPackaged ? [] : [{ role: 'toggleDevTools', label: 'Strumenti di sviluppo' }]),
      { type: 'separator' },
      { role: 'quit', label: 'Esci' }
    ]
  }]));
  setInterval(controllaTool, OGNI);
  if (!app.isPackaged && process.argv.includes('--prova-aggiornamento')) setTimeout(controllaTool, 6000);
  // all'avvio il tool; con --prova la pagina di prova
  if (process.argv.includes('--prova')) win.loadFile(PROVA);
  else win.loadURL(TOOL_URL);
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(() => {
    FILE_CONFIG = path.join(dirConfig(), 'config.json');
    serviTool();
    crea();
    aggiornaProgramma();
  });
  app.on('window-all-closed', () => app.quit());
}
