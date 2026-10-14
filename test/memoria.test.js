// La Memoria: le frasi del medico, voce per voce. A sinistra la voce del modulo, a destra la
// riga del referto: il medico la riscrive, salva, e da allora il referto usa la sua frase.
// Uso: npm i playwright && node test/memoria.test.js [cartella-screenshot]
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright');
const URL = 'file://' + path.join(__dirname, '..', 'index.html') + '?nointro';
const SHOTS = process.argv[2] || require('os').tmpdir();
const check = (cond, msg) => { console.log((cond ? 'OK  ' : 'FAIL') + ' ' + msg); if (!cond) process.exitCode = 1; };

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(URL); await p.waitForTimeout(400);
  const out = () => p.inputValue('#output');
  const riga = (k) => `.fr-riga[data-voce="${k}"]`;

  // ── la mappa ──
  await p.click('input[name=p_mrf][value=si]'); await p.click('.p-mrf[value=EMVI]'); await p.fill('#p_mrfOre', '7-9'); await p.waitForTimeout(200);
  await p.click('#railMemoria'); await p.waitForTimeout(600);
  check(await p.isVisible('#mgOverlay.open') && await p.locator('#mpMappa .mp-nodo').count() === 10 && /0<\/b> frasi tue/.test(await p.innerHTML('#mgCorpo')), 'la Memoria si apre sulla mappa: dieci passi, nessuna frase tua');
  await p.screenshot({ path: SHOTS + '/memoria_mappa.png' });

  // ── un passo: la sezione a sinistra, la riga del referto a destra ──
  await p.click('.mp-nodo[data-sez=mrf]'); await p.waitForTimeout(700);
  check(await p.locator('.fr-riga').count() === 3 && await p.textContent(riga('p.mrf.no') + ' .fr-opt') === 'No' && await p.inputValue(riga('p.mrf.no') + ' .fr-testo') === '- coinvolgimento della MRF (margine ≤1 mm): no',
    'il passo MRF: a sinistra le voci del modulo, a destra la riga ufficiale del referto');
  check(/sì, da parte di: tumore primitivo/.test(await p.textContent(riga('p.mrf.si') + ' .fr-ante')), 'sotto, come verrà nel referto con dati d\'esempio');
  await p.fill(riga('p.mrf.si') + ' .fr-testo', '- fascia mesorettale coinvolta (margine ≤1 mm)[cause]');
  check(await p.isVisible(riga('p.mrf.si') + ' [data-fr=salva]') && /fascia mesorettale coinvolta \(margine ≤1 mm\), da parte di: tumore primitivo/.test(await p.textContent(riga('p.mrf.si') + ' .fr-ante')),
    'mentre scrivi l\'anteprima segue, e compare «Salva»');
  check(/coinvolgimento della MRF \(margine ≤1 mm\): sì/.test(await out()), 'finché non salvi il referto non cambia');
  await p.screenshot({ path: SHOTS + '/memoria_passo.png' });
  await p.press(riga('p.mrf.si') + ' .fr-testo', 'Enter'); await p.waitForTimeout(250);
  check(/^- fascia mesorettale coinvolta \(margine ≤1 mm\), da parte di: EMVI$/m.test(await out()) && await p.locator(riga('p.mrf.si') + '.mia').count() === 1,
    'Invio salva: il referto usa subito la tua frase, con i dati del modulo');
  check(/Ufficiale ESGAR/.test(await p.textContent(riga('p.mrf.si'))) && await p.isVisible(riga('p.mrf.si') + ' [data-fr=ufficiale]'), 'accanto resta il testo ufficiale, con «Ufficiale»');

  // il dato non si può togliere né inventare
  await p.fill(riga('p.mrfOre') + ' .fr-testo', '- sede: ore');
  check(/Tieni \[ore\]/.test(await p.textContent(riga('p.mrfOre') + ' .fr-errore')), 'senza il segnaposto del dato lo dice subito');
  await p.click(riga('p.mrfOre') + ' [data-fr=salva]'); await p.waitForTimeout(150);
  check(await p.evaluate(() => !EsgarFrasi.frase('p.mrfOre')), 'e non la salva');
  await p.fill(riga('p.mrfOre') + ' .fr-testo', '- sede del coinvolgimento: ore [ore] [lato]');
  check(/\[lato\] non è un dato di questa voce/.test(await p.textContent(riga('p.mrfOre') + ' .fr-errore')), 'un segnaposto inventato non vale');
  // i segnaposto si inseriscono con un clic
  await p.fill(riga('p.mrfOre') + ' .fr-testo', 'Coinvolgimento a ore ');
  await p.click(riga('p.mrfOre') + ' [data-fr=dato]'); await p.click(riga('p.mrfOre') + ' [data-fr=salva]'); await p.waitForTimeout(200);
  check(/^Coinvolgimento a ore 7-9$/m.test(await out()), 'il segnaposto entra con un clic, e la frase salvata va nel referto');
  // Annulla
  await p.fill(riga('p.mrf.no') + ' .fr-testo', 'qualcosa'); await p.click(riga('p.mrf.no') + ' [data-fr=annulla]');
  check(await p.inputValue(riga('p.mrf.no') + ' .fr-testo') === '- coinvolgimento della MRF (margine ≤1 mm): no', 'Annulla riporta la riga com\'era');

  // ── una correzione a mano nel referto resta quando la frase cambia ──
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await p.evaluate(() => { const o = document.getElementById('output'); o.value = o.value.replace('Coinvolgimento a ore 7-9', 'Coinvolgimento a ore 7-9\nNota a mano.'); o.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.evaluate(() => EsgarFrasi.imposta('p.mrfOre', 'Sede del coinvolgimento: ore [ore]'));
  check(/^Sede del coinvolgimento: ore 7-9\nNota a mano\.$/m.test(await out()), 'cambiando una frase, le correzioni a mano nel referto restano');
  await p.click('input[name=p_mrf][value=no]'); await p.waitForTimeout(200);
  check(/coinvolgimento della MRF \(margine ≤1 mm\): no/.test(await out()), 'le voci senza frase tua restano ufficiali');

  // ── Ufficiale, ricarica, esporta e importa ──
  await p.click('#railMemoria'); await p.waitForTimeout(500);
  check(/2<\/b> frasi tue/.test(await p.innerHTML('#mgCorpo')) && await p.locator('.mp-nodo[data-sez=mrf].attivo .mp-conta').textContent() === '2', 'sulla mappa il passo MRF conta le tue due frasi');
  await p.click('.mp-nodo[data-sez=mrf]'); await p.waitForTimeout(600);
  await p.click(riga('p.mrfOre') + ' [data-fr=ufficiale]'); await p.waitForTimeout(150);
  check(await p.evaluate(() => EsgarFrasi.mie().join()) === 'p.mrf.si', '«Ufficiale» riporta la voce al testo ESGAR');
  await p.click('[data-mappa]'); await p.waitForTimeout(500);
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-mg=esporta]')]);
  const file = await dl.path();
  check(JSON.parse(fs.readFileSync(file, 'utf8')).frasi['p.mrf.si'] === '- fascia mesorettale coinvolta (margine ≤1 mm)[cause]', 'Esporta: un file con le tue frasi');
  await p.click('[data-mg=azzera]');
  check(await p.isVisible('#dialogo.open'), 'tutte all\'ufficiale chiede conferma');
  await p.click('#dialogo.open [data-dialogo=si]'); await p.waitForTimeout(200);
  check(await p.evaluate(() => EsgarFrasi.mie().length) === 0, 'e le toglie tutte');
  await p.setInputFiles('#mgImporta', file); await p.waitForTimeout(300);
  check(await p.evaluate(() => EsgarFrasi.mie().join()) === 'p.mrf.si' && /1 frase importata/.test(await p.textContent('#mgStato')), 'Importa: le frasi tornano dal file');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  check(!(await p.isVisible('#mgOverlay.open')), 'Esc chiude la Memoria');
  await p.reload(); await p.waitForTimeout(400);
  await p.click('input[name=p_mrf][value=si]'); await p.waitForTimeout(200);
  check(/^- fascia mesorettale coinvolta \(margine ≤1 mm\)$/m.test(await out()), 'alla riapertura il referto usa ancora la tua frase');

  // ── ristadiazione: le sue voci ──
  await p.click('#btnModeRistad'); await p.waitForTimeout(300);
  await p.click('#railMemoria'); await p.waitForTimeout(500);
  check(await p.locator('#mpMappa .mp-nodo').count() === 9, 'in ristadiazione la mappa ha i suoi nove passi');
  await p.click('.mp-nodo[data-sez=residuo]'); await p.waitForTimeout(600);
  await p.fill(riga('r.risp.cCR') + ' .fr-testo', 'Risposta clinica completa (cCR)[descrizione]: non evidente tumore residuo');
  await p.press(riga('r.risp.cCR') + ' .fr-testo', 'Enter'); await p.waitForTimeout(200);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await p.click('input[name=r_risposta][value=cCR]'); await p.waitForTimeout(200);
  check(/^Risposta clinica completa \(cCR\) \(fibrosi omogenea, assenza di restrizione focale della diffusione\): non evidente tumore residuo$/m.test(await out()), 'la classe di risposta con la tua frase e la descrizione in vigore');

  check(errs.length === 0, 'nessun errore JS ' + errs.join(' | '));
  await b.close();
})();
