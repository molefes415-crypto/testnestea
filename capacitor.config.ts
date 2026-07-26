import type { CapacitorConfig } from '@capacitor/cli';

// Fully offline / bundled build:
// The web assets from `dist/` are packaged into the APK and loaded locally.
// No remote URL is fetched at startup — the app runs entirely from bundled files.
const config: CapacitorConfig = {
  appId: 'app.tradnestea',
  appName: 'TradeNest EA',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
};

export default config;
