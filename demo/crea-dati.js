// Rigenera i referti di esempio della dimostrazione (dati/referti) con un
// altro medico: node crea-dati.js Nome Cognome [Dr.|Dr.ssa]
//
// I referti sono VERI: il form del tool (il modello ESGAR 2026) si compila in
// un browser e si preme «Salva nell'archivio», con il ponte del programma
// (desktop/ponte.js) che scrive in dati/referti. Serve Playwright nella radice
// del repository (npm i playwright). La cartella dati/referti di prima va tolta a mano.
const path = require('path'), fs = require('fs'), http = require('http');
const [nome = 'Mario', cognome = 'Rossi', titolo = 'Dr.'] = process.argv.slice(2);
const repo = path.join(__dirname, '..'), comune = path.join(__dirname, 'dati', 'referti');
if (fs.existsSync(comune)) { console.log('dati/referti esiste già: toglila o rinominala, poi rilancia.'); process.exit(1); }
const { chromium } = require(path.join(repo, 'node_modules', 'playwright'));
const ponte = require(path.join(repo, 'desktop', 'ponte.js'))(() => comune);
fs.mkdirSync(comune, { recursive: true });
const programma = { ...ponte, stato: async () => ({ versione: 'dati', cartella: comune, raggiungibile: true }), scegli: () => comune };
const srv = http.createServer((q, r) => fs.readFile(path.join(repo, decodeURIComponent(q.url.split('?')[0])), (e, d) => { if (e) { r.statusCode = 404; return r.end(); } r.setHeader('Content-Type', 'text/html; charset=utf-8'); r.end(d); })).listen(8141);

