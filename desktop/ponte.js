// Le operazioni del ponte sui file della cartella comune. Senza Electron,
// così si provano con Node (test/desktop.test.js). Tutti i percorsi sono
// relativi alla cartella comune; quelli che ne escono sono rifiutati.
const path = require('path');
const fs = require('fs');

// cartella(): il percorso della cartella comune, o '' se non è impostata
module.exports = function creaPonte(cartella){
  function dentro(rel){
    const base = cartella();
    if (!base) throw new Error('Cartella comune non impostata');
    if (!fs.existsSync(base)) throw new Error('Cartella comune non raggiungibile: ' + base);
    const p = path.resolve(base, String(rel || '.'));
    const r = path.relative(base, p);
    if (r.startsWith('..') || path.isAbsolute(r)) throw new Error('Percorso fuori dalla cartella comune');
    return p;
  }
  return {
    scrivi(rel, testo){
      const p = dentro(rel);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, String(testo), 'utf8');
      return path.relative(cartella(), p);
    },
    leggi: (rel) => fs.readFileSync(dentro(rel), 'utf8'),
    elenca: (rel) => fs.readdirSync(dentro(rel), { withFileTypes: true })
      .map((d) => ({ nome: d.name, cartella: d.isDirectory() })),
    esiste(rel){ try { return fs.existsSync(dentro(rel)); } catch (_) { return false; } },
    // 'file', 'cartella' o '' se non c'è
    tipo(rel){
      const p = dentro(rel);
      try { return fs.statSync(p).isDirectory() ? 'cartella' : 'file'; } catch (_) { return ''; }
    },
    creaCartella(rel){
      const p = dentro(rel);
      fs.mkdirSync(p, { recursive: true });
      return path.relative(cartella(), p);
    }
  };
};
