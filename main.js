const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const isScreenshot = process.argv.includes('--screenshot');

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 700,
    minWidth: 800,
    minHeight: 500,
    title: 'Verifier',
    backgroundColor: '#060908',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile('index.html');

  if (isScreenshot) {
    win.webContents.once('did-finish-load', async () => {
      const imgDir = path.join(__dirname, 'readme_images');
      fs.mkdirSync(imgDir, { recursive: true });

      const delay = (ms) => new Promise(r => setTimeout(r, ms));
      const capture = async (name) => {
        await delay(500);
        const img = await win.webContents.capturePage();
        fs.writeFileSync(path.join(imgDir, name), img.toPNG());
        console.log(`saved ${name}`);
      };

      // 1 — empty state
      await capture('01-empty.png');

      // 2 — TRUE match (hash)
      win.webContents.send('demo', {
        a: '0x1bbf85b12e187b726d2d444d8baab23da851a636ffed75934b89057a39064000',
        b: '0x1bbf85b12e187b726d2d444d8baab23da851a636ffed75934b89057a39064000'
      });
      await capture('02-match.png');

      // 3 — FALSE mismatch (text)
      win.webContents.send('demo', {
        a: 'The quick brown fox jumps over the lazy dog.\nVersion: v2.4.1\nHash: 0xDEADBEEF',
        b: 'The quick brown fox jumps over the lazy cat.\nVersion: v2.4.0\nHash: 0xDEADBEEF'
      });
      await capture('03-mismatch.png');

      app.quit();
    });
  }

  return win;
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
