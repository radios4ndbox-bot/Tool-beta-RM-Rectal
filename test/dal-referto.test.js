// Memoria · «Dal tuo referto»: da un referto già scritto dal medico (.txt, .docx o incollato)
// il tool riconosce sezioni e voci e propone le sue frasi, con i dati al posto dei numeri.
// Uso: npm i playwright && node test/dal-referto.test.js [cartella-screenshot]
const path = require('path'), fs = require('fs'), os = require('os'), zlib = require('zlib');
const { chromium } = require('playwright');
const URL = 'file://' + path.join(__dirname, '..', 'index.html') + '?nointro';
const SHOTS = process.argv[2] || os.tmpdir();
const check = (cond, msg) => { console.log((cond ? 'OK  ' : 'FAIL') + ' ' + msg); if (!cond) process.exitCode = 1; };

const REFERTO = `RM DEL RETTO - STADIAZIONE

Neoformazione del retto medio a crescita parzialmente anulare tra le ore 3 e le ore 7, a composizione solida.
Il margine inferiore dista 6,5 cm dalla giunzione anorettale. Lesione interamente al di sotto della riflessione peritoneale.
Estensione cranio-caudale di circa 4 cm.
Superamento della muscolare propria con estensione extramurale di 3 mm (T3b).
Non segni di invasione vascolare extramurale.
Complesso sfinterico indenne.
La fascia mesorettale appare libera, con distanza minima di 4 mm.
Non linfonodi mesorettali con caratteri di sospetto.
Non adenopatie lungo le catene iliache esterne e comuni né in sede inguinale.
Conclusione: neoplasia del retto medio cT3ab, MRF-, EMVI-, cN0.`;