// i casi: una stadiazione e, per alcuni, la ristadiazione dopo terapia.
// radio: { nome: valore }, spunte: selettori delle caselle, testi: { id: testo }
const CASI = [
  { data: '12012026', acc: 'A118204',
    spunte: ['#p_compSolida'],
    radio: { p_forma: 'parziale', p_rifl: 'sotto', p_sto: 'retto', p_ct: 'cT3ab', p_emvi: 'no', p_sfint: 'no', p_mrf: 'no', p_lnMeso: 'no', p_lnLat: 'no', p_td: 'no', p_cn: 'cN0', p_nr: 'no' },
    testi: { p_oreDa: '3', p_oreA: '7', p_distGar: '4,5', p_lunghezza: '3,8' },
    ris: { data: '20042026', acc: 'A151377', radio: { r_risposta: 'near-cCR', r_muc: 'no', r_emvi: 'no', r_sfint: 'no', r_mrf: 'no', r_lnMeso: 'ycN0', r_lnLat: 'na', r_td: 'no', r_ycn: 'ycN0', r_nr: 'na' }, testi: { r_distGar: '4,5', r_dimFibrosi: '2,1' } } },
  { data: '03022026', acc: 'A123456',
    spunte: ['#p_compSolida'],
    radio: { p_forma: 'anulare', p_rifl: 'cavallo', p_sto: 'retto', p_ct: 'cT3cd', p_emvi: 'si', p_sfint: 'no', p_mrf: 'no', p_lnMeso: 'si', p_lnLat: 'no', p_td: 'si', p_cn: 'cN+', p_nr: 'no' },
    testi: { p_distGar: '7', p_lunghezza: '5,2', p_lnMesoNum: '3', p_lnMesoDim: '6-9', p_tdNum: '1', p_tdDim: '7' },
    ris: { data: '18052026', acc: 'A160021', radio: { r_risposta: 'minore', r_yct: 'ycT3ab', r_muc: 'no', r_emvi: 'si', r_sfint: 'no', r_mrf: 'no', r_lnMeso: 'possibile', r_lnLat: 'na', r_td: 'no', r_ycn: 'possibile', r_nr: 'na' }, testi: { r_distGar: '7', r_dimFibrosi: '3,4', r_dimResiduo: '1,2' } } },
  { data: '27022026', acc: 'A130915',
    spunte: ['#p_compSolida'],
    radio: { p_forma: 'polipoide', p_rifl: 'sopra', p_sto: 'retto', p_ct: 'cT1-2', p_emvi: 'no', p_sfint: 'no', p_mrf: 'no', p_lnMeso: 'no', p_lnLat: 'no', p_td: 'no', p_cn: 'cN0', p_nr: 'no' },
    testi: { p_distGar: '10', p_lunghezza: '2,4' } },
  { data: '16032026', acc: 'A139002',
    spunte: ['#p_compSolida', '#p_compMucinosa'],
    radio: { p_forma: 'anulare', p_rifl: 'sopra', p_sto: 'retto', p_ct: 'cT4a', p_emvi: 'si', p_sfint: 'no', p_mrf: 'no', p_lnMeso: 'si', p_lnLat: 'no', p_td: 'no', p_cn: 'cN+', p_nr: 'no' },
    testi: { p_distGar: '11', p_lunghezza: '6', p_lnMesoNum: '4', p_lnMesoDim: '5-11' },
    ris: { data: '30062026', acc: 'A168450', radio: { r_risposta: 'maggiore', r_yct: 'ycT4a', r_muc: 'trasformazione', r_emvi: 'si', r_sfint: 'no', r_mrf: 'no', r_lnMeso: 'possibile', r_lnLat: 'na', r_td: 'no', r_ycn: 'ycN+', r_nr: 'na' }, testi: { r_distGar: '11', r_dimFibrosi: '4,8', r_dimResiduo: '3,9' } } },
  { data: '09042026', acc: 'A147730',
    spunte: ['#p_compSolida'],
    radio: { p_forma: 'polipoide', p_rifl: 'sotto', p_sto: 'retto', p_ct: 'cT1-2', p_emvi: 'no', p_sfint: 'no', p_mrf: 'no', p_lnMeso: 'no', p_lnLat: 'no', p_td: 'no', p_cn: 'cN0', p_nr: 'no' },
    testi: { p_distGar: '6', p_lunghezza: '1,9' } },
  { data: '21052026', acc: 'A158112',
    radio: { p_forma: 'parziale', p_rifl: 'sotto', p_sto: 'retto', p_ct: 'cT3ab', p_emvi: 'no', p_sfint: 'si', p_mrf: 'no', p_lnMeso: 'si', p_lnLat: 'no', p_td: 'no', p_cn: 'possibile', p_nr: 'no' },
    spunte: ['#p_compMucinosa', '#p_sfintInterno'],
    testi: { p_oreDa: '5', p_oreA: '9', p_distGar: '1,5', p_lunghezza: '4,1', p_sfintDett: 'quadrante posteriore, per 15 mm', p_lnMesoNum: '1', p_lnMesoDim: '6' } },
  { data: '14072026', acc: 'A171045',
    radio: { p_forma: 'anulare', p_rifl: 'sotto', p_sto: 'retto', p_ct: 'cT3cd', p_emvi: 'si', p_sfint: 'no', p_mrf: 'si', p_lnMeso: 'si', p_lnLat: 'si', p_td: 'si', p_cn: 'cN+', p_nr: 'no' },
    spunte: ['#p_compSolida', '.p-mrf[value="tumore primitivo"]', '.p-mrf[value="EMVI"]', '#p_lnOtt'],
    testi: { p_distGar: '5', p_lunghezza: '5,6', p_mrfOre: '7-9', p_lnMesoNum: '5', p_lnMesoDim: '5-12', p_lnOttNum: '1', p_lnOttDim: '8', p_lnOttLato: 'sinistro', p_tdNum: '2', p_tdDim: '6-9' },
    ris: { data: '05102026', acc: 'A195120', radio: { r_risposta: 'cCR', r_muc: 'no', r_emvi: 'no', r_sfint: 'no', r_mrf: 'no', r_lnMeso: 'ycN0', r_lnLat: 'si', r_td: 'no', r_ycn: 'ycN0', r_nr: 'na' }, testi: { r_distGar: '5', r_dimFibrosi: '1,8', r_lnLatAttuale: '0,4', r_lnLatBasale: '0,8' } } },
  { data: '02092026', acc: 'A186620',
    spunte: ['#p_compSolida'],
    radio: { p_forma: 'parziale', p_rifl: 'sopra', p_sto: 'retto', p_ct: 'cT1-2', p_emvi: 'no', p_sfint: 'no', p_mrf: 'no', p_lnMeso: 'no', p_lnLat: 'no', p_td: 'no', p_cn: 'cN0', p_nr: 'no' },
    testi: { p_oreDa: '11', p_oreA: '2', p_distGar: '9', p_lunghezza: '2,8' } },
  { data: '28092026', acc: 'A192318',
    radio: { p_forma: 'anulare', p_rifl: 'sotto', p_sto: 'retto', p_ct: 'cT4b', p_emvi: 'si', p_sfint: 'si', p_mrf: 'si', p_lnMeso: 'si', p_lnLat: 'no', p_td: 'no', p_cn: 'cN+', p_nr: 'si' },
    spunte: ['#p_compSolida', '.p-ct4b[value="organi pelvici"]', '#p_sfintInterno', '#p_sfintInter', '.p-mrf[value="tumore primitivo"]', '#p_nrEst'],
    testi: { p_distGar: '2', p_lunghezza: '6,3', p_ct4bDett: 'versante posteriore della prostata, a sinistra', p_sfintDett: 'quadrante anteriore, per 20 mm', p_mrfOre: '11-1', p_lnMesoNum: '3', p_lnMesoDim: '7-10', p_nrEstNum: '1', p_nrEstDim: '11', p_nrEstLato: 'sinistro' } },
  { data: '06102026', acc: 'A195544',
    spunte: ['#p_compSolida'],
    radio: { p_forma: 'parziale', p_rifl: 'cavallo', p_sto: 'retto', p_ct: 'cT3ab', p_emvi: 'no', p_sfint: 'no', p_mrf: 'no', p_lnMeso: 'no', p_lnLat: 'no', p_td: 'no', p_cn: 'cN0', p_nr: 'no' },
    testi: { p_oreDa: '1', p_oreA: '5', p_distGar: '8', p_lunghezza: '3,5' } }
];

