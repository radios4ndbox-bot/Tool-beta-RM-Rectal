// «Indietro» sopra il referto: annulla l'ultima modifica, testo e form insieme.
// Uso: npm i playwright && node test/indietro.test.js
const path = require('path');
const { chromium } = require('playwright');
const URL = 'file://' + path.join(__dirname, '..', 'index.html') + '?nointro';
const check = (cond, msg) => { console.log((cond ? 'OK  ' : 'FAIL') + ' ' + msg); if (!cond) process.exitCode = 1; };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(URL); await p.waitForTimeout(400);
  const out = () => p.inputValue('#output');
  const fermo = () => p.waitForTimeout(750);          // una modifica è finita quando il form sta fermo
  const indietro = async () => { await p.click('#btnIndietro'); await p.waitForTimeout(250); };
  const passi = () => p.evaluate(() => EsgarIndietro.passi());

  check(await p.isDisabled('#btnIndietro') && await passi() === 0, 'all\'inizio non c\'è niente da annullare');
  const iniziale = await out();

  // ── una scelta nel form ──
  await p.click('input[name=p_ct][value=cT3cd]'); await fermo();
  check(/cT3cd/.test(await out()) && await p.isEnabled('#btnIndietro') && await passi() === 1, 'una scelta nel form è un passo');
  await p.click('input[name=p_ct][value="cT1-2"]'); await fermo();
  check(/cT1-2/.test(await out()) && await passi() === 2, 'una seconda scelta, un secondo passo');
  await indietro();
  check(/cT3cd/.test(await out()) && !/cT1-2/.test(await out()) && await p.isChecked('input[name=p_ct][value=cT3cd]'), 'Indietro: tornano insieme il testo e la scelta nel form (cT3cd)');
  await indietro();
  check(await out() === iniziale && !(await p.evaluate(() => !!document.querySelector('input[name=p_ct]:checked'))) && await p.isDisabled('#btnIndietro'),
    'ancora Indietro: referto e form come all\'inizio, e il pulsante si spegne');

  // ── menu a tendina, caselle, data ──
  await p.selectOption('#p_lnOttLato', 'destro'); await fermo();
  await p.click('.p-mrf[value=EMVI]'); await fermo();
  check(/otturatori \(lato: destro\)/.test(await out()) && /da parte di: EMVI/.test(await out()), 'menu e casella cambiano il referto (e segnano da soli «Sì»)');
  await indietro(); await indietro();
  check(await out() === iniziale && await p.inputValue('#p_lnOttLato') === '' && !(await p.isChecked('.p-mrf[value=EMVI]')) && await p.isChecked('input[name=p_lnLat][value=no]')
    && /—/.test(await p.textContent('.sel-wrap:has(#p_lnOttLato) .sel-valore')), 'Indietro rimette menu (anche a schermo), casella e il «No»');

  // ── una correzione a mano, poi «Rigenera tutto» per sbaglio ──
  await p.click('input[name=p_ct][value=cT3cd]'); await fermo();
  // dentro la sezione del cT
  await p.evaluate(() => { const o = document.getElementById('output'), i = o.value.indexOf('\n', o.value.indexOf('cT3cd')); o.focus(); o.setSelectionRange(i, i); });
  await p.keyboard.type(' Nota scritta a mano.'); await fermo();
  check(/Nota scritta a mano\./.test(await out()), 'il medico aggiunge una frase a mano');
  const conNota = await out(), prima = await passi();
  check(prima === 2, 'le battute scritte di seguito contano come un passo solo');
  await p.click('#btnGenerate'); await fermo();
  check(!/Nota scritta a mano/.test(await out()), '«Rigenera tutto» cancella la frase scritta a mano');
  await indietro();
  check(await out() === conNota, 'Indietro la riporta');
  await p.click('input[name=p_emvi][value=si]'); await fermo();
  check(/Nota scritta a mano\./.test(await out()) && /EMVI\+/.test(await out()), 'e resta una correzione a mano: un\'altra scelta nel form non la cancella');
  await indietro(); await indietro();
  check(!/Nota scritta a mano/.test(await out()) && /cT3cd/.test(await out()), 'due passi indietro: via l\'EMVI e la frase, resta il cT3cd');

  // ── un dettaglio scritto segna da solo «Sì»; Indietro toglie l'uno e l'altro ──
  await p.fill('#p_tdNum', '2'); await fermo();
  check(await p.isChecked('input[name=p_td][value=si]') && /depositi tumorali: sì \(numero: 2\)/.test(await out()), 'scrivendo il numero dei depositi tumorali la voce passa a «Sì»');
  await p.fill('#p_tdDim', '6'); await fermo();
  check(/numero: 2, dimensioni: 6 mm|numero: 2[^\n]*6 mm/.test(await out()), 'e le dimensioni si aggiungono');
  await indietro(); await indietro();
  check(await p.inputValue('#p_tdNum') === '' && await p.isChecked('input[name=p_td][value=no]') && /depositi tumorali: no/.test(await out()), 'Indietro: via il numero e torna il «No»');

  // ── ogni modalità ha i suoi passi ──
  const passiPrimaria = await passi();
  await p.click('#btnModeRistad'); await p.waitForTimeout(400);
  check(await passi() === 0 && await p.isDisabled('#btnIndietro'), 'in ristadiazione si parte da zero');
  await p.click('input[name=r_risposta][value=cCR]'); await fermo();
  await indietro();
  check(!(await p.evaluate(() => !!document.querySelector('input[name=r_risposta]:checked'))), 'Indietro vale anche in ristadiazione');
  await p.click('#btnModePrimaria'); await p.waitForTimeout(400);
  check(await passi() === passiPrimaria && /cT3cd/.test(await out()), 'tornando alla stadiazione, i suoi passi ci sono ancora');

  // ── una nota scritta in coda, dopo la riga dei criteri ESGAR, non si perde ──
  await p.click('#output'); await p.keyboard.press('Control+End'); await p.keyboard.type('\nNota in coda al referto.'); await fermo();
  await p.selectOption('#p_lnOttLato', 'bilaterale'); await fermo();
  check(/Referto redatto secondo i criteri ESGAR[^\n]*\n\nNota in coda al referto\.\s*$/.test(await out()) && /bilaterale/.test(await out()), 'una nota in coda resta dopo una modifica del form, sotto la riga finale');
  await p.click('input[name=p_ct][value="cT1-2"]'); await fermo();
  check((await out()).split('Nota in coda al referto.').length === 2, 'e non si raddoppia alle modifiche successive');
  await p.click('#btnGenerate'); await fermo();
  check(!/Nota in coda/.test(await out()), '«Rigenera tutto» la toglie, come ogni altra correzione a mano');
  await indietro(); await indietro(); await indietro(); await indietro();
  check(await passi() === passiPrimaria && !/Nota in coda/.test(await out()) && /cT3cd/.test(await out()), 'e quattro passi indietro riportano a prima della nota');

  // ── un clic che non cambia niente non è un passo ──
  await p.click('#btnCopy').catch(() => {}); await fermo();
  check(await passi() === passiPrimaria, '«Copia» non aggiunge un passo');

  // ── correzioni a mano dentro una sezione: un'altra scelta della stessa sezione non le cancella ──
  await p.click('#btnGenerate'); await fermo();
  const sezione = async (tit) => { const o = await out(), i = o.indexOf(tit); return o.slice(i, o.indexOf('\n\n', i)); };
  const LN = 'LINFONODI E DEPOSITI TUMORALI:';
  await p.evaluate(() => {
    const o = document.getElementById('output');
    o.value = o.value.replace('- linfonodi mesorettali sospetti: no', '- linfonodi mesorettali sospetti: no (solo linfonodi ovalari a margini netti, <3 mm)')
      .replace('- depositi tumorali: no', '- depositi tumorali: no\nNodulo di 2 mm nel grasso mesorettale posteriore, aspecifico.');
    o.dispatchEvent(new Event('input', { bubbles: true }));
  }); await fermo();
  await p.click('input[name=p_cn][value=cN0]'); await fermo();
  await p.click('input[name=p_lnLat][value=si]'); await p.click('#p_lnOtt'); await fermo();
  let ln = await sezione(LN);
  check(/margini netti, <3 mm\)/.test(ln) && /Nodulo di 2 mm/.test(ln) && /otturatori/.test(ln) && /cN0/.test(ln),
    'cambiando altre voci della sezione, le righe riscritte e aggiunte a mano restano e le voci nuove compaiono');
  check(ln.indexOf('Nodulo di 2 mm') > ln.indexOf('- depositi tumorali: no'), 'la frase aggiunta resta sotto la riga dopo cui era scritta');
  await p.click('input[name=p_lnMeso][value=si]'); await p.fill('#p_lnMesoNum', '3'); await fermo();
  ln = await sezione(LN);
  check(!/margini netti/.test(ln) && /linfonodi mesorettali sospetti: sì/.test(ln) && /Nodulo di 2 mm/.test(ln),
    'se il form cambia proprio la riga riscritta, vince il form (il dato nuovo); le altre aggiunte restano');
  await indietro(); await indietro();
  check(/margini netti, <3 mm\)/.test(await sezione(LN)), 'Indietro riporta la riga riscritta');

  check(errs.length === 0, 'nessun errore JS ' + errs.join(' | '));
  await b.close();
})();
