// Le operazioni del ponte sui file della cartella comune. Senza Electron,
// così si provano con Node (test/desktop.test.js). Tutti i percorsi sono
// relativi alla cartella comune; quelli che ne escono sono rifiutati.
//
// · Una operazione alla volta, in coda: due scritture non si accavallano.
// · Ogni file si scrive accanto, con un nome provvisorio, e poi prende il
//   posto del vecchio: se qualcosa va storto a metà (rete, corrente), il
//   file di prima resta intero. Vale soprattutto per l'indice CSV.
// · Niente chiamate bloccanti: un disco di rete scollegato non ferma la
//   finestra, e dopo ATTESA si risponde con un errore chiaro.
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;

const ATTESA = 15000;        // ms per un'operazione
const ATTESA_STATO = 4000;   // ms per dire se la cartella risponde

function errore(messaggio){ const e = new Error(messaggio); e.chiaro = true; return e; }
const RETE = ['ENOTCONN', 'ENETUNREACH', 'EHOSTUNREACH', 'EHOSTDOWN', 'ETIMEDOUT', 'ECONNRESET', 'EIO', 'ENODEV', 'ENXIO', 'UNKNOWN'];

// cartella(): il percorso della cartella comune, o '' se non è impostata
module.exports = function creaPonte(cartella){
  const irraggiungibile = () => errore('Cartella comune non raggiungibile: ' + cartella());
  function entro(promessa, ms){
    let t;
    return Promise.race([promessa, new Promise((_, ko) => { t = setTimeout(() => ko(irraggiungibile()), ms); })])
      .finally(() => clearTimeout(t));
  }
  // dagli errori del sistema a messaggi che un medico può leggere
  function chiaro(e, p){
    if (e && e.chiaro) return e;
    const nome = p ? path.basename(p) : '';
    const c = e && e.code;
    if (c === 'EBUSY' || c === 'EPERM' || c === 'EACCES') return errore(`«${nome}» è aperto in un altro programma (per esempio Excel) o è protetto: chiudilo e riprova.`);
    if (c === 'ENOSPC') return errore('Il disco della cartella comune è pieno.');
    if (c === 'ENOENT') return errore(`«${nome}» non c'è più nella cartella comune.`);
    if (RETE.includes(c)) return irraggiungibile();
    return errore(String(e && e.message || e));
  }
  async function dentro(rel){
    const base = cartella();
    if (!base) throw errore('Cartella comune non impostata');
    const p = path.resolve(base, String(rel || '.'));
    const r = path.relative(base, p);
    if (r.startsWith('..') || path.isAbsolute(r)) throw errore('Percorso fuori dalla cartella comune');
    try { await fsp.access(base); } catch (_) { throw irraggiungibile(); }
    return p;
  }
  let coda = Promise.resolve();
  // fn(percorso assoluto, ...altri argomenti): in coda, entro ATTESA, con errori chiari
  const op = (fn) => (rel, ...a) => {
    const r = coda.then(() => entro((async () => {
      let p = '';
      try { p = await dentro(rel); return await fn(p, ...a); } catch (e) { throw chiaro(e, p); }
    })(), ATTESA));
    coda = r.catch(() => {});
    return r;
  };
  const relativo = (p) => path.relative(cartella(), p);

  async function sostituisci(p, testo){
    const provvisorio = `${p}.tmp-${process.pid}`;
    await fsp.mkdir(path.dirname(p), { recursive: true });
    try {
      await fsp.writeFile(provvisorio, String(testo), 'utf8');
      await fsp.rename(provvisorio, p);
    } catch (e) {
      await fsp.unlink(provvisorio).catch(() => {});
      throw e;
    }
  }

  const tipo = op(async (p) => {
    try { return (await fsp.stat(p)).isDirectory() ? 'cartella' : 'file'; }
    catch (e) { if (e.code === 'ENOENT') return ''; throw e; }
  });
  return {
    scrivi: op(async (p, testo) => { await sostituisci(p, testo); return relativo(p); }),
    leggi: op((p) => fsp.readFile(p, 'utf8')),
    elenca: op(async (p) => (await fsp.readdir(p, { withFileTypes: true }))
      .map((d) => ({ nome: d.name, cartella: d.isDirectory() }))),
    esiste: (rel) => tipo(rel).then((t) => !!t, () => false),
    // 'file', 'cartella' o '' se non c'è
    tipo,
    creaCartella: op(async (p) => { await fsp.mkdir(p, { recursive: true }); return relativo(p); }),
    // dentro la cartella comune; se «a» esiste già, viene sostituito
    rinomina: op(async (p, a) => {
      const q = await dentro(a);
      await fsp.mkdir(path.dirname(q), { recursive: true });
      try { await fsp.rename(p, q); } catch (e) { throw chiaro(e, e.code === 'ENOENT' ? p : q); }
      return relativo(q);
    }),
    // la cartella comune risponde? (fuori dalla coda: non aspetta le altre operazioni)
    raggiungibile(){
      const base = cartella();
      return base ? entro(fsp.access(base), ATTESA_STATO).then(() => true, () => false) : Promise.resolve(false);
    }
  };
};