// le frasi di esempio del medico (la Memoria): alcune voci riscritte con le sue
// sfumature, in gran parte dei passi. I referti di esempio si scrivono già con queste.
const FRASI = {
  'p.comp.solida': '- tumore a composizione solida',
  'p.forma.parziale': '- crescita parzialmente anulare[ore]',
  'p.distGar': '- margine inferiore a [cm] cm dalla giunzione anorettale',
  'p.rifl.sotto': '- interamente al di sotto della riflessione peritoneale anteriore',
  'p.lunghezza': '- estensione cranio-caudale del tumore: [cm] cm',
  'p.ct.cT3cd': 'cT3cd[descrizione], con estensione extramurale misurata sul piano assiale obliquo',
  'p.emvi.no': 'No: vene mesorettali di calibro e segnale regolari',
  'p.sfint.no': 'No: complesso sfinterico indenne',
  'p.mrf.no': '- fascia mesorettale libera (margine >1 mm)',
  'p.lnLat.no': '- linfonodi regionali laterali sospetti: no (otturatori e iliaci interni nei limiti)',
  'p.cn.cN0': '- categoria cN stimata: cN0, nessun linfonodo con caratteri di sospetto',
  'p.nr.no': 'No: non linfonodi iliaci esterni, iliaci comuni o inguinali sospetti',
  'p.concl.retto': 'Neoplasia del retto: [categorie]. Si consiglia discussione multidisciplinare.',
  'r.risp.cCR': 'Risposta clinica completa (cCR)[descrizione]; fibrosi a basso segnale in T2 nella sede della pregressa lesione',
  'r.muc.no': 'No: non aree di segnale mucinoso',
  'r.emvi.no': 'No (EMVI assente al basale o scomparsa dell\'EMVI): vene mesorettali di calibro ridotto',
  'r.mrf.no': '- fascia mesorettale libera: ricomparsa del piano adiposo fra fibrosi e fascia',
  'r.concl': '[categorie]. Si consiglia rivalutazione endoscopica.'
};

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
  const apri = async () => { await p.goto('http://localhost:8141/index.html?nointro'); await p.waitForTimeout(600); };
  // compila una scheda come la compilerebbe il medico: clic sulle scelte, testo nei campi
  const compila = async (k) => {
    for (const [nome, v] of Object.entries(k.radio)) await p.click(`input[name="${nome}"][value="${v}"]`);
    for (const s of k.spunte || []) { const e = p.locator(s); if (!(await e.isChecked())) await e.click(); }
    for (const [id, t] of Object.entries(k.testi || {})) {
      if (await p.evaluate((id) => document.getElementById(id).tagName === 'SELECT', id)) await p.selectOption('#' + id, t);
      else await p.fill('#' + id, t);
    }
    await p.waitForTimeout(150);
  };
  const salva = async (acc, data) => {
    await p.fill('#arcAccesso', acc); await p.fill('#arcData', data); await p.click('#arcAccesso');
    await p.click('#btnSalva');
    await p.waitForFunction(() => /Salvato|non riuscito/.test(document.getElementById('archivioStato').textContent), null, { timeout: 8000 });
    const s = await p.textContent('#archivioStato');
    if (!/^Salvato/.test(s)) throw new Error(s);
    await p.waitForTimeout(150);
  };
  // prima le frasi del medico: i referti di esempio si scrivono già con queste
  await apri();
  const errFrasi = await p.evaluate((fr) => Object.entries(fr).map(([k, x]) => { const e = EsgarFrasi.imposta(k, x); return e && k + ': ' + e; }).filter(Boolean), FRASI);
  if (errFrasi.length) throw new Error('frasi non valide: ' + errFrasi.join(' | '));
  await p.waitForTimeout(1600);       // le frasi finiscono nel file del medico
  let n = 0;
  for (const k of CASI) {
    await apri();                                   // ogni caso parte da un form pulito
    if (await p.isVisible('#btnNuovoCaso')) await p.click('#btnNuovoCaso');
    await compila(k);
    await salva(k.acc, k.data); n++;
    if (k.ris) {
      await p.click('#btnNuovoCaso');
      await p.click('#btnModeRistad'); await p.waitForTimeout(300);
      await compila(k.ris);
      await p.click('#btnCerca'); await p.waitForSelector('#cercaPannello.aperto .cerca-caso', { timeout: 8000 });
      await p.fill('#cercaQ', k.acc); await p.waitForTimeout(150);
      await p.click('#cercaPannello [data-associa="0"]');
      await salva(k.ris.acc, k.ris.data); n++;
    }
  }
  console.log('frasi del medico: ' + Object.keys(FRASI).length);
  await p.waitForTimeout(1800);       // l'ultimo salvataggio finisce sul disco
  fs.writeFileSync(path.join(__dirname, 'dati', 'medico.json'), JSON.stringify({ nome, cognome, titolo }, null, 2) + '\n');
  console.log(`referti salvati: ${n} per ${cognome} ${nome} · errori: ${errs.join(' | ') || 'nessuno'}`);
  await b.close(); srv.close();
})().catch((e) => { console.log('ERRORE: ' + e.message); process.exit(1); });
