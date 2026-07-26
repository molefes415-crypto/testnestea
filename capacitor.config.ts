import type { CapacitorConfig } from '@capacitor/cli';

// Fully offline / bundled build:
// The web assets from `dist/` are packaged into the APK and loaded locally.
// No remote URL is fetched at startup — the app runs entirely from bundled files.
const config: CapacitorConfig = {
  appId: 'app.tradnestea',
  appName: 'TradeNest EA',
  webDir: 'dist',
  // Prevent the black frame between the OS launch and the WebView's first paint.
  // The native splash is drawn by Android immediately on launch and only fades
  // once the WebView has actually rendered the app.
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,           // don't force any extra delay
      launchAutoHide: false,           // we hide it ourselves after first paint
      backgroundColor: '#000000',      // matches the app background — no white flash
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#000000',
    },
  },
  android: {
    allowMixedContent: false,
    // Force a black window background so the moment before WebView paint is black,
    // not the default white — kills the flash-of-white on cold start.
    backgroundColor: '#000000',
  },
};

export default config;
