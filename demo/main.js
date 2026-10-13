// ============================================================
// StructuRad × ESGAR — RM Retto · DIMOSTRAZIONE
//
// Un programma a parte, solo per mostrare il tool: non è il programma
// del reparto (desktop/) e non ne condivide nulla sul PC.
//
// · Il tool è la copia chiusa qui dentro: non serve la rete.
// · Entra da solo il medico di dati/medico.json: non serve il telefono.
// · La cartella comune è una copia dei referti di esempio (dati/referti),
//   messa nei dati di questo programma alla prima apertura: quella del
//   reparto non si vede e non si tocca.
// · Dati del browser, configurazione e nome sono suoi («StructuRad ESGAR
//   Demo»): può stare aperto accanto al programma vero.
//
// Il tool (index.html) non sa di essere in dimostrazione: trova una
// sessione già aperta e una cartella comune già scelta, come dopo un
// accesso normale. Per i file usa lo stesso ponte del programma
// (desktop/ponte.js).
// ============================================================
const { app, BrowserWindow, Menu, ipcMain, shell, net, session } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { pathToFileURL } = require('url');

const TOOL_URL = 'https://radios4ndbox-bot.github.io/Tool-beta-RM-Rectal/';
// nel programma compilato tool e ponte stanno qui dentro (vedi «files» in package.json)
const DIR_TOOL = app.isPackaged ? path.join(__dirname, 'tool') : path.join(__dirname, '..');
const creaPonte = require(app.isPackaged ? './ponte.js' : '../desktop/ponte.js');
const DATI = path.join(__dirname, 'dati');
const MEDICO = JSON.parse(fs.readFileSync(path.join(DATI, 'medico.json'), 'utf8'));

/* ── i referti di esempio: una copia di lavoro nei dati del programma ── */
let cartella = '';
const ponte = creaPonte(() => cartella);
function copia(da, a){
  fs.mkdirSync(a, { recursive: true });
  for (const v of fs.readdirSync(da, { withFileTypes: true })) {
    if (v.isDirectory()) copia(path.join(da, v.name), path.join(a, v.name));
    else fs.writeFileSync(path.join(a, v.name), fs.readFileSync(path.join(da, v.name)));
  }
}
function preparaDati(){
  cartella = path.join(app.getPath('userData'), 'Referti dimostrazione');
  if (!fs.existsSync(cartella)) copia(path.join(DATI, 'referti'), cartella);
}
/* si riparte dai referti di esempio; quelli di prima restano accanto, con la data nel nome */
async function ripristina(){
  if (fs.existsSync(cartella)) {
    const quando = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
    fs.renameSync(cartella, `${cartella} (prima del ripristino ${quando})`);
  }
  preparaDati();
  // anche memoria e stile tenuti dal browser tornano quelli di esempio
  await session.defaultSession.clearStorageData({ storages: ['localstorage', 'indexdb'] });
  if (win) win.loadURL(TOOL_URL);
}

/* ── il tool: sempre la copia interna, allo stesso indirizzo di quello vero ── */
function fileTool(url){
  if (!url.startsWith(TOOL_URL)) return '';
  let rel;
  try { rel = decodeURIComponent(new URL(url).pathname.slice(new URL(TOOL_URL).pathname.length)) || 'index.html'; }
  catch (_) { return ''; }
  if (!(rel === 'index.html' || rel === 'manifest.webmanifest' || rel.startsWith('icone/'))) return '';
  const p = path.resolve(DIR_TOOL, rel);
  const r = path.relative(DIR_TOOL, p);
  return r.startsWith('..') || path.isAbsolute(r) || !fs.existsSync(p) ? '' : p;
}
function serviTool(){
  session.defaultSession.protocol.handle('https', (req) => {
    const f = fileTool(req.url);
    if (!f) return net.fetch(req, { bypassCustomProtocolHandlers: true });      // il resto (i caratteri) dalla rete, se c'è
    if (path.basename(f) === 'index.html') return new Response(fs.readFileSync(f), { headers: { 'content-type': 'text/html; charset=utf-8' } });
    return net.fetch(pathToFileURL(f).href);
  });
}

/* ── il ponte: lo stesso del programma, sulla cartella della dimostrazione ── */
const delTool = (url) => String(url || '').startsWith(TOOL_URL);
function gestisci(canale, fn){
  ipcMain.handle(canale, async (ev, ...args) => {
    if (!delTool(ev.senderFrame && ev.senderFrame.url)) throw new Error('Pagina non autorizzata');
    return fn(...args);
  });
}
gestisci('stato', async () => ({
  versione: app.getVersion() + ' · dimostrazione', config: 'dimostrazione', cartella,
  raggiungibile: await ponte.raggiungibile(), utente: os.userInfo().username, pc: os.hostname()
}));
gestisci('scegli', () => cartella);            // la cartella della dimostrazione non si cambia
for (const op of ['scrivi', 'leggi', 'elenca', 'esiste', 'tipo', 'creaCartella', 'rinomina']) gestisci(op, ponte[op]);
gestisci('apriCartella', () => shell.openPath(cartella));
gestisci('apriTool', () => win.loadURL(TOOL_URL));

/* ── finestra ── */
let win = null;
function crea(){
  win = new BrowserWindow({
    width: 1280, height: 860, minWidth: 900, minHeight: 600,
    title: 'StructuRad ESGAR — dimostrazione',
    icon: path.join(__dirname, app.isPackaged ? 'build' : '../desktop/build', 'icon.png'),
    backgroundColor: '#12070A',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, sandbox: true, nodeIntegration: false,
      // il medico che il preload fa entrare
      additionalArguments: ['--esgar-medico=' + encodeURIComponent(JSON.stringify(MEDICO))]
    }
  });
  win.webContents.on('will-navigate', (ev, url) => { if (!delTool(url)) { ev.preventDefault(); shell.openExternal(url); } });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  // che sia una dimostrazione si legge sempre nel titolo
  win.webContents.on('page-title-updated', (ev, titolo) => { ev.preventDefault(); win.setTitle(titolo + ' — dimostrazione'); });
  Menu.setApplicationMenu(Menu.buildFromTemplate([{
    label: 'Dimostrazione',
    submenu: [
      { label: 'Ricomincia dai referti di esempio', click: () => ripristina() },
      { label: 'Apri la cartella dei referti', click: () => shell.openPath(cartella) },
      { label: 'Ricarica', accelerator: 'F5', click: () => win.webContents.reload() },
      ...(app.isPackaged ? [] : [{ role: 'toggleDevTools', label: 'Strumenti di sviluppo' }]),
      { type: 'separator' },
      { role: 'quit', label: 'Esci' }
    ]
  }]));
  win.loadURL(TOOL_URL);
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(() => { preparaDati(); serviTool(); crea(); });
  app.on('window-all-closed', () => app.quit());
}
