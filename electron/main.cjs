const { app, BrowserWindow, Tray, Menu, nativeImage, globalShortcut, ipcMain } = require('electron');
const path = require('path');

let mainWindow = null;
let tray = null;
let isQuitting = false;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
try {
  if (require('electron-squirrel-startup')) {
    app.quit();
  }
} catch (e) {}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#090d16',
    title: 'HMD Music',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      // Crucial: do not throttle background timers or audio when window is minimized or hidden!
      backgroundThrottling: false,
    },
  });

  const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Minimize to tray instead of closing completely so background music keeps playing!
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      if (tray) {
        tray.displayBalloon?.({
          title: 'HMD Music',
          content: 'L\'application continue de jouer en arrière-plan ici.',
        });
      }
    }
    return false;
  });

  createTray();
  registerShortcuts();
}

function createTray() {
  if (tray) return;

  // App logo for system tray
  const iconPath = path.join(__dirname, '../public/assets/aistudio/Capture_d__cran_2026-11-22_124349_7f2ff4ca.png');
  let trayIcon;
  try {
    trayIcon = nativeImage.createFromPath(iconPath);
  } catch (e) {
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('HMD Music — Lecteur en arrière-plan');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Afficher HMD Music',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Lecture / Pause',
      click: () => {
        mainWindow?.webContents.executeJavaScript(`
          if (navigator.mediaSession) {
            const ev = new KeyboardEvent('keydown', { key: ' ' });
            window.dispatchEvent(ev);
          }
        `);
      },
    },
    {
      label: 'Morceau suivant',
      click: () => {
        mainWindow?.webContents.executeJavaScript(`
          if (navigator.mediaSession) {
            window.dispatchEvent(new CustomEvent('hmd-next-track'));
          }
        `);
      },
    },
    { type: 'separator' },
    {
      label: 'Quitter',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

let customPauseAccelerator = null;

function convertWebKeyToAccelerator(webKey) {
  if (!webKey) return null;
  if (webKey === 'Space') return 'Space';
  if (webKey.startsWith('Key')) return webKey.replace('Key', '');
  if (webKey.startsWith('Digit')) return webKey.replace('Digit', '');
  if (webKey.startsWith('Numpad')) return webKey.replace('Numpad', 'Num');
  return webKey;
}

function registerShortcuts() {
  // Global hardware media keys for Windows background playback
  try {
    globalShortcut.register('MediaPlayPause', () => {
      mainWindow?.webContents.send('media-play-pause');
    });
    globalShortcut.register('MediaNextTrack', () => {
      mainWindow?.webContents.send('media-next');
    });
    globalShortcut.register('MediaPreviousTrack', () => {
      mainWindow?.webContents.send('media-prev');
    });
  } catch (e) {
    console.warn('Could not register global media shortcuts:', e);
  }

  // Handle user-configured custom pause/play shortcut from Settings
  ipcMain.on('set-custom-pause-shortcut', (_event, key) => {
    if (customPauseAccelerator) {
      try {
        globalShortcut.unregister(customPauseAccelerator);
      } catch (e) {}
      customPauseAccelerator = null;
    }

    if (!key) return;
    const accel = convertWebKeyToAccelerator(key);
    if (!accel) return;

    try {
      const ok = globalShortcut.register(accel, () => {
        mainWindow?.webContents.send('media-play-pause');
      });
      if (ok) {
        customPauseAccelerator = accel;
        console.log('Registered custom global background shortcut:', accel);
      }
    } catch (err) {
      console.warn('Could not register custom shortcut:', accel, err);
    }
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow?.show();
    }
  });
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Keep alive in tray if minimized
    if (isQuitting) {
      app.quit();
    }
  }
});
