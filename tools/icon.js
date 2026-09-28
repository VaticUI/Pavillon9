// Génère build/icon.png (256x256) via un canvas dans Electron
const { app, BrowserWindow } = require('electron');
const fs = require('fs'), path = require('path');
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false });
  await win.loadURL('data:text/html,<canvas id=c width=256 height=256></canvas>');
  const url = await win.webContents.executeJavaScript(`(() => {
    const c = document.getElementById('c'), x = c.getContext('2d');
    const g = x.createRadialGradient(128, 110, 10, 128, 128, 170);
    g.addColorStop(0, '#2a0505'); g.addColorStop(1, '#000');
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    x.font = 'bold 220px Georgia'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.shadowColor = '#ff1a1a'; x.shadowBlur = 30; x.fillStyle = '#9a0c0c'; x.fillText('9', 128, 140);
    x.shadowBlur = 0; x.fillStyle = 'rgba(255,255,255,0.9)';
    x.beginPath(); x.arc(118, 124, 4, 0, 7); x.arc(140, 124, 4, 0, 7); x.fill();
    return c.toDataURL('image/png');
  })()`);
  fs.writeFileSync(path.join(__dirname, '..', 'build', 'icon.png'), Buffer.from(url.split(',')[1], 'base64'));
  app.quit();
});
