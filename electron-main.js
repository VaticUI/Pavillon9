const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 900,
    fullscreen: true,
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    title: 'Pavillon 9',
    webPreferences: { contextIsolation: true, backgroundThrottling: false },
  });
  win.setMenu(null);
  win.loadFile(path.join(__dirname, 'index.html'));
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
    if (input.key === 'F4' && input.alt) app.quit();
  });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
