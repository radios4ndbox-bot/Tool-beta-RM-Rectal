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
  await p.click(trigger('p_sede'));
  check(await p.isVisible('.sel-wrap.aperto .sel-opzioni'), 'il menu si apre');
  await p.screenshot({ path: SHOTS + '/ui_tendina.png' });
  await p.click('.sel-wrap.aperto .sel-opzione:has-text("Retto alto")');
  check(await p.inputValue('#p_sede') === 'retto alto' && /retto alto/.test(await out()), 'la scelta arriva al select e al referto');
  check(await p.textContent(trigger('p_sede') + ' .sel-valore') === 'Retto alto', 'il menu mostra la scelta');
  await p.focus(trigger('p_campoMagnetico'));
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter');
  check(await p.inputValue('#p_campoMagnetico') === '3T' && /apparecchio 3T/.test(await out()), 'da tastiera: frecce e Invio');
  await p.click('#p_tdAdd');
  check(await p.evaluate(() => [...document.querySelectorAll('#p_td_container select, #p_ln_container select')].every((s) => s.closest('.sel-wrap'))), 'anche le righe aggiunte hanno il menu del tool');

  // ── calendario ──
  await p.click(trigger('p_confrontoTipo')); await p.click('.sel-wrap.aperto .sel-opzione:has-text("TC")');
  await p.click('#p_confrontoData');
  check(await p.isVisible('#calPanel.open'), 'il calendario si apre');
  await p.screenshot({ path: SHOTS + '/ui_calendario.png' });
  await p.click('#calPanel .cal-day:not(.fuori) >> text="15"');
  const d = await p.inputValue('#p_confrontoData');
  check(/^15\/\d{2}\/\d{4}$/.test(d), 'data in gg/mm/aaaa: ' + d);
  check((await out()).includes('Si prende visione di precedente imaging: TC del ' + d), 'nel referto: «TC del ' + d + '»');
  await p.fill('#p_confrontoData', ''); await p.type('#p_confrontoData', '05032026'); await p.click('#p_premedicazione');
  check(await p.inputValue('#p_confrontoData') === '05/03/2026', 'digitando le cifre le barre le mette il campo');
  check((await out()).includes('TC del 05/03/2026'), 'e il referto segue');
  await p.click('#btnModeRistad'); await p.waitForTimeout(200);
  await p.click('#r_confronto'); await p.click('#calPanel [data-act=oggi]');
  check(/Confronto con RM basale del: \d{2}\/\d{2}\/\d{4}/.test(await out()), 'RM basale di confronto con il calendario');
  await p.click('#btnModePrimaria'); await p.waitForTimeout(200);
  check(/^\d{2}\/\d{2}\/\d{4}$/.test(await p.inputValue('#arcData')), 'data d\'esame in gg/mm/aaaa: ' + await p.inputValue('#arcData'));

  // ── memoria ──
  const PROSTATA = 'infiltrazione della capsula prostatica a sinistra';
  const ELEVATORE = 'infiltrazione del muscolo elevatore dell\'ano di sinistra';
  async function referto(opz){
    await p.evaluate((o) => {
      const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); };
      ['p_organoProstata', 'p_elevatore'].forEach((id) => { const c = document.getElementById(id); if (c.checked) c.click(); });
      if (o.check) document.getElementById(o.check).click();
      document.querySelector('input[name=p_ct][value=cT4b]').checked = true;
      set('p_ctNote', o.nota); set('p_estensione', String(o.est));
    }, opz);
    await p.click('#btnCopy');
  }
  await referto({ check: 'p_organoProstata', nota: PROSTATA, est: 4 });
  await referto({ check: 'p_organoProstata', nota: PROSTATA, est: 5 });
  await referto({ check: 'p_elevatore', nota: ELEVATORE, est: 6 });
  await referto({ check: 'p_elevatore', nota: ELEVATORE, est: 7 });
  await p.click('#btnCopy');                       // stesso referto: non conta
  const n = await p.evaluate(() => EsgarMemoria.stato().campi.p_ctNote.n);
  check(n === 4, 'quattro referti, lo stesso copiato due volte conta una: ' + n);

  const primo = async () => (await p.evaluate(() => EsgarMemoria.suggerimenti(document.getElementById('p_ctNote'))))[0];
  await p.evaluate(() => { const e = document.getElementById('p_ctNote'); e.value = ''; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.evaluate(() => { ['p_organoProstata', 'p_elevatore'].forEach((id) => { const c = document.getElementById(id); if (c.checked) c.click(); }); document.getElementById('p_organoProstata').click(); });
  check((await primo()).testo === PROSTATA, 'contesto prostata → propone la nota sulla prostata');
  await p.evaluate(() => { document.getElementById('p_organoProstata').click(); document.getElementById('p_elevatore').click(); });
  check((await primo()).testo === ELEVATORE, 'contesto elevatore → propone la nota sull\'elevatore');
  await p.click('#p_ctNote');
  check(await p.isVisible('#memPannello.aperto'), 'il pannello dei suggerimenti si apre sul campo');
  await p.screenshot({ path: SHOTS + '/ui_memoria.png' });
  await p.keyboard.type('caps');
  check((await primo()).testo === PROSTATA, 'scrivendo «caps» sale la nota sulla capsula, contro il contesto');
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter');
  check(await p.inputValue('#p_ctNote') === PROSTATA && (await out()).includes(PROSTATA), 'Invio inserisce la frase e il referto si aggiorna');

  // si corregge da solo: la seconda proposta scelta più volte passa prima
  await p.evaluate(() => { const e = document.getElementById('p_premedicazione'); e.value = ''; });
  for (const [i, t] of [['a', 'Buscopan 20 mg e.v.'], ['b', 'Buscopan 20 mg e.v.'], ['c', 'Buscopan 20 mg e.v.'], ['d', 'Glucagone 1 mg e.v.'], ['e', 'Glucagone 1 mg e.v.']]) {
    await p.evaluate(([x, t]) => { const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); };
      set('p_premedicazione', t); set('p_giunzione', x.charCodeAt(0)); }, [i, t]);
    await p.click('#btnCopy');
  }
  await p.evaluate(() => { const e = document.getElementById('p_premedicazione'); e.value = ''; e.dispatchEvent(new Event('input', { bubbles: true })); });
  const prima = (await p.evaluate(() => EsgarMemoria.suggerimenti(document.getElementById('p_premedicazione'))))[0].testo;
  check(prima === 'Buscopan 20 mg e.v.', 'all\'inizio vince la più usata: ' + prima);
  for (let k = 0; k < 4; k++) {
    await p.click('#p_giunzione'); await p.click('#p_premedicazione');
    await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter');
    await p.evaluate(() => { const e = document.getElementById('p_premedicazione'); e.value = ''; e.dispatchEvent(new Event('input', { bubbles: true })); });
  }
  const dopo = (await p.evaluate(() => EsgarMemoria.suggerimenti(document.getElementById('p_premedicazione'))))[0].testo;
  check(dopo === 'Glucagone 1 mg e.v.', 'scelta più volte, la seconda passa prima: ' + dopo);

  // dimentica, e la memoria resta alla ricarica
  await p.click('#p_giunzione'); await p.click('#p_premedicazione');
  await p.hover('#memPannello .mem-voce >> nth=1'); await p.click('#memPannello .mem-voce >> nth=1 >> .mem-via');
  const rimaste = await p.evaluate(() => EsgarMemoria.stato().campi.p_premedicazione.voci.map((v) => v.k));
  check(rimaste.length === 1, '× toglie la frase dalla memoria: ' + rimaste.join(', '));
  await p.reload(); await p.waitForTimeout(300);
  check(await p.evaluate(() => EsgarMemoria.stato().campi.p_ctNote.voci.length) === 2, 'la memoria resta alla ricarica');
  check(errs.length === 0, 'nessun errore JS ' + errs.join(' | '));
  await b.close();
})();
