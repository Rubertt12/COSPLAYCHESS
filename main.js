const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const { autoUpdater } = require("electron-updater");
const path = require('path');

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, 'img/favicon-Photoroom.png'),
    webPreferences: {
      nodeIntegration: true,    // Mantido true para seu script.js funcionar
      contextIsolation: false   // Mantido false para acesso ao IndexedDB
    }
  });

  // Remove menu padrão para visual de jogo
  Menu.setApplicationMenu(null);

  win.loadFile('index.html');

  // --- ESCUTADOR DE TELA CHEIA (IPC) ---
  ipcMain.on('toggle-fullscreen', () => {
    win.setFullScreen(!win.isFullScreen());
  });

  // --- LÓGICA DE ATUALIZAÇÃO ---
  autoUpdater.checkForUpdatesAndNotify();
  autoUpdater.on('update-downloaded', () => {
    autoUpdater.quitAndInstall(); 
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});