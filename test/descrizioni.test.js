// Le descrizioni delle categorie (cT3ab, near-cCR…): ufficiali ESGAR, o come le
// scrive il medico, dallo Stile personale o dalla Memoria. Solo forma: la categoria resta.
// Uso: npm i playwright && node test/descrizioni.test.js
const path = require('path');
const { chromium } = require('playwright');
const URL = 'file://' + path.join(__dirname, '..', 'index.html') + '?nointro';
const check = (cond, msg) => { console.log((cond ? 'OK  ' : 'FAIL') + ' ' + msg); if (!cond) process.exitCode = 1; };

(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await c.addInitScript(() => localStorage.setItem('structurad.esgar.sessione', JSON.stringify({ profilo: { id: 'op-abcdefghijkm', nome: 'Marco', cognome: 'Neri', titolo: 'Dr.' }, codice: '', dal: Date.now(), scade: Date.now() + 3600e3 })));
  const p = await c.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(URL); await p.waitForTimeout(500);
  const out = () => p.inputValue('#output');
  const riga = async (tit) => { const o = await out(), i = o.indexOf(tit); return i < 0 ? '' : o.slice(i + tit.length + 1).split('\n')[0]; };

  await p.click('input[name=p_ct][value=cT3ab]'); await p.waitForTimeout(250);
  check(await riga('CATEGORIA cT:') === 'cT3ab (crescita extramurale ≤5 mm)', 'di base la descrizione ufficiale ESGAR');

  // ── dallo Stile personale ──
  await p.click('#railStile'); await p.waitForTimeout(500);
  await p.click('[data-parte=descr]'); await p.waitForTimeout(150);
  check(await p.inputValue('[data-descr=cT3ab]') === 'crescita extramurale ≤5 mm' && await p.locator('[data-descr]').count() === 4, 'lo Stile mostra le quattro descrizioni della stadiazione, ufficiali');
  await p.fill('[data-descr=cT3ab]', 'estensione extramurale fino a 5 mm');
  check(/cT3ab \(estensione extramurale fino a 5 mm\)/.test(await p.textContent('#stFoglio')) && /cT3ab \(crescita/.test(await out()), 'la bozza si vede nel foglio; il referto vero aspetta «Salva»');
  await p.click('[data-st=salva]'); await p.waitForTimeout(300);
  check(await riga('CATEGORIA cT:') === 'cT3ab (estensione extramurale fino a 5 mm)', '«Salva»: il referto prende la descrizione del medico');

  // ── la Memoria, nel passo Categoria cT, mostra l'anteprima con la descrizione in vigore ──
  await p.click('#railMemoria'); await p.waitForTimeout(500);
  await p.click('.mp-nodo[data-sez=ct]'); await p.waitForTimeout(600);
  check(/cT3ab \(estensione extramurale fino a 5 mm\)/.test(await p.textContent('.fr-riga[data-voce="p.ct.cT3ab"] .fr-ante')), 'la Memoria, nel passo Categoria cT, mostra la riga con la descrizione dello Stile');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  // ── di nuovo nello Stile: una svuotata, l'altra all'ufficiale ──
  await p.click('#railStile'); await p.waitForTimeout(500);
  await p.click('[data-parte=descr]'); await p.waitForTimeout(150);
  await p.fill('[data-descr=cT3cd]', '');
  await p.click('[data-st=descr-uff][data-k=cT3ab]'); await p.waitForTimeout(150);
  await p.click('[data-st=salva]'); await p.waitForTimeout(300);
  check(await riga('CATEGORIA cT:') === 'cT3ab (crescita extramurale ≤5 mm)', '«Ufficiale» riporta la descrizione ESGAR');
  await p.click('input[name=p_ct][value=cT3cd]'); await p.waitForTimeout(250);
  check(await riga('CATEGORIA cT:') === 'cT3cd', 'svuotata, la categoria resta senza parentesi');
  check(JSON.stringify(await p.evaluate(() => EsgarStile.stato().descr)) === '{"cT3cd":""}', 'ed è nello stile del medico: ' + JSON.stringify(await p.evaluate(() => EsgarStile.stato().descr)));

  // ── ristadiazione: le classi di risposta ──
  await p.click('#btnModeRistad'); await p.waitForTimeout(300);
  await p.click('#railStile'); await p.waitForTimeout(500);
  await p.click('[data-parte=descr]'); await p.waitForTimeout(150);
  check(await p.locator('[data-descr]').count() === 8, 'in ristadiazione: quattro classi di risposta e quattro ycT');
  await p.fill('[data-descr="risp:near-cCR"]', 'fibrosi quasi omogenea, piccoli foci di restrizione');
  await p.click('[data-st=salva]'); await p.waitForTimeout(300);
  await p.click('input[name=r_risposta][value=near-cCR]'); await p.waitForTimeout(250);
  check(await riga('PROBABILITÀ DI TUMORE RESIDUO:') === 'Risposta clinica quasi completa (near-cCR) (fibrosi quasi omogenea, piccoli foci di restrizione)', 'la classe di risposta prende la descrizione del medico');

  // ── senza accesso: le ufficiali ──
  await p.evaluate(() => localStorage.removeItem('structurad.esgar.sessione'));
  const p2 = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await p2.goto(URL); await p2.waitForTimeout(400);
  await p2.click('input[name=p_ct][value=cT3cd]'); await p2.waitForTimeout(250);
  check(/^cT3cd \(crescita extramurale >5 mm\)$/m.test(await p2.inputValue('#output')), 'senza accesso il referto ha le descrizioni ufficiali');

  check(errs.length === 0, 'nessun errore JS ' + errs.join(' | '));
  await b.close();
})();
