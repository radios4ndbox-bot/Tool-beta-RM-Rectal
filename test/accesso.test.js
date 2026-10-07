// Accesso con il telefono, amministratore e archivio dei referti, da capo
// a fondo, con un relay finto in locale e la cartella privata del browser
// al posto di quella del PC. Uso: npm i playwright && node test/accesso.test.js
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..'), SHOTS = process.argv[2] || require('os').tmpdir();

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
}).listen(8124);
const statico = http.createServer((req, res) => {
  fs.readFile(path.join(ROOT, decodeURIComponent(req.url.split('?')[0])), (e, d) => {
    if (e) { res.statusCode = 404; return res.end(); }
    res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(d);
  });
}).listen(8123);

const check = (cond, msg) => { console.log((cond ? 'OK  ' : 'FAIL') + ' ' + msg); if (!cond) process.exitCode = 1; };

(async () => {
  const b = await chromium.launch();
  const errs = [];
  const pc = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  pc.on('pageerror', (e) => errs.push('pc: ' + e.message));
  const preparaPc = () => pc.evaluate(() => {
    Canale.usaRelay('http://localhost:8124');
    const o = Canale.nuovoAbbinamento; Canale.nuovoAbbinamento = async () => (window.__abb = await o());
  });
  const telefono = async (ua) => {
    const t = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, userAgent: ua })).newPage();
    t.on('pageerror', (e) => errs.push('tel: ' + e.message));
    return t;
  };
  const albero = () => pc.evaluate(async () => {
    const out = [];
    async function giro(d, p) { for await (const [n, h] of d.entries()) { if (h.kind === 'directory') await giro(h, p + n + '/'); else out.push(p + n); } }
    await giro(await navigator.storage.getDirectory(), ''); return out.sort();
  });
  /* accesso: QR sul PC, conferma sul telefono (con i dati se è il primo uso) */
  async function accedi(tel, dati){
    if (await pc.isHidden('#pannelloProfilo')) await pc.click('#profiloBtn');
    await pc.click('#ppAccedi');
    await pc.waitForSelector('#qrBox:not([hidden])', { timeout: 5000 });
    const a = await pc.evaluate(() => window.__abb);
    await tel.goto(`http://localhost:8123/telefono.html#t=${a.t}&k=${a.k}`);
    if (dati) {
      await tel.fill('#cNome', dati.nome); await tel.fill('#cCognome', dati.cognome);
      await tel.click(`#cTitolo [data-t="${dati.titolo}"]`); await tel.click('#cSalva');
    }
    await tel.evaluate(() => EsgarTelefono.usaRelay('http://localhost:8124'));
    await tel.click('#aConferma');
    await tel.waitForSelector('#vFatto:not([hidden])', { timeout: 8000 });
    await pc.waitForFunction(() => document.getElementById('profiloNome').textContent !== 'Accedi', null, { timeout: 5000 });
    await pc.waitForTimeout(300);
  }

  await pc.goto('http://localhost:8123/index.html?nointro');
  await preparaPc();
  await pc.click('#btnSalva');
  check(await pc.isVisible('#pannelloProfilo') && /accedi con il telefono/i.test(await pc.textContent('#archivioStato')), 'senza accesso, Salva apre il pannello del profilo');

  // ── primo medico su un PC nuovo: lo configura e ne diventa amministratore ──
  const tel = await telefono('Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP1A) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36');
  await accedi(tel, { nome: 'Giulia', cognome: 'Bianchi', titolo: 'Dr.ssa' });
  await tel.screenshot({ path: SHOTS + '/acc_tel_fatto.png' });
  const salvato = await tel.evaluate(() => JSON.parse(localStorage.getItem('structurad.esgar.chiave')));
  check(Object.keys(salvato).sort().join() === 'cognome,id,nome,titolo', 'sul telefono, in chiaro, solo id, nome, cognome, titolo');
  const codiceTel = await tel.evaluate(() => EsgarTelefono.codice());
  const ses = await pc.evaluate(() => EsgarTest.sessione());
  check(/^[0-9A-F]{4}(-[0-9A-F]{4}){3}$/.test(codiceTel) && ses.codice === codiceTel, 'il PC riconosce il codice dispositivo firmato: ' + codiceTel);
  check(await pc.textContent('#profiloNome') === 'Dr.ssa Bianchi', 'il PC saluta Dr.ssa Bianchi');
  check(/accesso firmato/.test(await pc.textContent('#ppVersione')) && await pc.isHidden('#ppSenzaCodice'), 'il pannello mostra versione e «accesso firmato»');
  check(!(await pc.evaluate(() => JSON.stringify(localStorage))).match(/esgar-[a-z0-9]{22}/), 'il PC non conserva la chiave di abbinamento');
  check(await pc.isHidden('#ppAdmin') && !(await pc.evaluate(() => EsgarTest.eAdmin())), 'un telefono fuori dalla lista non è amministratore, nemmeno su un PC nuovo');
  check(!(await pc.evaluate(async () => EsgarTest.usaRadice(await navigator.storage.getDirectory()))), 'e non può scegliere la cartella comune');
  // regola provvisoria, a lista vuota: il primo che configura il PC ne diventa amministratore
  const lista = await pc.evaluate(() => EsgarTest.amministratori.splice(0));
  await pc.click('#ppEsci'); await accedi(tel);
  check(await pc.isVisible('#ppAdmin.da-fare') && /Scegli la cartella comune/.test(await pc.textContent('#ppAdminAzioni')), 'lista vuota, PC nuovo: propone di configurarlo');
  await pc.evaluate((l) => EsgarTest.amministratori.push(...l), lista);
  // il telefono di Bianchi entra nella lista: è amministratore su ogni PC
  await pc.evaluate((c) => EsgarTest.amministratori.push(c), codiceTel);
  await pc.click('#ppEsci'); await accedi(tel);
  check(await pc.isVisible('#ppAdmin.da-fare') && /Cartella comune/.test(await pc.textContent('#ppAdminTesto')), 'codice nella lista: amministratore, e il PC chiede la cartella comune');
  check(!(await pc.evaluate(() => document.body.innerText)).includes(codiceTel), 'il codice dispositivo non compare da nessuna parte nel tool');
  await pc.screenshot({ path: SHOTS + '/acc_pc_configura.png' });
  check(await pc.evaluate(async () => EsgarTest.usaRadice(await (await navigator.storage.getDirectory()).getDirectoryHandle('Referti RM Retto', { create: true }))), 'sceglie la cartella comune');
  check(await pc.evaluate(() => EsgarTest.eAdmin()) && /Cartella comune/.test(await pc.textContent('#ppAdminTesto')), 'ed è l\'amministratore di questo PC');
  check((await albero()).join() === 'Referti RM Retto/structurad-esgar.json', 'la cartella comune è segnata dal file structurad-esgar.json');
  check(await pc.evaluate(async () => { const r = await (await navigator.storage.getDirectory()).getDirectoryHandle('Referti RM Retto'); const n = []; for await (const [k, h] of r.entries()) if (h.kind === 'directory') n.push(k); return n.join(); }) === 'Bianchi Giulia', 'il tool crea la cartella del medico: Referti RM Retto/Bianchi Giulia');
  check(/Referti RM Retto \/ Bianchi Giulia/.test(await pc.textContent('#ppCartellaTesto')), 'il pannello mostra la sua cartella');

  // referti
  await pc.click('#profiloBtn');
  await pc.click('text=Anteriore'); await pc.click('text=Posteriore');
  await pc.click('input[name=p_ct][value=cT3c]'); await pc.click('input[name="p_cn"][value="cN+"]');
  await pc.selectOption('#p_emviGrade', '3');
  await pc.fill('#arcAccesso', 'A 123/456'); await pc.fill('#arcData', '28092026'); await pc.click('#arcAccesso');
  await pc.click('#btnSalva');
  await pc.waitForFunction(() => /Salvato/.test(document.getElementById('archivioStato').textContent), null, { timeout: 5000 });
  const codice = (await pc.evaluate(() => EsgarTest.caso())).codice;
  check(/^RT\d{2}-[A-Z2-9]{4}$/.test(codice) && await pc.textContent('#casoChip .caso-cod') === codice, 'il tool crea il codice del caso: ' + codice);
  check(new RegExp('Referti RM Retto/Bianchi Giulia/2026/2026-09-28_' + codice + '/2026-09-28_\\d{4}_Stadiazione_A123456_cT3c_cN\\+_MRF-_EMVI\\+\\.txt').test(await pc.textContent('#archivioStato')), 'salvato nella cartella del caso: ' + await pc.textContent('#archivioStato'));
  await pc.click('#btnSalva'); await pc.waitForTimeout(400);
  check(/_2\.txt/.test(await pc.textContent('#archivioStato')) && (await pc.evaluate(() => EsgarTest.caso())).codice === codice, 'stesso minuto: nessuna sovrascrittura, stesso caso');
  // ristadiazione: senza associazione chiede conferma; con «Ricerca precedente» va nello stesso caso
  await pc.click('#btnNuovoCaso');
  await pc.click('#btnModeRistad'); await pc.waitForTimeout(300);
  await pc.click('input[name=r_risposta][value=near-cCR]'); await pc.click('input[name=r_yct][value=ycT1-2]');
  pc.once('dialog', (d) => d.dismiss());
  await pc.click('#btnSalva'); await pc.waitForTimeout(300);
  check(/Ricerca precedente/.test(await pc.textContent('#archivioStato')), 'ristadiazione non associata: chiede conferma e non salva');
  await pc.click('#btnCerca'); await pc.waitForSelector('#cercaPannello.aperto .cerca-caso', { timeout: 5000 });
  await pc.fill('#cercaQ', codice.toLowerCase().slice(0, 6));
  check(await pc.locator('#cercaPannello .cerca-caso').count() === 1 && /Stadiazione/.test(await pc.textContent('#cercaPannello .cerca-caso')), 'Ricerca precedente trova il caso dal codice');
  await pc.fill('#cercaQ', 'A1234');
  check(await pc.locator('#cercaPannello .cerca-caso').count() === 1, '…e anche dal numero d\'accesso della stadiazione');
  await pc.click('#cercaPannello [data-vedi="0"]'); await pc.waitForTimeout(200);
  check(new RegExp('Codice caso: ' + codice).test(await pc.textContent('#cercaPannello .cerca-anteprima')), 'anteprima della stadiazione, con il codice del caso');
  await pc.screenshot({ path: SHOTS + '/casi_cerca.png' });
  await pc.click('#cercaPannello [data-associa="0"]');
  check(await pc.inputValue('#r_confronto') === '28/09/2026' && (await pc.inputValue('#output')).includes('Confronto con RM basale del: 28/09/2026'), 'associando, la RM basale di confronto prende la data della stadiazione');
  await pc.fill('#arcAccesso', 'A178902'); await pc.fill('#arcData', '20122026'); await pc.click('#arcAccesso');
  await pc.click('#btnSalva'); await pc.waitForTimeout(400);
  check(new RegExp('Bianchi Giulia/2026/2026-09-28_' + codice + '/2026-12-20_\\d{4}_Ristadiazione_A178902_near-cCR_ycT1-2').test(await pc.textContent('#archivioStato')), 'ristadiazione nella stessa cartella della stadiazione');
  await pc.screenshot({ path: SHOTS + '/casi_salvato.png' });
  await pc.screenshot({ path: SHOTS + '/acc_pc_salvato.png' });
  await pc.click('#btnModePrimaria'); await pc.waitForTimeout(200);

  // la sessione resta alla ricarica; uscita e nuovo accesso: di nuovo amministratore
  await pc.reload(); await pc.waitForTimeout(500); await preparaPc();
  await pc.evaluate((c) => EsgarTest.amministratori.push(c), codiceTel);   // la lista del test vive in memoria
  check(await pc.textContent('#profiloNome') === 'Dr.ssa Bianchi' && await pc.evaluate(() => EsgarTest.eAdmin()), 'dopo la ricarica: stessa sessione, ancora amministratore');
  await pc.click('#profiloBtn'); await pc.click('#ppEsci');
  check(await pc.textContent('#profiloNome') === 'Accedi' && await pc.isHidden('#ppAdmin'), 'Esci chiude la sessione e l\'amministrazione');
  await accedi(tel);
  check(await pc.evaluate(() => EsgarTest.eAdmin()) && /Bianchi Giulia/.test(await pc.textContent('#ppAccessoStato')), 'nuovo accesso dallo stesso telefono: amministratore, con la sua cartella');
  await pc.click('#ppEsci');

  // ── un altro medico: niente amministrazione, la sua cartella si crea da sola ──
  const tel2 = await telefono('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148');
  await accedi(tel2, { nome: 'Marco', cognome: 'Neri', titolo: 'Dr.' });
  check(await pc.textContent('#profiloNome') === 'Dr. Neri', 'entra Dr. Neri');
  check(await pc.isHidden('#ppAdmin') && !(await pc.evaluate(() => EsgarTest.eAdmin())), 'non è amministratore: la sezione non c\'è');
  check(!(await pc.evaluate(async () => EsgarTest.usaRadice(await navigator.storage.getDirectory()))), 'e non può cambiare la cartella comune');
  check(/Referti RM Retto \/ Neri Marco/.test(await pc.textContent('#ppCartellaTesto')), 'la sua cartella: Referti RM Retto / Neri Marco');
  await pc.screenshot({ path: SHOTS + '/acc_pc_medico.png' });
  await pc.click('#profiloBtn');
  await pc.click('#btnSalva'); await pc.waitForTimeout(400);
  check(/Referti RM Retto\/Neri Marco\/\d{4}\/\d{4}-\d{2}-\d{2}_RT\d{2}-[A-Z2-9]{4}\/[^/]*_Stadiazione_/.test(await pc.textContent('#archivioStato')), 'i suoi referti vanno nella sua cartella, in un caso suo');
  const codiceNeri = (await pc.evaluate(() => EsgarTest.caso())).codice;
  check(codiceNeri !== codice, 'un altro paziente, un altro codice');
  // un numero d'accesso diverso dopo il salvataggio è un altro paziente
  await pc.fill('#arcAccesso', 'B999');
  check(!(await pc.evaluate(() => EsgarTest.caso())), 'cambiando il numero d\'accesso il caso si chiude');
  // ristadiazione di Neri per un paziente stadiato da Bianchi: va nel caso di Bianchi
  await pc.click('#btnModeRistad'); await pc.waitForTimeout(300);
  await pc.click('#btnCerca'); await pc.waitForSelector('#cercaPannello.aperto .cerca-caso', { timeout: 5000 });
  await pc.fill('#cercaQ', codice);
  await pc.click('#cercaPannello [data-associa="0"]');
  await pc.click('#btnSalva'); await pc.waitForTimeout(400);
  check(new RegExp('Bianchi Giulia/2026/2026-09-28_' + codice + '/[^/]*_Ristadiazione_').test(await pc.textContent('#archivioStato')), 'ristadiazione di un altro medico: nella cartella del caso');
  const files = await albero();
  console.log(files.join('\n'));
  check(files.filter((f) => f.endsWith('indice-referti.csv')).length === 2, 'un indice per medico');
  // il browser perde la cartella comune (dati del sito cancellati): un medico qualunque la ricollega
  await pc.evaluate(() => EsgarTest.dimenticaRadice()); await pc.click('#profiloBtn').catch(() => {}); await pc.waitForTimeout(200);
  if (!(await pc.isVisible('#pannelloProfilo'))) await pc.click('#profiloBtn');
  check(await pc.isVisible('[data-cartella="ricollega"]'), 'cartella comune persa: il medico vede «Ricollega la cartella comune»');
  check(!(await pc.evaluate(async () => EsgarTest.ricollega(await (await navigator.storage.getDirectory()).getDirectoryHandle('Altra', { create: true })))), 'una cartella qualsiasi non viene accettata');
  check(await pc.evaluate(async () => EsgarTest.ricollega(await (await navigator.storage.getDirectory()).getDirectoryHandle('Referti RM Retto'))) && /Referti RM Retto \/ Neri Marco/.test(await pc.textContent('#ppCartellaTesto')), 'la cartella comune segnata si ricollega, anche senza amministratore');
  await pc.evaluate(async () => { const r = await (await navigator.storage.getDirectory()).getDirectoryHandle('Referti RM Retto'); await r.removeEntry('structurad-esgar.json'); await EsgarTest.dimenticaRadice(); });
  check(await pc.evaluate(async () => EsgarTest.ricollega(await (await navigator.storage.getDirectory()).getDirectoryHandle('Referti RM Retto'))), 'anche un archivio di prima della marca si riconosce dagli indici');
  await pc.evaluate(async () => (await navigator.storage.getDirectory()).removeEntry('Altra'));
  await pc.keyboard.press('Escape');
  const caseB = files.filter((f) => f.includes('_' + codice + '/'));
  check(caseB.length === 4 && caseB.filter((f) => /_Ristadiazione_/.test(f)).length === 2, 'nel caso di Bianchi: due stadiazioni e due ristadiazioni, vicine');
  const idxNeri = await pc.evaluate(async () => (await (await (await (await (await navigator.storage.getDirectory()).getDirectoryHandle('Referti RM Retto')).getDirectoryHandle('Neri Marco')).getFileHandle('indice-referti.csv')).getFile()).text());
  check(/Codice caso/.test(idxNeri) && idxNeri.includes(codice) && idxNeri.includes('Bianchi Giulia/2026/2026-09-28_' + codice), 'l\'indice di Neri ha la sua ristadiazione, con codice e percorso');

  // ── firma: un accesso con firma falsa non porta il codice ──
  const f = await tel.evaluate(() => EsgarTelefono.firma('structurad-esgar|accesso|esgar-aaaaaaaaaaaaaaaaaaaaaa|op-aaaaaaaaaaaa'));
  const ver = await pc.evaluate(async (f) => [
    await Canale.verificaFirma(f.pub, f.firma, 'structurad-esgar|accesso|esgar-aaaaaaaaaaaaaaaaaaaaaa|op-aaaaaaaaaaaa'),
    await Canale.verificaFirma(f.pub, f.firma, 'structurad-esgar|accesso|esgar-bbbbbbbbbbbbbbbbbbbbbb|op-aaaaaaaaaaaa')], f);
  check(ver[0] === true && ver[1] === false, 'la firma vale solo per quell\'accesso: rigiocata su un altro QR non passa');

  // sessione di prima dell'aggiornamento, senza codice: l'avviso dice di rientrare
  await pc.evaluate(() => { localStorage.setItem('structurad.esgar.sessione', JSON.stringify({ profilo: { id: 'op-abcdefghijkm', nome: 'Pasquale', cognome: 'Viggiano', titolo: 'Dr.' }, dispositivo: 'iPhone', dal: Date.now(), scade: Date.now() + 3600e3 })); });
  await pc.reload(); await pc.waitForTimeout(400); await pc.click('#profiloBtn');
  check(await pc.isVisible('#ppSenzaCodice') && /accesso senza firma/.test(await pc.textContent('#ppVersione')), 'sessione senza codice: avviso «esci e accedi di nuovo»');
  await pc.screenshot({ path: SHOTS + '/acc_pc_senzacodice.png' });
  // sessione scaduta
  await pc.evaluate(() => { localStorage.setItem('structurad.esgar.sessione', JSON.stringify({ profilo: { id: 'op-abcdefghijkm', nome: 'A', cognome: 'B', titolo: '' }, scade: Date.now() - 1 })); });
  await pc.reload(); await pc.waitForTimeout(400);
  check(await pc.textContent('#profiloNome') === 'Accedi', 'sessione scaduta: si riparte da Accedi');
  await tel.goto('http://localhost:8123/telefono.html'); await tel.waitForTimeout(500);
  check(await tel.isVisible('#vChiave') && await tel.textContent('[data-codice]') === codiceTel, 'telefono senza QR: la chiave con il codice dispositivo');
  await tel.screenshot({ path: SHOTS + '/acc_tel_chiave.png' });
  check(errs.length === 0, 'nessun errore JS ' + errs.join(' | '));
  await b.close(); relay.close(); statico.close();
})();
