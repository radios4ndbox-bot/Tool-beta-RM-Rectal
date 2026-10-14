// Menu a tendina, calendario in gg/mm/aaaa e memoria dei campi liberi.
// Uso: npm i playwright && node test/interfaccia.test.js [cartella-screenshot]
const path = require('path');
const { chromium } = require('playwright');
const URL = 'file://' + path.join(__dirname, '..', 'index.html') + '?nointro';
const SHOTS = process.argv[2] || require('os').tmpdir();
const check = (cond, msg) => { console.log((cond ? 'OK  ' : 'FAIL') + ' ' + msg); if (!cond) process.exitCode = 1; };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(URL); await p.waitForTimeout(300);
  const out = () => p.inputValue('#output');
  const trigger = (id) => `.sel-wrap:has(#${id}) .sel-trigger`;

  // ── menu a tendina ──
  check(await p.evaluate(() => document.querySelectorAll('#form-pane select').length === document.querySelectorAll('#form-pane .sel-wrap select').length), 'tutti i select del form hanno il menu del tool');
  await p.click(trigger('p_lnOttLato'));
  check(await p.isVisible('.sel-wrap.aperto .sel-opzioni'), 'il menu si apre');
  await p.screenshot({ path: SHOTS + '/ui_tendina.png' });
  await p.click('.sel-wrap.aperto .sel-opzione:has-text("Sinistro")');
  check(await p.inputValue('#p_lnOttLato') === 'sinistro' && /otturatori \(lato: sinistro\)/.test(await out()), 'la scelta arriva al select e al referto');
  check(await p.textContent(trigger('p_lnOttLato') + ' .sel-valore') === 'Sinistro', 'il menu mostra la scelta');
  await p.focus(trigger('p_nrIngLato'));
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter');
  const lato = await p.inputValue('#p_nrIngLato');
  check(/^(destro|sinistro)$/.test(lato) && new RegExp('inguinali[^\\n]*lato: ' + lato).test(await out()), 'da tastiera: frecce e Invio (' + lato + ')');

  // ── calendario: la data d'esame ──
  await p.fill('#arcData', ''); await p.click('#arcData');
  check(await p.isVisible('#calPanel.open'), 'il calendario si apre');
  await p.screenshot({ path: SHOTS + '/ui_calendario.png' });
  await p.click('#calPanel .cal-day:not(.fuori) >> text="15"');
  const d = await p.inputValue('#arcData');
  check(/^15\/\d{2}\/\d{4}$/.test(d), 'data in gg/mm/aaaa: ' + d);
  await p.fill('#arcData', ''); await p.type('#arcData', '05032026'); await p.click('#p_lunghezza');
  check(await p.inputValue('#arcData') === '05/03/2026', 'digitando le cifre le barre le mette il campo');

  // ── info dei cT ──
  check(await p.locator('.ct-info-btn').count() === 5, 'un pulsante info per ognuna delle 5 voci cT del modello ESGAR');
  await p.evaluate(() => document.querySelector('.ct-info-btn[data-ct=cT4a]').scrollIntoView({ block: 'center' }));
  const ctPrima = await p.evaluate(() => (document.querySelector('input[name=p_ct]:checked') || {}).value);
  await p.click('.ct-info-btn[data-ct=cT4a]'); await p.waitForTimeout(400);
  check(await p.isVisible('#ctInfo.aperta') && /riflessione peritoneale/.test(await p.textContent('#ctInfo')) && /ESGAR/.test(await p.textContent('#ctInfo .ct-info-fonte')), 'la finestra spiega cT4a e dice la fonte');
  check(await p.evaluate(() => (document.querySelector('input[name=p_ct]:checked') || {}).value) === ctPrima, 'aprire l\'info non cambia lo stadio scelto');
  await p.keyboard.press('Escape');
  check(!(await p.isVisible('#ctInfo.aperta')), 'Esc chiude la finestra');


  // ── impostazioni ──
  await p.click('.rail-btn[data-pan=info]'); await p.waitForTimeout(700);
  check(await p.isVisible('#railPannello.aperto .pan[data-pan=info]') && await p.evaluate(() => document.body.classList.contains('rail-aperto')), 'Info apre il pannello e la pagina rientra');
  const info = await p.textContent('.pan[data-pan=info]');
  check(/cT3c/.test(info) && /5–15 mm/.test(info) && /near-cCR/.test(info) && /EMVI/.test(info) && /≥9 mm/.test(info) && /cT3 MRF+|cT3cd/.test(info) && /4592/.test(info), 'Info spiega cT, EMVI, linfonodi e risposta');
  await p.screenshot({ path: SHOTS + '/imp_info.png' });
  await p.click('.rail-btn[data-pan=archivio]'); await p.waitForTimeout(500);
  check(/testo ufficiale ESGAR/.test(await p.textContent('#impMemoria')), 'Archivio: quante frasi tue e quante voci ufficiali: ' + (await p.textContent('#impMemoria')).slice(0, 70));
  await p.screenshot({ path: SHOTS + '/imp_archivio.png' });
  await p.click('[data-imp=azzera]'); await p.click('#dialogo.open [data-dialogo=si]'); await p.waitForTimeout(200);
  check(await p.evaluate(() => EsgarFrasi.mie().length === 0), '«Tutte al testo ufficiale»');
  await p.click('.rail-btn[data-pan=aspetto]'); await p.waitForTimeout(500);
  await p.click('[data-pref=dense]');
  check(await p.evaluate(() => document.body.classList.contains('dense')) && await p.getAttribute('[data-pref=dense]', 'aria-checked') === 'true', 'Form compatto si attiva');
  await p.screenshot({ path: SHOTS + '/imp_aspetto.png' });
  await p.click('.rail-btn[data-pan=aspetto]'); await p.waitForTimeout(600);
  check(!(await p.evaluate(() => document.body.classList.contains('rail-aperto'))), 'un secondo clic chiude il pannello');
  await p.click('.rail-btn[data-pan=aspetto]'); await p.click('[data-pref=skipIntro]');
  await p.goto(URL.replace('?nointro', '')); await p.waitForTimeout(500);
  check(await p.evaluate(() => !document.getElementById('splashScreen') && document.body.classList.contains('dense')), 'alla riapertura: niente intro, form compatto ricordato');
  // ── il cancello: senza ?nointro la prima cosa è l'accesso con il telefono ──
  await p.route('**/ntfy.sh/**', (r) => r.abort());          // il relay vero non si tocca
  await p.reload(); await p.waitForTimeout(600);
  check(await p.isVisible('#cancello') && await p.locator('#cancello #ppFuori').count() === 1 &&await p.evaluate(() => document.getElementById('viewsPort').inert), 'all\'avvio, senza sessione: il cancello chiede l\'accesso e il tool dietro è fermo');
  await p.click('#cancelloSenza'); await p.waitForTimeout(200);
  check(!(await p.isVisible('#cancello')) && await p.evaluate(() => !document.getElementById('viewsPort').inert && !!document.querySelector('#pannelloProfilo #ppFuori')), '«Continua senza accesso»: il tool si apre, e l\'accesso torna nel profilo');
  await p.click('#railStile'); await p.waitForTimeout(400);
  check(await p.isVisible('#stOverlay.open') && /accedi con il telefono/i.test(await p.textContent('#stFuori')) && await p.isHidden('#stFoglio') && await p.isHidden('#stSalva'), 'senza accesso lo Stile personale non si imposta');
  await p.keyboard.press('Escape');
  await p.reload(); await p.waitForTimeout(500);
  check(!(await p.isVisible('#cancello')), 'nella stessa scheda il cancello non torna');
  check(errs.length === 0, 'nessun errore JS ' + errs.join(' | '));
  await b.close();
})();
