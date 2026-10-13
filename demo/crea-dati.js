// Rigenera i referti di esempio della dimostrazione (dati/referti) con un
// altro medico: node crea-dati.js Nome Cognome [Dr.|Dr.ssa]
//
// I referti sono VERI: il form del tool si compila in un browser e si preme
// «Salva nell'archivio», con il ponte del programma (desktop/ponte.js) che
// scrive in dati/referti. Serve Playwright nella radice del repository
// (npm i playwright). La cartella dati/referti di prima va tolta a mano.
const path = require('path'), fs = require('fs'), http = require('http');
const [nome = 'Mario', cognome = 'Rossi', titolo = 'Dr.'] = process.argv.slice(2);
const repo = path.join(__dirname, '..'), comune = path.join(__dirname, 'dati', 'referti');
if (fs.existsSync(comune)) { console.log('dati/referti esiste già: toglila o rinominala, poi rilancia.'); process.exit(1); }
const { chromium } = require(path.join(repo, 'node_modules', 'playwright'));
const ponte = require(path.join(repo, 'desktop', 'ponte.js'))(() => comune);
fs.mkdirSync(comune, { recursive: true });
const programma = { ...ponte, stato: async () => ({ versione: 'dati', cartella: comune, raggiungibile: true }), scegli: () => comune };
const srv = http.createServer((q, r) => fs.readFile(path.join(repo, decodeURIComponent(q.url.split('?')[0])), (e, d) => { if (e) { r.statusCode = 404; return r.end(); } r.setHeader('Content-Type', 'text/html; charset=utf-8'); r.end(d); })).listen(8141);

// i casi: una stadiazione e, per alcuni, la ristadiazione dopo terapia
const CASI = [
  { data: '12012026', acc: 'A118204', ct: 'cT3b', cn: 'cN0', emvi: '1', pareti: ['Posteriore'], ris: { data: '20042026', acc: 'A151377', risposta: 'near-cCR', yct: '' } },
  { data: '03022026', acc: 'A123456', ct: 'cT3c', cn: 'cN+', emvi: '3', pareti: ['Anteriore', 'Laterale destra'], ris: { data: '18052026', acc: 'A160021', risposta: 'minore', yct: 'ycT3ab' } },
  { data: '27022026', acc: 'A130915', ct: 'cT2', cn: 'cN0', emvi: '0', pareti: ['Laterale sinistra'] },
  { data: '16032026', acc: 'A139002', ct: 'cT4a', cn: 'cN+', emvi: '4', pareti: ['Anteriore'], ris: { data: '30062026', acc: 'A168450', risposta: 'maggiore', yct: 'ycT4a' } },
  { data: '09042026', acc: 'A147730', ct: 'cT1', cn: 'cN0', emvi: '0', pareti: ['Posteriore'] },
  { data: '21052026', acc: 'A158112', ct: 'cT3a', cn: 'possibile', emvi: '2', pareti: ['Anteriore', 'Posteriore'] },
  { data: '14072026', acc: 'A171045', ct: 'cT3d', cn: 'cN+', emvi: '3', pareti: ['Laterale destra'], ris: { data: '05102026', acc: 'A195120', risposta: 'cCR', yct: '' } },
  { data: '02092026', acc: 'A186620', ct: 'cT2', cn: 'cN0', emvi: '1', pareti: ['Posteriore'] },
  { data: '28092026', acc: 'A192318', ct: 'cT3c', cn: 'cN+', emvi: '3', pareti: ['Anteriore', 'Laterale sinistra'] },
  { data: '06102026', acc: 'A195544', ct: 'cT3b', cn: 'cN0', emvi: '2', pareti: ['Laterale destra'] }
];

(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await c.exposeBinding('__ponte', async (_, f, ...a) => programma[f](...a));
  await c.addInitScript(([n, cg, t]) => {
    window.EsgarDesktop = Object.fromEntries(['stato', 'scegli', 'scrivi', 'leggi', 'elenca', 'esiste', 'tipo', 'creaCartella', 'rinomina'].map((f) => [f, (...a) => window.__ponte(f, ...a)]));
    localStorage.setItem('structurad.esgar.sessione', JSON.stringify({ profilo: { id: 'op-dimostrazion', nome: n, cognome: cg, titolo: t }, dispositivo: 'dimostrazione', codice: '', dal: Date.now(), scade: Date.now() + 3600e3 }));
  }, [nome, cognome, titolo]);
  const p = await c.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8141/index.html?nointro'); await p.waitForTimeout(600);
  const spunta = async (testo, si) => { const l = p.locator('#panel-primaria label', { hasText: new RegExp('^\\s*' + testo + '\\s*$') }).first(); const i = l.locator('input[type=checkbox]'); if (await i.count() && (await i.isChecked()) !== si) await l.click(); };
  const salva = async (acc, data) => {
    await p.fill('#arcAccesso', acc); await p.fill('#arcData', data); await p.click('#arcAccesso');
    await p.click('#btnSalva');
    await p.waitForFunction(() => /Salvato|non riuscito/.test(document.getElementById('archivioStato').textContent), null, { timeout: 8000 });
    const s = await p.textContent('#archivioStato');
    if (!/^Salvato/.test(s)) throw new Error(s);
    await p.waitForTimeout(150);
  };
  let n = 0;
  for (const k of CASI) {
    if (await p.isVisible('#btnNuovoCaso')) await p.click('#btnNuovoCaso');
    for (const w of ['Anteriore', 'Posteriore', 'Laterale destra', 'Laterale sinistra']) await spunta(w, k.pareti.includes(w));
    await p.click(`input[name=p_ct][value="${k.ct}"]`);
    await p.click(`input[name="p_cn"][value="${k.cn}"]`);
    await p.selectOption('#p_emviGrade', k.emvi);
    await salva(k.acc, k.data); n++;
    if (k.ris) {
      await p.click('#btnNuovoCaso');
      await p.click('#btnModeRistad'); await p.waitForTimeout(300);
      await p.click(`input[name=r_risposta][value="${k.ris.risposta}"]`);
      if (k.ris.yct) await p.click(`input[name=r_yct][value="${k.ris.yct}"]`);
      await p.click('#btnCerca'); await p.waitForSelector('#cercaPannello.aperto .cerca-caso', { timeout: 8000 });
      await p.fill('#cercaQ', k.acc); await p.waitForTimeout(150);
      await p.click('#cercaPannello [data-associa="0"]');
      await salva(k.ris.acc, k.ris.data); n++;
      await p.click('#btnModePrimaria'); await p.waitForTimeout(300);
    }
  }
  await p.waitForTimeout(1500);       // la memoria del medico finisce nel suo file
  fs.writeFileSync(path.join(__dirname, 'dati', 'medico.json'), JSON.stringify({ nome, cognome, titolo }, null, 2) + '\n');
  console.log(`referti salvati: ${n} per ${cognome} ${nome} · errori: ${errs.join(' | ') || 'nessuno'}`);
  await b.close(); srv.close();
})().catch((e) => { console.log('ERRORE: ' + e.message); process.exit(1); });
