// Diventare amministratore con una delega: la richiesta parte dal telefono
// del medico, arriva come notifica all'amministratore, che approva dal
// suo telefono; da lì in poi il medico è amministratore su ogni PC.
// Uso: npm i playwright && node test/amministratore.test.js
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..');
const PAGINE = 'http://localhost:8127', RELAY = 'http://localhost:8128';

// relay finto: POST /<topic>, GET /<topic>/sse?since=all, e POST / con JSON
// { topic, title, message, click } come le notifiche di ntfy
const topics = new Map(); let seq = 0;
const notifiche = [];
const relay = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  let [, topic, sse] = req.url.split('?')[0].split('/');
  const canale = (n) => { const t = topics.get(n) || { msgs: [], subs: new Set() }; topics.set(n, t); return t; };
  if (req.method === 'POST') {
    let b = ''; req.on('data', (c) => b += c); req.on('end', () => {
      let message = b;
      if (!topic) { const j = JSON.parse(b); topic = j.topic; message = j.message; notifiche.push(j); }
      const t = canale(topic);
      const m = { id: 'm' + (++seq), time: Date.now() / 1000 | 0, event: 'message', topic, message };
      t.msgs.push(m); t.subs.forEach((s) => s.write('data: ' + JSON.stringify(m) + '\n\n'));
      res.end('{}');
    });
  } else if (sse === 'sse') {
    const t = canale(topic);
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
    res.write('data: ' + JSON.stringify({ event: 'open' }) + '\n\n');
    t.msgs.forEach((m) => res.write('data: ' + JSON.stringify(m) + '\n\n'));
    t.subs.add(res); req.on('close', () => t.subs.delete(res));
  } else { res.statusCode = 404; res.end(); }
}).listen(8128);
// le pagine, con il relay finto e, quando si conosce, il codice del telefono
// dell'amministratore al posto di quello vero
let ADMIN = '';
const statico = http.createServer((req, res) => {
  fs.readFile(path.join(ROOT, decodeURIComponent(req.url.split('?')[0])), 'utf8', (e, d) => {
    if (e) { res.statusCode = 404; return res.end(); }
    d = d.split("'https://ntfy.sh'").join(`'${RELAY}'`);
    if (ADMIN) d = d.split("'9407-BEE0-7B5F-AED2'").join(`'${ADMIN}'`);
    res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(d);
  });
}).listen(8127);

const check = (cond, msg) => { console.log((cond ? 'OK  ' : 'FAIL') + ' ' + msg); if (!cond) process.exitCode = 1; };

