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
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

const TOOL_URL = 'https://radios4ndbox-bot.github.io/Tool-beta-RM-Rectal/';

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

/* ── percorsi: solo dentro la cartella comune ── */
function dentro(rel){
  const base = leggiConfig().cartella;
  if (!base) throw new Error('Cartella comune non impostata');
  if (!fs.existsSync(base)) throw new Error('Cartella comune non raggiungibile: ' + base);
  const p = path.resolve(base, String(rel || '.'));
  const r = path.relative(base, p);
  if (r.startsWith('..') || path.isAbsolute(r)) throw new Error('Percorso fuori dalla cartella comune');
  return p;
}

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
gestisci('scrivi', (rel, testo) => {
  const p = dentro(rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, String(testo), 'utf8');
  return path.relative(leggiConfig().cartella, p);
});
gestisci('leggi', (rel) => fs.readFileSync(dentro(rel), 'utf8'));
gestisci('elenca', (rel) => fs.readdirSync(dentro(rel), { withFileTypes: true })
  .map((d) => ({ nome: d.name, cartella: d.isDirectory() })));
gestisci('esiste', (rel) => { try { return fs.existsSync(dentro(rel)); } catch (_) { return false; } });
gestisci('apriCartella', () => { const c = leggiConfig().cartella; return c ? shell.openPath(c) : ''; });
gestisci('apriTool', () => { win.loadURL(TOOL_URL); });

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
  win.loadFile(path.join(__dirname, 'prova.html'));
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(() => {
    FILE_CONFIG = path.join(dirConfig(), 'config.json');
    crea();
  });
  app.on('window-all-closed', () => app.quit());
}
