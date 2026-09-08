import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "io.aidept.athr",
  appName: "أثر",
  webDir: "dist/public",
  server: {
    url: "https://athr.aidept.io",
    cleartext: false,
  },
  ios: {
    backgroundColor: "#F7F9FC",
    contentInset: "always",
  },
  android: {
    backgroundColor: "#F7F9FC",
  },
};

export default config;
