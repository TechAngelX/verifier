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

      // 2 — FALSE mismatch (bytecode with hidden 'I')
      win.webContents.send('demo', {
        a: '0x606060405260043610610196576000357c0100000000000000000000000000000000000000000000000000000000900463ffffffff16806306fdde031461019b5780630753c30c14610229578063095ea7b3146102625780630e136b19146102a45780630ecb93c0146102d157806318160ddd1461030a57806323b872dd1461033357806326976e3f1461039457806327e235e3146103e9578063313ce56714610436578063353907141461045f5780633eaaf86b146104885780633f4ba83a146104b157806359bf1abe146104c65780635c658165146105175780635c975abb1461058357806370a08231146105b05780638456cb59146105fd578063893d20e8146106125780638da5cb5b1461066757806395d89b41146106bc578063a9059cbb1461074a578063c0324c771461078c578063cc872b66146107b8578063db006a75146107db578063dd62ed3e146107fe578063dd644f721461086a578063e47d606014610893578063e4997dc5146108e4578063e5b5019a1461091d578063f2fde38b14610946578063f3bdc2281461097f575b600080fd5b34156101a657600080fd5b6101ae6109b8565b6040518080602001828103825283818151815260200191508051906020019080838360005b',
        b: '0x606060405260043610610196576000357c0100000000000000000000000000000000000000000000000000000000900463ffffffff16806306fdde031461019b5780630753c30c14610229578063095ea7b3146102625780630e136b19146102a45780630ecb93c0146102d157806318160ddd1461030a57806323b872dd1461033357806326976e3f1461039457806327e235e3146103e9578063313ce56714610436578063353907141461045f5780633eaaf86b146104885780633f4ba83a146104b157806359bf1abe146104c65780635c658165146105175780635c975abb1461058357806370a08231146105b05780638456cb59146105fd578063893d20e8146106125780638da5cb5b1461066757806395d89b41146106bc578063a9059cbb1461074a578063c0324c771461078c578063cc872b66146107b8578063db006a75146107db578063dd62ed3e146107fe578063dd644f721461086a578063e47d606014610893578063e4997dc5146108e4578063e5b5019a1461091d578063f2fde38b14610946578063f3bdc2281461097f575b600080fd5b34156101a657600080fd5b6101ae6109b8565b604051808060200182810382528381815I1815260200191508051906020019080838360005b'
      });
      await capture('02-match.png');

      // 3 — FALSE mismatch (text)
      win.webContents.send('demo', {
        a: 'The quick brown fox jumps over the lazy dog.\nVersion: v2.4.1\nHash: 0xDEADBEEF',
        b: 'The quick brown fox jumps over the lazy cat.\nVersion: v2.4.0\nHash: 0xDEADBEEF'
      });
      await capture('03-mismatch.png');

      // 4 — diff view with highlighted lines
      win.webContents.send('demo', {
        a: 'The quick brown fox jumps over the lazy dog.\nVersion: v2.4.1\nHash: 0xDEADBEEF\nStatus: active\nRegion: us-west-1',
        b: 'The quick brown fox jumps over the lazy cat.\nVersion: v2.4.0\nHash: 0xDEADBEEF\nStatus: active\nRegion: us-east-2\nExtra: new line here',
        view: 'diff'
      });
      await capture('04-diffview.png');

      // 5 — checksum view: same size, one byte different
      const base = 'MZ\x90\x00PE\x00\x00installer-payload-'.repeat(40);
      win.webContents.send('demo', {
        files: {
          a: { name: 'CoolApp-Setup-1.4.2.exe', content: base + 'X' },
          b: { name: 'CoolApp-Setup-1.4.2.exe', content: base + 'Y' }
        },
        view: 'checksum'
      });
      await capture('05-checksum.png');

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
