// Il tool dentro il programma per Windows: la cartella comune passa dal
// ponte window.EsgarDesktop invece che dal browser. Qui il ponte è finto
// solo nel trasporto: le operazioni sui file sono quelle vere del
// programma (desktop/ponte.js), su una cartella temporanea del disco.
// Uso: npm i playwright && node test/desktop.test.js
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const { chromium } = require('playwright');
const creaPonte = require('../desktop/ponte.js');
const ROOT = path.join(__dirname, '..');

// relay finto: POST /<topic>, GET /<topic>/sse?since=all
const topics = new Map(); let seq = 0;
const relay = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const [, topic, sse] = req.url.split('?')[0].split('/');
  const t = topics.get(topic) || { msgs: [], subs: new Set() }; topics.set(topic, t);
  if (req.method === 'POST') {
    let b = ''; req.on('data', (c) => b += c); req.on('end', () => {
      const m = { id: 'm' + (++seq), time: Date.now() / 1000 | 0, event: 'message', topic, message: b };
      t.msgs.push(m); t.subs.forEach((s) => s.write('data: ' + JSON.stringify(m) + '\n\n'));
      res.end('{}');
    });
  } else if (sse === 'sse') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
    res.write('data: ' + JSON.stringify({ event: 'open' }) + '\n\n');
    t.msgs.forEach((m) => res.write('data: ' + JSON.stringify(m) + '\n\n'));
    t.subs.add(res); req.on('close', () => t.subs.delete(res));
  } else { res.statusCode = 404; res.end(); }
}).listen(8126);
const statico = http.createServer((req, res) => {
  fs.readFile(path.join(ROOT, decodeURIComponent(req.url.split('?')[0])), (e, d) => {
    if (e) { res.statusCode = 404; return res.end(); }
    res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(d);
  });
}).listen(8125);

const check = (cond, msg) => { console.log((cond ? 'OK  ' : 'FAIL') + ' ' + msg); if (!cond) process.exitCode = 1; };

// il «PC»: la configurazione con la cartella comune, e il ponte del programma
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'esgar-desktop-'));
const COMUNE = path.join(TMP, 'Referti RM Retto');
fs.mkdirSync(COMUNE);
const config = { cartella: '' };
const ponte = creaPonte(() => config.cartella);
let sceltaWindows = COMUNE;   // cosa «sceglie» l'amministratore nella finestra di Windows
const programma = {
  ...ponte,
  stato: async () => ({ versione: 'test', cartella: config.cartella, raggiungibile: await ponte.raggiungibile() }),
  scegli: () => { if (sceltaWindows) config.cartella = sceltaWindows; return sceltaWindows; }
};
const albero = (d = COMUNE, p = '') => fs.readdirSync(d, { withFileTypes: true })
  .flatMap((e) => e.isDirectory() ? albero(path.join(d, e.name), p + e.name + '/') : [p + e.name]).sort();

