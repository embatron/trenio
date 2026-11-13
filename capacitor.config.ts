import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "by.trenio.app",
  appName: "trenio",
  webDir: "mobile/www",
  server: {
    url: "https://trenio.by",
    cleartext: false,
    allowNavigation: ["trenio.by", "www.trenio.by", "accounts.google.com", "oauth.yandex.ru"],
    appendUserAgent: "Trenio-iOS/1.0",
  },
  ios: {
    path: "mobile/ios",
    contentInset: "automatic",
    limitsNavigationsToAppBoundDomains: true,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: "#fff5f5",
      showSpinner: false,
    },
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#f04b50",
    },
    Keyboard: {
      resize: "native",
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    CapacitorCookies: {
      enabled: true,
    },
  },
};

export default config;
