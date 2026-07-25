import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.tradnestea',
  appName: 'TradeNest EA',
  webDir: 'dist',
  server: {
    // Load the live published site inside the native shell.
    // Remove `url` and use `webDir` if you want a fully offline bundled build.
    url: 'https://tradnestea.app',
    cleartext: false,
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
