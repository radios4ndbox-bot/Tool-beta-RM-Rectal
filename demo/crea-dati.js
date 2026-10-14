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

// la memoria di esempio. campi: valori dei campi liberi del form, «letti» volte
// volte con le scelte indicate; struttura: frasi aggiunte nel referto (aggiunte)
// e frasi del tool riscritte (sost); preferite: quelle con la stella.
const P = 'primaria', R = 'ristad';
const MEMORIA = {
  campi: [
    { modo: P, volte: 6, campi: { p_premedicazione: 'Buscopan 20 mg e.v.' } },
    { modo: P, volte: 2, campi: { p_premedicazione: 'Glucagone 1 mg i.m.' } },
    { modo: P, volte: 4, scelte: ['input[name=p_mrf][value=si]'], campi: { p_mrfSede: 'ore 3-5', p_emviDett: 'vena rettale superiore', p_emviSerie: 'serie 5, immagine 22' } },
    { modo: P, volte: 2, scelte: ['input[name=p_mrf][value=si]'], campi: { p_mrfSede: 'ore 11-1', p_emviDett: 'vene rettali medie di destra' } },
    { modo: P, volte: 3, scelte: ['input[name=p_ct][value=cT4b]'], campi: { p_ctNote: 'infiltrazione del muscolo elevatore dell\'ano di sinistra', p_organiDett: 'versante posteriore della prostata' } },
    { modo: P, volte: 2, scelte: ['input[name=p_ct][value=cT4b]'], campi: { p_ctNote: 'infiltrazione della capsula prostatica', p_organiDett: 'parete posteriore della vagina' } },
    { modo: P, volte: 4, campi: { p_lnLivello: 'lungo i vasi presacrali, livello S2' } },
    { modo: P, volte: 2, campi: { p_lnLivello: 'all\'origine dell\'arteria rettale superiore', p_peritDett: 'nodulo di 6 mm nello scavo del Douglas' } },
    { modo: P, volte: 3, scelte: ['#p_tdAdd'], campi: { '#p_td_container input[data-f=sede]': 'mesoretto posteriore, a ore 6' } },
    { modo: P, volte: 2, campi: { '#p_td_container input[data-f=sede]': 'lungo i vasi rettali superiori' } },
    { modo: R, volte: 5, campi: { r_premedicazione: 'Buscopan 20 mg e.v.', r_metaConfronto: 'invariate rispetto al basale' } },
    { modo: R, volte: 3, campi: { r_mrfSede: 'ore 3-5', r_mrfSerie: 'serie 4, immagine 18', r_emviDove: 'vena rettale superiore, ridotta di calibro' } },
    { modo: R, volte: 3, campi: { r_lnMesoSede: 'mesoretto posteriore, a ore 6', r_lnLatSede: 'otturatorio di sinistra', r_tdDett: 'un deposito di 5 mm' } },
    { modo: R, volte: 2, campi: { r_sfintDett: 'sfintere interno, quadrante posteriore', r_yctDett: 'muscolo elevatore dell\'ano di sinistra', r_metaConfronto: 'ridotte di numero', r_lnNonRegSede: 'iliaco comune destro', r_metaDett: 'linfonodo iliaco comune destro di 8 mm' } }
  ],
  struttura: [
    { modo: P, volte: 5, aggiunte: [{ sez: 'intro', testo: 'Esame di buona qualità tecnica, senza artefatti da movimento.' }, { sez: 'stagefinale', testo: 'Si consiglia discussione multidisciplinare.' }] },
    { modo: P, volte: 4, aggiunte: [{ sez: 'mrf', testo: 'Piano adiposo di clivaggio ben riconoscibile.' }, { sez: 'linfonodi', testo: 'Non adenopatie lungo le catene iliache esterne.' }],
      sost: [{ sez: 'mrf', gen: '- non coinvolta', alt: '- libera, con piano adiposo conservato' }] },
    { modo: P, volte: 3, aggiunte: [{ sez: 'morfologia', testo: 'Lesione a crescita prevalentemente vegetante.' }, { sez: 'organi', testo: 'Non segni di infiltrazione degli organi adiacenti.' }, { sez: 'meta', testo: 'Non versamento libero nello scavo pelvico.' }],
      sost: [{ sez: 'linfonodi', gen: '- non presenti', alt: '- non linfonodi con caratteri di sospetto' }] },
    { modo: P, volte: 2, aggiunte: [{ sez: 'localizzazione', testo: 'Margine inferiore al di sopra della riflessione peritoneale anteriore.' }, { sez: 'emvi', testo: 'Vasi mesorettali di calibro regolare.' }, { sez: 'morfologia', testo: 'Lesione ulcerata a margini rilevati.' }] },
    { modo: P, volte: 3, aggiunte: [{ sez: 'ct', testo: 'Estensione extramurale misurata sul piano assiale obliquo.' }, { sez: 'td', testo: 'Non depositi tumorali nel mesoretto.' }] },
    { modo: R, volte: 2, aggiunte: [{ sez: 'td', testo: 'Non depositi tumorali residui nel mesoretto.' }, { sez: 'linfonodi', testo: 'Non linfonodi laterali sospetti.' }] },
    { modo: R, volte: 4, aggiunte: [{ sez: 'intro', testo: 'Confronto con la RM di stadiazione.' }, { sez: 'statolocale', testo: 'Fibrosi a basso segnale in T2 nella sede della pregressa lesione.' }, { sez: 'stagefinale', testo: 'Quadro compatibile con buona risposta al trattamento.' }] },
    { modo: R, volte: 3, aggiunte: [{ sez: 'ycmrf', testo: 'Ricomparsa del piano adiposo fra fibrosi e fascia.' }, { sez: 'linfonodi', testo: 'Linfonodi mesorettali ridotti di numero e dimensioni.' }] },
    { modo: R, volte: 2, aggiunte: [{ sez: 'emvisfint', testo: 'Complesso sfinterico indenne.' }, { sez: 'meta', testo: 'Non nuove localizzazioni pelviche.' }, { sez: 'stagefinale', testo: 'Si consiglia rivalutazione endoscopica.' }] }
  ],
  preferite: [['p_premedicazione', 'Buscopan 20 mg e.v.'], ['ref:primaria:stagefinale', 'Si consiglia discussione multidisciplinare.'], ['ref:ristad:statolocale', 'Fibrosi a basso segnale in T2 nella sede della pregressa lesione.']]
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
  // ── la memoria di esempio: frasi già imparate in gran parte dei passi ──
  // Si insegnano come le imparerebbe il tool: i campi liberi compilando il
  // form e «leggendo» il referto più volte, le frasi del referto e le
  // riformulazioni con la stessa funzione che usa quando il medico corregge
  // il testo. Così hanno usi, date e contesto, non sono «insegnate a mano».
  const frasi = await p.evaluate(async (m) => {
    const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
    const out = document.getElementById('output');
    // un campo si indica con il suo id, o con un selettore se sta in una riga aggiunta (tumor deposit)
    const scrivi = (id, t) => { const e = document.getElementById(id) || document.querySelector(id); e.value = t; e.dispatchEvent(new Event('input', { bubbles: true })); };
    const letti = (EsgarMemoria.stato().visti || []).length;
    let lettura = 0;
    for (const g of m.campi) {
      document.getElementById(g.modo === 'ristad' ? 'btnModeRistad' : 'btnModePrimaria').click(); await pausa(250);
      (g.scelte || []).forEach((s) => { const e = document.querySelector(s); if (e && !e.checked) e.click(); });
      Object.entries(g.campi).forEach(([id, t]) => scrivi(id, t));
      await pausa(60);
      // ogni volta un referto «diverso»: il tool non impara due volte dallo stesso testo, e non tutti
      // i campi cambiano il referto (alcuni compaiono solo con la loro voce spuntata)
      for (let i = 0; i < g.volte; i++) { out.value += '\n' + (++lettura); EsgarMemoria.impara(); }
      Object.keys(g.campi).forEach((id) => scrivi(id, ''));
    }
    // i referti letti restano quelli salvati davvero
    const stato = EsgarMemoria.stato(); stato.visti = stato.visti.slice(0, letti);
    for (const s of m.struttura) for (let i = 0; i < s.volte; i++) EsgarMemoria.gestione.imparaStruttura(s.modo, s.aggiunte || [], s.sost || []);
    m.preferite.forEach(([k, testo]) => { const v = EsgarMemoria.gestione.voci(k).find((x) => x.testo === testo); if (v) EsgarMemoria.gestione.fissa(k, v.chiave, true); });
    return EsgarMemoria.gestione.campi().reduce((a, c) => a + c.voci, 0);
  }, MEMORIA);
  console.log('frasi nella memoria di esempio: ' + frasi);
  await p.waitForTimeout(1800);       // la memoria del medico finisce nel suo file
  fs.writeFileSync(path.join(__dirname, 'dati', 'medico.json'), JSON.stringify({ nome, cognome, titolo }, null, 2) + '\n');
  console.log(`referti salvati: ${n} per ${cognome} ${nome} · errori: ${errs.join(' | ') || 'nessuno'}`);
  await b.close(); srv.close();
})().catch((e) => { console.log('ERRORE: ' + e.message); process.exit(1); });
