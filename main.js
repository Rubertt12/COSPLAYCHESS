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
      nodeIntegration: true,    // Necessário para o ipcRenderer no script.js
      contextIsolation: false,  // Necessário para acessar o sistema de arquivos
    }
  });

  Menu.setApplicationMenu(null);
  win.loadFile('index.html');

  // --- LÓGICA DE TELA CHEIA (FULLSCREEN) ---
  ipcMain.on('toggle-fullscreen', () => {
    const isFullScreen = win.isFullScreen();
    win.setFullScreen(!isFullScreen);
  });

  autoUpdater.checkForUpdatesAndNotify();
  autoUpdater.on('update-downloaded', () => {
    autoUpdater.quitAndInstall(); 
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});