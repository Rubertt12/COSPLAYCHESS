const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, 'img/favicon-Photoroom.png'), // Caminho do seu ícone
    webPreferences: {
      nodeIntegration: false, // Segurança
      contextIsolation: true
    }
  });

  // Remove a barra de menu padrão (File, Edit, etc) para parecer um jogo
  Menu.setApplicationMenu(null);

  win.loadFile('index.html');

  // Abre em ecrã total se preferir
  // win.maximize();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});