(async () => {
  config.cartella = COMUNE;
  check(await ponte.scrivi('../fuori.txt', 'no').then(() => false, (e) => /fuori dalla cartella/.test(e.message)) && !fs.existsSync(path.join(TMP, 'fuori.txt'))
    && await ponte.rinomina('structurad-esgar.json', '../fuori.json').then(() => false, () => true),
    'il ponte rifiuta i percorsi fuori dalla cartella comune');
  // venti scritture lanciate insieme sullo stesso file: in coda, l'ultima vince, nessun file provvisorio resta
  await Promise.all(Array.from({ length: 20 }, (_, i) => ponte.scrivi('coda.txt', 'riga ' + i)));
  check(fs.readFileSync(path.join(COMUNE, 'coda.txt'), 'utf8') === 'riga 19' && fs.readdirSync(COMUNE).join() === 'coda.txt', 'scritture in coda e sostituzione atomica');
  fs.unlinkSync(path.join(COMUNE, 'coda.txt'));
  config.cartella = '';

  const b = await chromium.launch();
  const errs = [];
  const contesto = async (funzioni) => {
    const c = await b.newContext({ viewport: { width: 1440, height: 900 } });
    // come Electron: gli errori arrivano con «Error invoking remote method…» davanti
    await c.exposeBinding('__ponte', async (_, f, ...a) => {
      try { return await programma[f](...a); } catch (e) { throw new Error(`Error invoking remote method '${f}': Error: ${e.message}`); }
    });
    await c.addInitScript((ff) => { window.EsgarDesktop = Object.fromEntries(ff.map((f) => [f, (...a) => window.__ponte(f, ...a)])); }, funzioni);
    return c;
  };
  const TUTTE = ['stato', 'scegli', 'scrivi', 'leggi', 'elenca', 'esiste', 'tipo', 'creaCartella', 'rinomina'];
  const pc = await (await contesto(TUTTE)).newPage();
  pc.on('pageerror', (e) => errs.push('pc: ' + e.message));
  const preparaPc = () => pc.evaluate(() => {
    Canale.usaRelay('http://localhost:8126');
    const o = Canale.nuovoAbbinamento; Canale.nuovoAbbinamento = async () => (window.__abb = await o());
  });
  const telefono = async (ua) => {
    const t = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, userAgent: ua })).newPage();
    t.on('pageerror', (e) => errs.push('tel: ' + e.message));
    return t;
  };
  async function accedi(tel, dati){
    if (await pc.isHidden('#pannelloProfilo')) await pc.click('#profiloBtn');
    await pc.click('#ppAccedi');
    await pc.waitForSelector('#qrBox:not([hidden])', { timeout: 5000 });
    const a = await pc.evaluate(() => window.__abb);
    await tel.goto(`http://localhost:8125/telefono.html#t=${a.t}&k=${a.k}`);
    if (dati) {
      await tel.fill('#cNome', dati.nome); await tel.fill('#cCognome', dati.cognome);
      await tel.click(`#cTitolo [data-t="${dati.titolo}"]`); await tel.click('#cSalva');
    }
    await tel.evaluate(() => EsgarTelefono.usaRelay('http://localhost:8126'));
    await tel.click('#aConferma');
    await tel.waitForSelector('#vFatto:not([hidden])', { timeout: 8000 });
    await pc.waitForFunction(() => document.getElementById('profiloNome').textContent !== 'Accedi', null, { timeout: 5000 });
    await pc.waitForTimeout(300);
  }
  const stato = () => pc.textContent('#archivioStato');
  const salva = async () => { await pc.click('#btnSalva'); await pc.waitForTimeout(500); };

  await pc.goto('http://localhost:8125/index.html?nointro');
  await preparaPc();

  // ── un medico qualunque, PC senza cartella comune: niente «Ricollega» ──
  const tel = await telefono('Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP1A) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36');
  await accedi(tel, { nome: 'Giulia', cognome: 'Bianchi', titolo: 'Dr.ssa' });
  const codiceTel = await tel.evaluate(() => EsgarTelefono.codice());
  check(/la sceglie l'amministratore/.test(await pc.textContent('#ppCartellaTesto')) && await pc.locator('[data-cartella]').count() === 0,
    'senza cartella comune: la sceglie l\'amministratore, niente «Ricollega»');

  // ── l'amministratore sceglie la cartella dalla finestra di Windows ──
  await pc.evaluate((c) => EsgarTest.amministratori.push(c), codiceTel);
  await pc.click('#ppEsci'); await accedi(tel);
  sceltaWindows = '';
  await pc.click('[data-cartella="radice"]'); await pc.waitForTimeout(300);
  check(config.cartella === '' && /nessuna/.test(await pc.textContent('#ppAdminTesto')), 'scelta annullata: non cambia nulla');
  sceltaWindows = COMUNE;
  await pc.click('[data-cartella="radice"]'); await pc.waitForTimeout(500);
  check(config.cartella === COMUNE && (await pc.textContent('#ppAdminTesto')).includes(COMUNE), 'l\'amministratore sceglie la cartella comune: resta nella configurazione del PC');
  check(albero().join() === 'structurad-esgar.json' && fs.existsSync(path.join(COMUNE, 'Bianchi Giulia')), 'sul disco: la marca e la cartella del medico');
  check(!(await pc.evaluate(() => new Promise((ok) => { const r = indexedDB.open('structurad-esgar', 1); r.onsuccess = () => { const q = r.result.transaction('cartella').objectStore('cartella').get('radice'); q.onsuccess = () => ok(q.result || null); }; }))),
    'nel browser non si salva nessun riferimento alla cartella');

  // ── stadiazione ──
  await pc.click('#profiloBtn');
  await pc.click('text=Anteriore'); await pc.click('text=Posteriore');
  await pc.click('input[name=p_ct][value=cT3c]'); await pc.click('input[name="p_cn"][value="cN+"]');
  await pc.selectOption('#p_emviGrade', '3');
  await pc.fill('#arcAccesso', 'A 123/456'); await pc.fill('#arcData', '28092026'); await pc.click('#arcAccesso');
  await pc.click('#btnSalva');
  await pc.waitForFunction(() => /Salvato/.test(document.getElementById('archivioStato').textContent), null, { timeout: 5000 });
  const codice = (await pc.evaluate(() => EsgarTest.caso())).codice;
  const dirCaso = `Bianchi Giulia/2026/2026-09-28_${codice}/`;
  let f = albero();
  const stad = f.find((x) => x.startsWith(dirCaso) && /^2026-09-28_\d{4}_Stadiazione_A123456_cT3c_cN\+_MRF-_EMVI\+\.txt$/.test(x.slice(dirCaso.length)));
  check(!!stad, 'la stadiazione è sul disco, nella cartella del caso: ' + stad);
  const testo = fs.readFileSync(path.join(COMUNE, stad), 'utf8');
  check(testo.includes('Codice caso: ' + codice) && testo.includes('N. accesso: A 123/456') && /\r\n/.test(testo) && testo.includes('Dr.ssa Bianchi'), 'il file ha intestazione, codice del caso e ritorni a capo di Windows');
  const idx = () => fs.readFileSync(path.join(COMUNE, 'Bianchi Giulia', 'indice-referti.csv'));
  check(idx().subarray(0, 3).equals(Buffer.from([0xEF, 0xBB, 0xBF])) && idx().toString('utf8').split('\r\n')[0].endsWith('Data esame;Ora salvataggio;Tipo;Codice caso;N. accesso;Risposta;T;N;MRF;EMVI;Refertato da;File'),
    'l\'indice CSV comincia con il BOM e le colonne: si apre in Excel');
  await salva();
  check(/_2\.txt/.test(await stato()) && albero().filter((x) => x.startsWith(dirCaso)).length === 2, 'stesso minuto: nessuna sovrascrittura');
  check(idx().toString('utf8').trim().split('\r\n').length === 3, 'l\'indice ha una riga per salvataggio');

  // ── ristadiazione nello stesso caso, con «Ricerca precedente» ──
  await pc.click('#btnNuovoCaso');
  await pc.click('#btnModeRistad'); await pc.waitForTimeout(300);
  await pc.click('input[name=r_risposta][value=near-cCR]'); await pc.click('input[name=r_yct][value=ycT1-2]');
  await pc.click('#btnCerca'); await pc.waitForSelector('#cercaPannello.aperto .cerca-caso', { timeout: 5000 });
  await pc.fill('#cercaQ', 'A1234');
  check(await pc.locator('#cercaPannello .cerca-caso').count() === 1, '«Ricerca precedente» trova il caso sul disco dal numero d\'accesso');
  await pc.click('#cercaPannello [data-vedi="0"]'); await pc.waitForTimeout(200);
  check(new RegExp('Codice caso: ' + codice).test(await pc.textContent('#cercaPannello .cerca-anteprima')), 'anteprima della stadiazione letta dal disco');
  await pc.click('#cercaPannello [data-associa="0"]');
  await pc.fill('#arcAccesso', 'A178902'); await pc.fill('#arcData', '20122026'); await pc.click('#arcAccesso');
  await salva();
  f = albero();
  check(f.some((x) => x.startsWith(dirCaso) && /2026-12-20_\d{4}_Ristadiazione_A178902_near-cCR_ycT1-2/.test(x)), 'la ristadiazione va nella stessa cartella della stadiazione');
  await pc.click('#btnModePrimaria'); await pc.waitForTimeout(200);

  // ── la cartella resta: ricarica della pagina, senza permessi da riattivare ──
  await pc.reload(); await pc.waitForTimeout(500); await preparaPc();
  await pc.click('#profiloBtn');
  check((await pc.textContent('#ppCartellaTesto')).includes(COMUNE) && await pc.locator('[data-cartella="riattiva"], [data-cartella="ricollega"]').count() === 0,
    'dopo la ricarica la cartella è ancora quella: niente «Riattiva», niente «Ricollega»');
  await pc.click('#ppEsci');

  // ── un altro medico: non amministratore, la sua cartella si crea da sola ──
  const tel2 = await telefono('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148');
  await accedi(tel2, { nome: 'Marco', cognome: 'Neri', titolo: 'Dr.' });
  check(await pc.isHidden('#ppAdmin') && fs.existsSync(path.join(COMUNE, 'Neri Marco')) && /Neri Marco/.test(await pc.textContent('#ppCartellaTesto')),
    'Dr. Neri: nessuna amministrazione, la sua cartella è sul disco');
  await pc.click('#profiloBtn');
  await salva();
  check(albero().some((x) => /^Neri Marco\/\d{4}\/\d{4}-\d{2}-\d{2}_RT\d{2}-[A-Z2-9]{4}\/[^/]*_Stadiazione_/.test(x)) && fs.existsSync(path.join(COMUNE, 'Neri Marco', 'indice-referti.csv')),
    'i suoi referti e il suo indice vanno nella sua cartella');
  console.log(albero().join('\n'));

  // ── memoria e stile sono del medico, e stanno nella sua cartella ──
  const leggiJson = (f) => { try { return JSON.parse(fs.readFileSync(path.join(COMUNE, f), 'utf8')); } catch (_) { return null; } };
  const haFrase = () => pc.evaluate(() => EsgarMemoria.gestione.voci('p_ctNote').some((v) => v.testo === 'frase di Neri'));
  await pc.evaluate(() => EsgarMemoria.gestione.aggiungi('p_ctNote', 'frase di Neri'));
  // la finestra dello stile: il referto del tool, con le parti da cliccare
  await pc.click('#railStile'); await pc.waitForTimeout(500);
  check(/Neri/.test(await pc.textContent('#stSub')) && await pc.locator('#stFoglio [data-parte]').count() === 12 && /Clicca una parte/.test(await pc.textContent('#stIspettore')),
    'Stile personale di Dr. Neri: il referto con apertura, dieci sezioni e chiusura da cliccare');
  await pc.click('[data-st-titoli=iniziale]');
  await pc.click('[data-parte=chiusura]'); await pc.fill('#stTesto', 'Si resta a disposizione.');
  await pc.click('[data-parte=td]'); await pc.click('[data-st=ometti]');
  await pc.click('[data-parte=mrf]'); await pc.fill('#stNome', 'Fascia mesorettale');
  const foglio = await pc.textContent('#stFoglio');
  check(/Fascia mesorettale:/.test(foglio) && /Stage finale:/.test(foglio) && /Si resta a disposizione\./.test(foglio) && await pc.locator('[data-parte=td].omessa').count() === 1,
    'la bozza si vede subito nel foglio: titolo scritto a mano, grafia dei titoli, chiusura, sezione barrata');
  let ref = await pc.inputValue('#output');
  check(/^STAGE FINALE/m.test(ref) && !/Si resta a disposizione/.test(ref), 'finché non si salva il referto vero non cambia');
  await pc.click('[data-parte=emvi]'); await pc.fill('#stNome', 'Fascia mesorettale'); await pc.click('[data-st=salva]'); await pc.waitForTimeout(200);
  check(await pc.isVisible('#stOverlay.open') && /stesso titolo/.test(await pc.textContent('#stStato')), 'due sezioni con lo stesso titolo non si salvano');
  await pc.click('[data-st=ripristina]');
  await pc.click('[data-st=salva]'); await pc.waitForTimeout(400);
  ref = await pc.inputValue('#output');
  check(!(await pc.isVisible('#stOverlay.open')) && /^Stage finale:/m.test(ref) && !/STAGE FINALE/.test(ref) && /^Fascia mesorettale:/m.test(ref) && /Si resta a disposizione\.\n\nReferto redatto/.test(ref) && !/Tumor deposit:/i.test(ref),
    '«Salva»: il referto prende lo stile (titoli, titolo tuo, chiusura, sezione omessa)');
  await pc.waitForTimeout(1700);
  const stileFile = leggiJson('Neri Marco/stile-esgar.json') || {};
  check((leggiJson('Neri Marco/memoria-esgar.json') || { campi: {} }).campi.p_ctNote && stileFile.titoli === 'iniziale' && stileFile.nomi.primaria.mrf === 'Fascia mesorettale:',
    'memoria e stile sono nella cartella del medico: memoria-esgar.json, stile-esgar.json');
  // un altro medico ha i suoi
  await pc.click('#profiloBtn'); await pc.click('#ppEsci'); await accedi(tel);
  ref = await pc.inputValue('#output');
  check(!(await haFrase()) && /^STAGE FINALE/m.test(ref) && !/Si resta a disposizione/.test(ref), 'entra Bianchi: la memoria e lo stile di Neri non sono i suoi');
  // su un altro PC il browser non sa niente: memoria e stile tornano dalla cartella
  await pc.click('#ppEsci');
  await pc.evaluate(() => Object.keys(localStorage).filter((k) => /esgar\.(memoria|stile)/.test(k)).forEach((k) => localStorage.removeItem(k)));
  await accedi(tel2); await pc.waitForTimeout(500);
  ref = await pc.inputValue('#output');
  check(await haFrase() && /^Stage finale:/m.test(ref) && /^Fascia mesorettale:/m.test(ref) && /Si resta a disposizione/.test(ref), 'Neri su un PC nuovo: memoria e stile tornano dalla sua cartella');
  // si torna allo stile del tool; chiudendo senza salvare non cambia niente
  if (await pc.isVisible('#pannelloProfilo')) await pc.click('#profiloBtn');
  await pc.click('#railStile'); await pc.waitForTimeout(400);
  await pc.click('[data-st-titoli=maiuscolo]');
  pc.once('dialog', (d) => d.accept());
  await pc.click('[data-st=annulla]'); await pc.waitForTimeout(200);
  check(!(await pc.isVisible('#stOverlay.open')) && /^Stage finale:/m.test(await pc.inputValue('#output')), '«Annulla» chiede conferma e lascia lo stile com\'era');
  await pc.click('#railStile'); await pc.waitForTimeout(400);
  await pc.click('[data-st-titoli=maiuscolo]');
  await pc.click('[data-parte=td]'); await pc.click('[data-st=ometti]');
  await pc.click('[data-parte=chiusura]'); await pc.click('[data-st=togli]');
  await pc.click('[data-parte=mrf]'); await pc.click('[data-st=ripristina]');
  await pc.click('[data-st=salva]'); await pc.waitForTimeout(1900);
  check(/^MRF:/m.test(await pc.inputValue('#output')) && /^STAGE FINALE/m.test(await pc.inputValue('#output')), 'tolte le regolazioni, il referto torna quello del tool');
  if (await pc.isVisible('#pannelloProfilo')) await pc.click('#profiloBtn');

  await salva(); await pc.waitForTimeout(1700);          // il referto appena salvato entra nella memoria, e la memoria nel file
  check(!albero().some((x) => /\.tmp-/.test(x)), 'nessun file provvisorio rimasto nella cartella comune');

  // ── un indice con le colonne di prima: si rinomina, e ne nasce uno nuovo ──
  const idxNeri = path.join(COMUNE, 'Neri Marco', 'indice-referti.csv');
  fs.writeFileSync(idxNeri, '﻿Data;Tipo;File\r\n01/01/2025;Stadiazione;vecchio.txt\r\n', 'utf8');
  await pc.fill('#arcAccesso', 'B777'); await salva();
  check(/vecchio\.txt/.test(fs.readFileSync(path.join(COMUNE, 'Neri Marco', 'indice-referti-precedente.csv'), 'utf8'))
    && /^﻿Data esame;/.test(fs.readFileSync(idxNeri, 'utf8')) && fs.readFileSync(idxNeri, 'utf8').includes('B777'),
    'indice di prima rinominato in indice-referti-precedente.csv, quello nuovo riparte');

  // ── l'indice non si può sostituire (su Windows: aperto in Excel, o di sola lettura) ──
  if (process.platform === 'win32') {
    fs.chmodSync(idxNeri, 0o444);
    await pc.fill('#arcAccesso', 'B888'); await salva();
    check(/^Salvato nel caso/.test(await stato()) && /L'indice non è stato aggiornato: «indice-referti\.csv» è aperto in un altro programma/.test(await stato())
      && albero().some((x) => /^Neri Marco\/.*_B888_/.test(x)), 'indice bloccato: il referto è salvato, e il messaggio dice che manca solo l\'indice');
    fs.chmodSync(idxNeri, 0o666);
    check(/^﻿Data esame;/.test(fs.readFileSync(idxNeri, 'utf8')) && !albero().some((x) => /\.tmp-/.test(x)), 'l\'indice di prima è intatto, nessun file provvisorio');
  }

  // ── disco di rete scollegato: messaggio chiaro, nessun file perso ──
  const prima = albero().length;
  fs.renameSync(COMUNE, COMUNE + ' (scollegata)');
  await pc.fill('#arcAccesso', 'C555');
  await salva();
  check(/Salvataggio non riuscito: Cartella comune non raggiungibile/.test(await stato()) && !/remote method/.test(await stato()), 'cartella scollegata: «' + (await stato()).slice(0, 70) + '…»');
  fs.renameSync(COMUNE + ' (scollegata)', COMUNE);
  await salva();
  check(/Salvato/.test(await stato()) && albero().length === prima + 1, 'ricollegato il disco, il salvataggio riprende');

  // ── un programma più vecchio, con il ponte incompleto: il tool fa come nel browser ──
  const vecchio = await (await contesto(['stato', 'scegli', 'scrivi', 'leggi', 'elenca', 'esiste'])).newPage();
  vecchio.on('pageerror', (e) => errs.push('vecchio: ' + e.message));
  await vecchio.goto('http://localhost:8125/index.html?nointro'); await vecchio.waitForTimeout(300);
  check(await vecchio.evaluate(() => Desktop === null) && await pc.evaluate(() => Desktop !== null), 'ponte senza le funzioni nuove: il tool non lo usa');

  check(errs.length === 0, 'nessun errore JS ' + errs.join(' | '));
  await b.close(); relay.close(); statico.close();
  fs.rmSync(TMP, { recursive: true, force: true });
})();
