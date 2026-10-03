// Accesso con il telefono e archivio dei referti, da capo a fondo, con un
// relay finto in locale e la cartella privata del browser al posto di
// quella del PC. Uso: npm i playwright && node test/accesso.test.js
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
    let b = ''; req.on('data', c => b += c); req.on('end', () => {
      const m = { id: 'm' + (++seq), time: Date.now() / 1000 | 0, event: 'message', topic, message: b };
      t.msgs.push(m); t.subs.forEach(s => s.write('data: ' + JSON.stringify(m) + '\n\n'));
      res.end('{}');
    });
  } else if (sse === 'sse') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
    res.write('data: ' + JSON.stringify({ event: 'open' }) + '\n\n');
    t.msgs.forEach(m => res.write('data: ' + JSON.stringify(m) + '\n\n'));
    t.subs.add(res); req.on('close', () => t.subs.delete(res));
  } else { res.statusCode = 404; res.end(); }
}).listen(8124);
const statico = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(f, (e, d) => { if (e) { res.statusCode = 404; return res.end(); } res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(d); });
}).listen(8123);

const check = (cond, msg) => { console.log((cond ? 'OK  ' : 'FAIL') + ' ' + msg); if (!cond) process.exitCode = 1; };

(async () => {
  const b = await chromium.launch();
  const pcCtx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const pc = await pcCtx.newPage(); const errs = []; pc.on('pageerror', e => errs.push('pc: ' + e.message));
  await pc.goto('http://localhost:8123/index.html?nointro');
  await pc.evaluate(async () => {
    Canale.usaRelay('http://localhost:8124');
    const o = Canale.nuovoAbbinamento; Canale.nuovoAbbinamento = async () => (window.__abb = await o());
  });
  // salvare senza accesso apre il pannello
  await pc.click('#btnSalva');
  check(await pc.isVisible('#pannelloProfilo'), 'senza accesso, Salva apre il pannello del profilo');
  check(/accedi con il telefono/i.test(await pc.textContent('#archivioStato')), 'messaggio: serve l\'accesso');
  await pc.click('#ppAccedi');
  await pc.waitForSelector('#qrBox:not([hidden])', { timeout: 5000 });
  check(true, 'QR mostrato a relay aperto');
  await pc.screenshot({ path: SHOTS + '/acc_pc_qr.png' });
  const abb = await pc.evaluate(() => window.__abb);

  // telefono
  const telCtx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP1A) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36' });
  const tel = await telCtx.newPage(); tel.on('pageerror', e => errs.push('tel: ' + e.message));
  await tel.goto(`http://localhost:8123/telefono.html#t=${abb.t}&k=${abb.k}`);
  check(!(await tel.evaluate(() => location.hash)), 'il telefono toglie la chiave dall\'indirizzo');
  check(await tel.isVisible('#vCrea'), 'primo uso: il telefono chiede i dati');
  await tel.screenshot({ path: SHOTS + '/acc_tel_crea.png' });
  await tel.fill('#cNome', 'Giulia'); await tel.fill('#cCognome', 'Bianchi');
  await tel.click('#cTitolo [data-t="Dr.ssa"]'); await tel.click('#cSalva');
  check(await tel.isVisible('#vAccesso'), 'poi chiede conferma dell\'accesso');
  await tel.screenshot({ path: SHOTS + '/acc_tel_conferma.png' });
  await tel.evaluate(() => EsgarTelefono.usaRelay('http://localhost:8124'));
  await tel.click('#aConferma');
  await tel.waitForSelector('#vFatto:not([hidden])', { timeout: 8000 });
  await tel.waitForTimeout(900);
  await tel.screenshot({ path: SHOTS + '/acc_tel_fatto.png' });
  const salvato = await tel.evaluate(() => JSON.parse(localStorage.getItem('structurad.esgar.chiave')));
  check(Object.keys(salvato).sort().join() === 'cognome,id,nome,titolo', 'sul telefono solo id, nome, cognome, titolo: ' + JSON.stringify(salvato));

  await pc.waitForFunction(() => document.getElementById('profiloNome').textContent === 'Dr.ssa Bianchi', null, { timeout: 5000 });
  check(true, 'il PC saluta Dr.ssa Bianchi');
  check(await pc.isVisible('#ppCartella.da-fare [data-cartella=scegli]'), 'primo accesso: il pannello chiede la cartella del profilo');
  await pc.evaluate(async () => EsgarTest.usaCartella(await (await navigator.storage.getDirectory()).getDirectoryHandle('Referti Bianchi', { create: true })));
  check(/Referti Bianchi/.test(await pc.textContent('#ppCartellaTesto')), 'cartella scelta: ' + (await pc.textContent('#ppCartellaTesto')).trim());
  await pc.screenshot({ path: SHOTS + '/acc_pc_dentro.png' });
  check(!(await pc.evaluate(() => JSON.stringify(localStorage)).then(s => /"k"|esgar-[a-z0-9]{22}/.test(s))), 'il PC non conserva la chiave di abbinamento');

  // referto e salvataggio
  await pc.click('#profiloBtn');
  await pc.click('text=Anteriore'); await pc.click('text=Posteriore');
  await pc.click('input[name=p_ct][value=cT3c]'); await pc.click('input[name=p_cn][value="cN+"]');
  await pc.selectOption('#p_emviGrade', '3');
  await pc.fill('#arcAccesso', 'A 123/456'); await pc.fill('#arcData', '28092026'); await pc.click('#arcAccesso');
  await pc.click('#btnSalva');
  await pc.waitForFunction(() => /Salvato/.test(document.getElementById('archivioStato').textContent), null, { timeout: 5000 });
  check(true, 'salvato: ' + await pc.textContent('#archivioStato'));
  await pc.click('#btnSalva');
  await pc.waitForTimeout(400);
  check(/_2\.txt/.test(await pc.textContent('#archivioStato')), 'stesso minuto: nessuna sovrascrittura (' + await pc.textContent('#archivioStato') + ')');
  await pc.click('#btnModeRistad'); await pc.waitForTimeout(300);
  await pc.click('input[name=r_risposta][value=near-cCR]'); await pc.click('input[name=r_yct][value=ycT1-2]');
  await pc.click('#btnSalva'); await pc.waitForTimeout(400);
  check(/Referti Bianchi\/Ristadiazione\//.test(await pc.textContent('#archivioStato')), 'ristadiazione nella sua cartella');
  await pc.screenshot({ path: SHOTS + '/acc_pc_salvato.png' });

  const albero = await pc.evaluate(async () => {
    const out = [];
    async function giro(d, p) { for await (const [n, h] of d.entries()) { if (h.kind === 'directory') await giro(h, p + n + '/'); else out.push(p + n); } }
    const root = await navigator.storage.getDirectory(); await giro(root, '');
    const op = await root.getDirectoryHandle('Referti Bianchi');
    const idx = await (await (await op.getFileHandle('indice-referti.csv')).getFile()).text();
    const f = out.find(x => x.endsWith('.txt'));
    let d = root; const parti = f.split('/'); for (const x of parti.slice(0, -1)) d = await d.getDirectoryHandle(x);
    const txt = await (await (await d.getFileHandle(parti.at(-1))).getFile()).text();
    return { out, idx, txt };
  });
  console.log(albero.out.join('\n')); console.log('--- indice\n' + albero.idx); console.log('--- primo referto (inizio)\n' + albero.txt.slice(0, 420));

  // la sessione resta alla ricarica, poi Esci
  await pc.reload(); await pc.waitForTimeout(500);
  check(await pc.textContent('#profiloNome') === 'Dr.ssa Bianchi', 'dopo la ricarica la sessione resta');
  check(/Referti Bianchi/.test(await pc.textContent('#ppCartellaTesto')), 'e anche la sua cartella');
  await pc.evaluate(() => {                      // la ricarica ha tolto il relay finto
    Canale.usaRelay('http://localhost:8124');
    const o = Canale.nuovoAbbinamento; Canale.nuovoAbbinamento = async () => (window.__abb = await o());
  });
  await pc.click('#profiloBtn'); await pc.click('#ppEsci');
  check(await pc.textContent('#profiloNome') === 'Accedi', 'Esci chiude la sessione');
  check(!/Referti Bianchi/.test(await pc.textContent('#ppCartellaTesto')), 'uscita: la cartella non resta a vista');

  async function accedi(pagina){
    await pc.click('#ppAccedi');
    await pc.waitForSelector('#qrBox:not([hidden])', { timeout: 5000 });
    const a = await pc.evaluate(() => window.__abb);
    await pagina.goto(`http://localhost:8123/telefono.html#t=${a.t}&k=${a.k}`);
    await pagina.evaluate(() => EsgarTelefono.usaRelay('http://localhost:8124'));
    await pagina.click('#aConferma');
    await pagina.waitForSelector('#vFatto:not([hidden])', { timeout: 8000 });
    await pc.waitForFunction(() => document.getElementById('profiloNome').textContent !== 'Accedi', null, { timeout: 5000 });
    await pc.waitForTimeout(300);
  }
  await accedi(tel);
  check(/Referti Bianchi/.test(await pc.textContent('#ppCartellaTesto')) && !(await pc.isVisible('#ppCartella.da-fare')), 'nuovo accesso: la cartella del profilo torna da sola');
  check(/cartella <b>Referti Bianchi<\/b>|Referti Bianchi/.test(await pc.innerHTML('#ppAccessoStato')), 'e il saluto la nomina: ' + (await pc.textContent('#ppAccessoStato')).trim());
  await pc.screenshot({ path: SHOTS + '/acc_pc_ricorda.png' });
  await pc.click('#ppEsci');
  // un altro operatore, dallo stesso PC
  const tel2 = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })).newPage();
  await tel2.goto('http://localhost:8123/telefono.html');
  await tel2.fill('#cNome', 'Marco'); await tel2.fill('#cCognome', 'Neri'); await tel2.click('#cSalva');
  await pc.click('#ppAccedi'); await pc.waitForSelector('#qrBox:not([hidden])');
  { const a = await pc.evaluate(() => window.__abb);
    await tel2.goto(`http://localhost:8123/telefono.html#t=${a.t}&k=${a.k}`);
    await tel2.evaluate(() => EsgarTelefono.usaRelay('http://localhost:8124'));
    await tel2.click('#aConferma'); await tel2.waitForSelector('#vFatto:not([hidden])', { timeout: 8000 });
    await pc.waitForFunction(() => document.getElementById('profiloNome').textContent === 'Dr. Neri', null, { timeout: 5000 }); }
  check(await pc.isVisible('#ppCartella.da-fare'), 'un altro profilo non vede la cartella di Bianchi: deve scegliere la sua');
  await pc.screenshot({ path: SHOTS + '/acc_pc_primo.png' });
  await pc.click('#ppEsci');
  // sessione scaduta
  await pc.evaluate(() => { localStorage.setItem('structurad.esgar.sessione', JSON.stringify({ profilo: { id: 'op-abcdefghijkm', nome: 'A', cognome: 'B', titolo: '' }, scade: Date.now() - 1 })); });
  await pc.reload(); await pc.waitForTimeout(400);
  check(await pc.textContent('#profiloNome') === 'Accedi', 'sessione scaduta: si riparte da Accedi');
  // telefono a riposo
  await tel.goto('http://localhost:8123/telefono.html'); await tel.waitForTimeout(400);
  check(await tel.isVisible('#vChiave'), 'telefono senza QR: mostra la chiave');
  await tel.screenshot({ path: SHOTS + '/acc_tel_chiave.png' });
  check(errs.length === 0, 'nessun errore JS ' + errs.join(' | '));
  await b.close(); relay.close(); statico.close();
})();