(async () => {
  const b = await chromium.launch();
  const errs = [];
  const telefono = async (nome, ua) => {
    const t = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, userAgent: ua })).newPage();
    t.on('pageerror', (e) => errs.push(nome + ': ' + e.message));
    return t;
  };
  const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP1A) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36';
  const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
  const creaChiave = async (t, nome, cognome, titolo) => {
    await t.goto(PAGINE + '/telefono.html');
    await t.fill('#cNome', nome); await t.fill('#cCognome', cognome);
    await t.click(`#cTitolo [data-t="${titolo}"]`); await t.click('#cSalva');
    await t.waitForFunction(() => /^[0-9A-F]{4}-/.test(document.querySelector('[data-codice]').textContent));
    return t.evaluate(() => EsgarTelefono.codice());
  };
  const chiave = async (t) => { await t.goto(PAGINE + '/telefono.html?' + Date.now()); await t.waitForSelector('#vChiave:not([hidden])'); await t.waitForTimeout(300); };
  const nota = (t) => t.textContent('#kAdmin');

  // ── il telefono dell'amministratore: il suo codice entra nella lista ──
  const telA = await telefono('admin', ANDROID);
  ADMIN = await creaChiave(telA, 'Pasquale', 'Viggiano', 'Dr.');
  await chiave(telA);
  check(/Questo telefono è amministratore/.test(await nota(telA)) && await telA.isHidden('#kChiedi'), 'il telefono della lista sa di essere amministratore, e non chiede niente');

  // ── il PC, e un medico che non è amministratore ──
  const pc = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  pc.on('pageerror', (e) => errs.push('pc: ' + e.message));
  await pc.goto(PAGINE + '/index.html?nointro');
  await pc.evaluate(() => { const o = Canale.nuovoAbbinamento; Canale.nuovoAbbinamento = async () => (window.__abb = await o()); });
  async function accedi(tel){
    if (await pc.isHidden('#pannelloProfilo')) await pc.click('#profiloBtn');
    if (await pc.isVisible('#ppEsci')) await pc.click('#ppEsci');
    await pc.click('#ppAccedi');
    await pc.waitForSelector('#qrBox:not([hidden])', { timeout: 5000 });
    const a = await pc.evaluate(() => window.__abb);
    await tel.goto(`${PAGINE}/telefono.html?${Date.now()}#t=${a.t}&k=${a.k}`);
    await tel.click('#aConferma');
    await tel.waitForSelector('#vFatto:not([hidden])', { timeout: 8000 });
    await pc.waitForFunction(() => document.getElementById('profiloNome').textContent !== 'Accedi', null, { timeout: 5000 });
    await pc.waitForTimeout(300);
  }
  const telN = await telefono('neri', IPHONE);
  const codiceN = await creaChiave(telN, 'Marco', 'Neri', 'Dr.');
  await accedi(telN);
  check(!(await pc.evaluate(() => EsgarTest.eAdmin())) && await pc.isHidden('#ppAdmin'), 'Dr. Neri entra: non è amministratore');
  check(/Chiedi di diventare amministratore/.test(await pc.textContent('#ppCartellaTesto')), 'il PC gli dice come chiederlo');

  // ── la richiesta parte dal telefono e arriva come notifica ──
  await chiave(telN);
  check(await telN.isVisible('#kChiedi'), 'sul suo telefono: «Chiedi di diventare amministratore»');
  await telN.click('#kChiedi');
  await telN.waitForFunction(() => /in attesa/.test(document.getElementById('kAdmin').textContent), null, { timeout: 5000 });
  const n = notifiche[0];
  check(notifiche.length === 1 && n.topic.startsWith('esgar-richieste-') && /Dr\. Neri \(Marco Neri\)/.test(n.message) && n.message.includes(codiceN) && n.click.startsWith(PAGINE + '/telefono.html#r='),
    'notifica all\'amministratore: «' + n.message + '»');
  check(await telN.isHidden('#kChiedi'), 'in attesa della risposta il pulsante sparisce');

  // ── un telefono qualunque non può approvare, né firmare una delega che valga ──
  const telX = await telefono('rossi', ANDROID);
  const codiceX = await creaChiave(telX, 'Anna', 'Rossi', 'Dr.ssa');
  await telX.goto(n.click); await telX.waitForTimeout(400);
  check(await telX.isVisible('#vRichiesta') && await telX.isDisabled('#rApprova') && /Solo un amministratore/.test(await telX.textContent('#rStato')), 'chi non è nella lista apre la notifica ma non può rispondere');
  const falsa = await telX.evaluate((c) => EsgarTelefono.firma('structurad-esgar|amministratore|' + c), codiceN);
  check(!(await pc.evaluate(([d, c]) => Canale.delegaValida(d, c), [falsa, codiceN])), 'una delega firmata da chi non è amministratore non vale');

  // ── l'amministratore approva dal suo telefono ──
  await telA.goto(n.click); await telA.waitForTimeout(400);
  check(/Dr\. Neri \(Marco Neri\)/.test(await telA.textContent('#rChi')) && await telA.textContent('#rCodice') === codiceN && await telA.isEnabled('#rApprova'),
    'l\'amministratore vede chi chiede e il suo codice');
  await telA.click('#rApprova');
  await telA.waitForSelector('#vFatto:not([hidden])', { timeout: 5000 });
  check(/approvata/.test(await telA.textContent('#fTitolo')), 'approvata');
  await telN.waitForFunction(() => /Sei amministratore/.test(document.getElementById('kAdmin').textContent), null, { timeout: 5000 });
  check(await telN.isHidden('#kChiedi'), 'il telefono di Neri riceve la delega: «' + await nota(telN) + '»');

  // ── da ora è amministratore su ogni PC, a ogni accesso ──
  await accedi(telN);
  check(await pc.evaluate(() => EsgarTest.eAdmin()) && await pc.isVisible('#ppAdmin') && /amministratore/.test(await pc.textContent('#ppDet')), 'al nuovo accesso il PC lo riconosce amministratore');
  const altroPc = await (await b.newContext()).newPage();
  await altroPc.goto(PAGINE + '/index.html?nointro');
  const delega = await telN.evaluate(() => JSON.parse(localStorage.getItem('structurad.esgar.delega')));
  check(await altroPc.evaluate(([d, c]) => Canale.delegaValida(d, c), [delega, codiceN]), 'la delega vale anche su un altro PC, che non l\'ha mai vista');

  // ── la delega è di quel telefono: su un altro non vale ──
  check(!(await pc.evaluate(([d, c]) => Canale.delegaValida(d, c), [delega, codiceX])), 'la stessa delega non vale per un altro codice');
  await telX.evaluate((d) => localStorage.setItem('structurad.esgar.delega', JSON.stringify(d)), delega);
  await accedi(telX);
  check(!(await pc.evaluate(() => EsgarTest.eAdmin())) && await pc.isHidden('#ppAdmin'), 'copiata su un altro telefono, non fa entrare da amministratore');
  await telX.evaluate(() => localStorage.removeItem('structurad.esgar.delega'));

  // ── si ritira mettendo il codice fra i revocati ──
  await accedi(telN);
  await pc.evaluate((c) => Canale.REVOCATI.push(c), codiceN);
  check(!(await pc.evaluate(() => EsgarTest.eAdmin())), 'codice revocato: non è più amministratore, nemmeno a sessione aperta');
  await pc.evaluate(() => Canale.REVOCATI.splice(0));

  // ── una richiesta rifiutata ──
  await chiave(telX);
  await telX.click('#kChiedi');
  await telX.waitForFunction(() => /in attesa/.test(document.getElementById('kAdmin').textContent), null, { timeout: 5000 });
  await telA.goto(notifiche[1].click); await telA.waitForTimeout(400);
  await telA.click('#rRifiuta');
  await telA.waitForSelector('#vFatto:not([hidden])', { timeout: 5000 });
  await telX.waitForFunction(() => /non è stata approvata/.test(document.getElementById('kAdmin').textContent), null, { timeout: 5000 });
  check(await telX.isVisible('#kChiedi') && !(await telX.evaluate(() => localStorage.getItem('structurad.esgar.delega'))), 'rifiutata: il collega lo legge, e può chiedere di nuovo');

  check(errs.length === 0, 'nessun errore JS ' + errs.join(' | '));
  await b.close(); relay.close(); statico.close();
})();
