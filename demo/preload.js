// Dimostrazione: lo stesso ponte del programma, e una sessione già aperta.
// Il tool trova il medico già entrato, come dopo un accesso con il telefono;
// non ha un codice dispositivo, quindi non è amministratore.
const { contextBridge, ipcRenderer } = require('electron');
const chiama = (c) => (...a) => ipcRenderer.invoke(c, ...a);
contextBridge.exposeInMainWorld('EsgarDesktop', {
  stato: chiama('stato'),
  scegli: chiama('scegli'),
  scrivi: chiama('scrivi'),
  leggi: chiama('leggi'),
  elenca: chiama('elenca'),
  esiste: chiama('esiste'),
  tipo: chiama('tipo'),
  creaCartella: chiama('creaCartella'),
  rinomina: chiama('rinomina'),
  apriCartella: chiama('apriCartella'),
  apriTool: chiama('apriTool')
});

// prima che il tool parta: la sessione del medico della dimostrazione, per 12 ore
try {
  const arg = process.argv.find((a) => a.startsWith('--esgar-medico='));
  const m = JSON.parse(decodeURIComponent(arg.slice('--esgar-medico='.length)));
  localStorage.setItem('structurad.esgar.sessione', JSON.stringify({
    profilo: { id: 'op-dimostrazion', nome: m.nome, cognome: m.cognome, titolo: m.titolo || '' },
    dispositivo: 'dimostrazione', codice: '', dal: Date.now(), scade: Date.now() + 12 * 3600 * 1000
  }));
} catch (_) {}
