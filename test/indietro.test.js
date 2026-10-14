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
  await p.click('input[name=p_ct][value=cT3c]'); await fermo();
  check(/cT3c/.test(await out()) && await p.isEnabled('#btnIndietro') && await passi() === 1, 'una scelta nel form è un passo');
  await p.click('input[name=p_ct][value=cT2]'); await fermo();
  check(/cT2/.test(await out()) && await passi() === 2, 'una seconda scelta, un secondo passo');
  await indietro();
  check(/cT3c/.test(await out()) && !/cT2 /.test(await out()) && await p.isChecked('input[name=p_ct][value=cT3c]'), 'Indietro: tornano insieme il testo e la scelta nel form (cT3c)');
  await indietro();
  check(await out() === iniziale && !(await p.evaluate(() => !!document.querySelector('input[name=p_ct]:checked'))) && await p.isDisabled('#btnIndietro'),
    'ancora Indietro: referto e form come all\'inizio, e il pulsante si spegne');

  // ── menu a tendina, caselle, data ──
  await p.selectOption('#p_emviGrade', '3'); await fermo();
  await p.click('text=Anteriore'); await fermo();
  check(/EMVI\+/.test(await out()) && /anteriore/.test(await out()), 'menu e casella cambiano il referto');
  await indietro(); await indietro();
  check(await out() === iniziale && await p.inputValue('#p_emviGrade') === '' && !(await p.isChecked('.p-parete[value=anteriore]'))
    && /non valutato|—/.test(await p.textContent('.sel-wrap:has(#p_emviGrade) .sel-valore')), 'Indietro rimette menu (anche a schermo) e casella');

  // ── una correzione a mano, poi «Rigenera tutto» per sbaglio ──
  await p.click('input[name=p_ct][value=cT3c]'); await fermo();
  // dentro la sezione del cT: il testo dopo la riga finale dei criteri ESGAR il tool non lo conserva
  await p.evaluate(() => { const o = document.getElementById('output'), i = o.value.indexOf('\n', o.value.indexOf('cT3c')); o.focus(); o.setSelectionRange(i, i); });
  await p.keyboard.type(' Nota scritta a mano.'); await fermo();
  check(/Nota scritta a mano\./.test(await out()), 'il medico aggiunge una frase a mano');
  const conNota = await out(), prima = await passi();
  check(prima === 2, 'le battute scritte di seguito contano come un passo solo');
  await p.click('#btnGenerate'); await fermo();
  check(!/Nota scritta a mano/.test(await out()), '«Rigenera tutto» cancella la frase scritta a mano');
  await indietro();
  check(await out() === conNota, 'Indietro la riporta');
  await p.selectOption('#p_emviGrade', '4'); await fermo();
  check(/Nota scritta a mano\./.test(await out()) && /EMVI\+/.test(await out()), 'e resta una correzione a mano: un\'altra scelta nel form non la cancella');
  await indietro(); await indietro();
  check(!/Nota scritta a mano/.test(await out()) && /cT3c/.test(await out()), 'due passi indietro: via l\'EMVI e la frase, resta il cT3c');

  // ── righe aggiunte e tolte ──
  const righe = () => p.locator('#p_td_container [data-row]').count();
  const ultima = '#p_td_container [data-row]:last-child';
  const righeBase = await righe();                      // il form parte con una riga vuota
  await p.click('input[name=p_tdPresente][value=si]'); await fermo();
  await p.click('#p_tdAdd'); await fermo();
  await p.fill(ultima + ' input[data-f=sede]', 'mesoretto posteriore'); await fermo();
  check(await righe() === righeBase + 1 && /mesoretto posteriore/.test(await out()), 'un tumor deposit aggiunto e compilato');
  await p.click(ultima + ' [data-remove]'); await fermo();
  check(await righe() === righeBase && !/mesoretto posteriore/.test(await out()), 'tolto per sbaglio');
  await indietro();
  check(await righe() === righeBase + 1 && await p.inputValue(ultima + ' input[data-f=sede]') === 'mesoretto posteriore' && /mesoretto posteriore/.test(await out()),
    'Indietro: la riga torna, con quello che c\'era scritto');
  await indietro(); await indietro();
  check(await righe() === righeBase && !/mesoretto posteriore/.test(await out()), 'e indietro ancora: la riga aggiunta non c\'è più');
  await indietro();
  check(!(await p.isChecked('input[name=p_tdPresente][value=si]')), 'e ancora: il tumor deposit torna «non presente»');

  // ── ogni modalità ha i suoi passi ──
  const passiPrimaria = await passi();
  await p.click('#btnModeRistad'); await p.waitForTimeout(400);
  check(await passi() === 0 && await p.isDisabled('#btnIndietro'), 'in ristadiazione si parte da zero');
  await p.click('input[name=r_risposta][value=cCR]'); await fermo();
  await indietro();
  check(!(await p.evaluate(() => !!document.querySelector('input[name=r_risposta]:checked'))), 'Indietro vale anche in ristadiazione');
  await p.click('#btnModePrimaria'); await p.waitForTimeout(400);
  check(await passi() === passiPrimaria && /cT3c/.test(await out()), 'tornando alla stadiazione, i suoi passi ci sono ancora');

  // ── una nota scritta in coda, dopo la riga dei criteri ESGAR, non si perde ──
  await p.click('#output'); await p.keyboard.press('Control+End'); await p.keyboard.type('\nNota in coda al referto.'); await fermo();
  await p.selectOption('#p_emviGrade', '2'); await fermo();
  check(/Referto redatto secondo i criteri ESGAR[^\n]*\n\nNota in coda al referto\.\s*$/.test(await out()) && /grado 2/.test(await out()), 'una nota in coda resta dopo una modifica del form, sotto la riga finale');
  await p.click('input[name=p_ct][value=cT2]'); await fermo();
  check((await out()).split('Nota in coda al referto.').length === 2, 'e non si raddoppia alle modifiche successive');
  await p.click('#btnGenerate'); await fermo();
  check(!/Nota in coda/.test(await out()), '«Rigenera tutto» la toglie, come ogni altra correzione a mano');
  await indietro(); await indietro(); await indietro(); await indietro();
  check(await passi() === passiPrimaria && !/Nota in coda/.test(await out()) && /cT3c/.test(await out()), 'e quattro passi indietro riportano a prima della nota');

  // ── un clic che non cambia niente non è un passo ──
  await p.click('#btnCopy').catch(() => {}); await fermo();
  check(await passi() === passiPrimaria, '«Copia» non aggiunge un passo');

  check(errs.length === 0, 'nessun errore JS ' + errs.join(' | '));
  await b.close();
})();
