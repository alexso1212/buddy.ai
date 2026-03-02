import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.deltapex.buddy',
  appName: 'Buddy',
  webDir: 'dist/public',

  server: {
    // TODO: Replace with your actual deployed domain (check App Store Connect or Replit deployment URL)
    url: 'https://workspace-s1155035208.replit.app',
    cleartext: true,
  },

  ios: {
    contentInset: 'always',
    allowsLinkPreview: false,
    backgroundColor: '#1A1918',
    preferredContentMode: 'mobile',
    scrollEnabled: true,
  },

  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#1A1918',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#1A1918',
      showSpinner: false,
    },
  },
};

export default config;
