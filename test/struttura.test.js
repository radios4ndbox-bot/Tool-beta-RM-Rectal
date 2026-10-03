// Il tool impara dalla struttura del referto finito, a ogni «Scarica .txt»:
// frasi aggiunte a mano e frasi generate riscritte; poi le propone.
// Uso: npm i playwright && node test/struttura.test.js [cartella-screenshot]
const path = require('path');
const { chromium } = require('playwright');
const URL = 'file://' + path.join(__dirname, '..', 'index.html') + '?nointro';
const SHOTS = process.argv[2] || require('os').tmpdir();
const check = (cond, msg) => { console.log((cond ? 'OK  ' : 'FAIL') + ' ' + msg); if (!cond) process.exitCode = 1; };
const AGGIUNTA = 'Fascia mesorettale ben riconoscibile su tutta la circonferenza.';
const RISCRITTA = '- fascia mesorettale indenne';

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(URL); await p.waitForTimeout(300);
  const out = () => p.inputValue('#output');
  const scarica = async () => { await Promise.all([p.waitForEvent('download'), p.click('#btnDownload')]); await p.waitForTimeout(150); };

  // un referto scaricato senza modifiche non insegna niente
  await scarica();
  check(await p.evaluate(() => EsgarMemoria.gestione.sezioniStruttura().length === 0), 'referto non modificato: niente da imparare');

  // due referti con la stessa aggiunta e la stessa riformulazione in MRF
  for (const est of ['4', '6']) {
    await p.fill('#p_estensione', est);
    await p.evaluate(([agg, ris]) => {
      const o = document.getElementById('output');
      o.value = o.value.replace('MRF:\n- non coinvolta', 'MRF:\n' + ris + '\n' + agg);
    }, [AGGIUNTA, RISCRITTA]);
    await scarica();
  }
  const g = await p.evaluate(() => ({ voci: EsgarMemoria.gestione.voci('ref:primaria:mrf'), sos: EsgarMemoria.gestione.sostituzioni('primaria', 'mrf') }));
  check(g.voci.length === 1 && g.voci[0].testo === AGGIUNTA && g.voci[0].n === 2, 'impara la frase aggiunta in MRF (2 volte)');
  check(g.sos.length === 1 && g.sos[0].gen === '- non coinvolta' && g.sos[0].alt === RISCRITTA && g.sos[0].volte === 2, 'impara la riformulazione di «- non coinvolta»');
  await scarica();
  check((await p.evaluate(() => EsgarMemoria.gestione.voci('ref:primaria:mrf')))[0].n === 2, 'lo stesso referto scaricato due volte conta una');

  // anche un salvataggio riuscito nell'archivio insegna
  await p.fill('#p_estensione', '8');
  await p.evaluate(() => { const o = document.getElementById('output'); o.value = o.value.replace('METASTASI PELVICHE:', 'METASTASI PELVICHE:\nNon versamento libero nello scavo pelvico.'); });
  await p.evaluate(() => document.dispatchEvent(new CustomEvent('esgar:referto-salvato')));
  check((await p.evaluate(() => EsgarMemoria.gestione.voci('ref:primaria:meta'))).some((v) => /versamento/.test(v.testo)), 'anche «Salva nell\'archivio» insegna (frase aggiunta in Metastasi pelviche)');

  // nuovo referto: le proposte compaiono sopra il referto
  await p.reload(); await p.waitForTimeout(500);
  check(await p.isVisible('#proposteRef') && await p.locator('#proposteRef .pr-voce').count() === 2, 'riaprendo: due proposte sopra il referto');
  await p.screenshot({ path: SHOTS + '/struttura_proposte.png', clip: { x: 740, y: 60, width: 700, height: 560 } });
  await p.click('#proposteRef .pr-voce:has-text("indenne") button.btn-secondary');
  check((await out()).includes('MRF:\n' + RISCRITTA) && !(await out()).includes('- non coinvolta'), 'Sostituisci: riscrive la frase generata');
  await p.click('#proposteRef .pr-voce:has-text("riconoscibile") button.btn-secondary');
  const o = await out();
  const mrf = o.slice(o.indexOf('MRF:'), o.indexOf('LINFONODI SOSPETTI:'));
  check(mrf.includes(AGGIUNTA), 'Aggiungi: inserisce la frase nella sezione MRF');
  check(await p.isHidden('#proposteRef'), 'applicate, le proposte spariscono');
  // la × nasconde una proposta per questo referto
  await p.click('#btnGenerate'); await p.waitForTimeout(400);
  const prima = await p.locator('#proposteRef .pr-voce').count();
  await p.click('#proposteRef .pr-x >> nth=0'); await p.waitForTimeout(100);
  check(await p.locator('#proposteRef .pr-voce').count() === prima - 1, '× nasconde la proposta');

  // la pagina Memoria mostra la struttura imparata
  await p.click('#railMemoria'); await p.waitForTimeout(400);
  check(/Struttura del referto/.test(await p.textContent('#mgNav')), 'Memoria: gruppo «Struttura del referto»');
  await p.click('#mgNav [data-campo="ref:primaria:mrf"]'); await p.waitForTimeout(300);
  check(/riconoscibile/.test(await p.textContent('#mgLista')) && /al posto di «- non coinvolta»/.test(await p.textContent('#mgSost')), 'sezione MRF: aggiunta e riformulazione');
  await p.screenshot({ path: SHOTS + '/struttura_memoria.png' });
  p.once('dialog', (d) => d.accept());
  await p.click('#mgSost [data-mg=elimina-sost]'); await p.waitForTimeout(150);
  check(await p.evaluate(() => EsgarMemoria.gestione.sostituzioni('primaria', 'mrf').length === 0), 'la riformulazione si può dimenticare');
  check(errs.length === 0, 'nessun errore JS ' + errs.join(' | '));
  await b.close();
})();
