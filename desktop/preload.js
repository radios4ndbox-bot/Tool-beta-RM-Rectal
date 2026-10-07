// Il ponte fra la pagina e il PC: solo queste funzioni, solo dentro la cartella comune.
const { contextBridge, ipcRenderer } = require('electron');
const chiama = (c) => (...a) => ipcRenderer.invoke(c, ...a);
contextBridge.exposeInMainWorld('EsgarDesktop', {
  stato: chiama('stato'),
  scegli: chiama('scegli'),
  scrivi: chiama('scrivi'),
  leggi: chiama('leggi'),
  elenca: chiama('elenca'),
  esiste: chiama('esiste'),
  apriCartella: chiama('apriCartella'),
  apriTool: chiama('apriTool')
});