/* un .docx minimo: lo zip con word/document.xml compresso */
function docx(testo){
  const xml = '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'
    + testo.split('\n').map((r) => `<w:p><w:r><w:t>${r.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</w:t></w:r></w:p>`).join('') + '</w:body></w:document>';
  const nome = Buffer.from('word/document.xml'), dati = Buffer.from(xml, 'utf8'), comp = zlib.deflateRawSync(dati);
  const loc = Buffer.alloc(30); loc.writeUInt32LE(0x04034b50, 0); loc.writeUInt16LE(20, 4); loc.writeUInt16LE(8, 8);
  loc.writeUInt32LE(comp.length, 18); loc.writeUInt32LE(dati.length, 22); loc.writeUInt16LE(nome.length, 26);
  const cen = Buffer.alloc(46); cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(8, 10);
  cen.writeUInt32LE(comp.length, 20); cen.writeUInt32LE(dati.length, 24); cen.writeUInt16LE(nome.length, 28); cen.writeUInt32LE(0, 42);
  const corpo = Buffer.concat([loc, nome, comp]), dir = Buffer.concat([cen, nome]);
  const fine = Buffer.alloc(22); fine.writeUInt32LE(0x06054b50, 0); fine.writeUInt16LE(1, 8); fine.writeUInt16LE(1, 10);
  fine.writeUInt32LE(dir.length, 12); fine.writeUInt32LE(corpo.length, 16);
  return Buffer.concat([corpo, dir, fine]);
}

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(URL); await p.waitForTimeout(400);
  const carte = () => p.evaluate(() => [...document.querySelectorAll('.rf-frase:not(.fatta)')].map((c) => ({
    voce: (c.querySelector('select') || {}).value || '', testo: (c.querySelector('.rf-testo') || {}).value || '',
    errore: (c.querySelector('.fr-errore') || {}).textContent || '', avviso: (c.querySelector('.rf-avviso') || {}).textContent || '' })));
  const carta = (cs, voce) => cs.find((c) => c.voce === voce) || {};

  await p.click('#railMemoria'); await p.waitForTimeout(500);
  check(await p.isVisible('[data-rf-apri]'), 'sulla mappa c\'è «Dal tuo referto»');
  await p.click('[data-rf-apri]'); await p.waitForTimeout(400);
  check(await p.isVisible('#rfIncolla') && await p.isVisible('#mgReferto', { strict: false }) === false, 'si incolla un referto o si sceglie un file');
  await p.fill('#rfIncolla', REFERTO); await p.click('[data-rf-analizza]'); await p.waitForTimeout(500);
  let cs = await carte();
  check(cs.length === 11 && cs.every((c) => c.voce), 'undici frasi, ognuna con una voce del modulo: ' + cs.map((c) => c.voce).join(', '));
  check(/stadiazione primaria/.test(await p.textContent('.pg-sez-testa h3')), 'riconosce che è una stadiazione primaria');
  check(carta(cs, 'p.mrf.no').testo === 'La fascia mesorettale appare libera, con distanza minima di 4 mm.' && carta(cs, 'p.emvi.no').testo && carta(cs, 'p.sfint.no').testo && carta(cs, 'p.nr.no').testo && carta(cs, 'p.lnMeso.no').testo,
    'MRF, EMVI, sfinteri e linfonodi: voci «No» riconosciute dalle parole chiave e dalla negazione');
  check(carta(cs, 'p.distGar').testo === 'Il margine inferiore dista [cm] cm dalla giunzione anorettale.' && carta(cs, 'p.lunghezza').testo === 'Estensione cranio-caudale di circa [cm] cm.',
    'le misure diventano il dato del modulo, [cm]');
  check(carta(cs, 'p.forma.parziale').testo === 'Neoformazione del retto medio a crescita parzialmente anulare[ore], a composizione solida.', 'le ore diventano [ore]');
  check(/, cT3ab\[descrizione\]\.$/.test(carta(cs, 'p.ct.cT3ab').testo) && /3 mm/.test(carta(cs, 'p.ct.cT3ab').avviso), 'T3b diventa la categoria della voce, cT3ab; e il «3 mm» rimasto è segnalato');
  check(carta(cs, 'p.concl.retto').testo === 'neoplasia del retto medio [categorie].', 'la conclusione: senza il titolo, le categorie come dato');
  check(/4 mm/.test(carta(cs, 'p.mrf.no').avviso), 'un numero del caso rimasto nella frase è segnalato');
  await p.screenshot({ path: SHOTS + '/dal_referto.png' });

  // salvare una frase come propria
  const i = await p.evaluate(() => [...document.querySelectorAll('.rf-frase')].findIndex((c) => (c.querySelector('select') || {}).value === 'p.mrf.no'));
  await p.fill(`[data-rf-testo="${i}"]`, 'La fascia mesorettale appare libera.');
  await p.click(`[data-rf-salva="${i}"]`); await p.waitForTimeout(200);
  check(await p.evaluate(() => EsgarFrasi.frase('p.mrf.no')) === 'La fascia mesorettale appare libera.' && await p.isVisible('.rf-frase.fatta'), '«Salva come tua frase»: la frase va sulla voce');
  // la voce cambiata a mano ripara la frase per quella voce
  const j = await p.evaluate(() => [...document.querySelectorAll('.rf-frase')].findIndex((c) => (c.querySelector('select') || {}).value === 'p.lunghezza'));
  await p.selectOption(`select[data-rf-voce="${j}"]`, 'p.distGar'); await p.waitForTimeout(250);
  check(await p.evaluate(() => [...document.querySelectorAll('.rf-frase')].some((c) => (c.querySelector('select') || {}).value === 'p.distGar' && /circa \[cm\] cm/.test(c.querySelector('.rf-testo').value))), 'cambiando la voce, la frase si riprepara');
  // ignora
  const prima = (await carte()).length;
  await p.click('.rf-frase:not(.fatta) [data-rf-via] >> nth=0'); await p.waitForTimeout(150);
  check((await carte()).length === prima - 1, '«Ignora» la toglie');
  // il referto usa la frase salvata
  await p.click('[data-mappa]'); await p.waitForTimeout(400); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  check(/^La fascia mesorettale appare libera\.$/m.test(await p.inputValue('#output')), 'nel referto c\'è la frase presa dal tuo referto');

  // un referto d'archivio del tool: quasi tutto già uguale al testo del tool
  const arch = fs.readdirSync(path.join(__dirname, '..', 'demo', 'dati', 'referti', 'Viggiano Pasquale', '2026'), { recursive: true }).map(String).find((f) => /A130915.*\.txt$/.test(f));
  const file = path.join(__dirname, '..', 'demo', 'dati', 'referti', 'Viggiano Pasquale', '2026', arch);
  await p.evaluate(() => EsgarFrasi.azzera());
  await p.click('#railMemoria'); await p.waitForTimeout(400); await p.click('[data-rf-apri]'); await p.waitForTimeout(300);
  if (await p.isVisible('[data-rf-nuovo]')) { await p.click('[data-rf-nuovo]'); await p.waitForTimeout(200); }
  await p.setInputFiles('#mgReferto', file); await p.waitForTimeout(500);
  cs = await carte();
  check(cs.length >= 5 && cs.every((c) => c.voce) && /già uguali al testo del tool/.test(await p.textContent('.pg-sez-testa p')),
    'un referto della demo (con le frasi del Dr. Viggiano): le sue frasi personali proposte, voce per voce: ' + cs.map((c) => c.voce).join(', '));
  check(carta(cs, 'p.mrf.no').testo === '- fascia mesorettale libera (margine >1 mm)', 'la frase personale della demo torna sulla sua voce (MRF «No»)');

  // un file Word
  const dx = path.join(os.tmpdir(), 'referto-prova.docx'); fs.writeFileSync(dx, docx(REFERTO));
  await p.click('[data-rf-nuovo]'); await p.waitForTimeout(200);
  await p.setInputFiles('#mgReferto', dx); await p.waitForTimeout(600);
  check((await carte()).length === 11, 'un .docx si legge come il testo');
  // ristadiazione
  await p.click('[data-rf-modo=ristad]'); await p.waitForTimeout(300);
  check(/ristadiazione/.test(await p.textContent('.pg-sez-testa h3')) && (await carte()).every((c) => !c.voce || c.voce.startsWith('r.')), '«Leggilo come ristadiazione» usa le voci della ristadiazione');
  // un file di frasi qui non va
  const js = path.join(os.tmpdir(), 'frasi.json'); fs.writeFileSync(js, '{"frasi":{}}');
  await p.click('[data-rf-nuovo]'); await p.waitForTimeout(200);
  await p.setInputFiles('#mgReferto', js); await p.waitForTimeout(300);
  check(/Importa le frasi/.test(await p.textContent('#rfStato')), 'un file di frasi .json: dice di usare «Importa le frasi»');

  check(errs.length === 0, 'nessun errore JS ' + errs.join(' | '));
  await b.close();
})();
