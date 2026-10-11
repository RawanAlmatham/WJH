import type { ExpoConfig, ConfigContext } from "expo/config";
export default ({ config }: ConfigContext): ExpoConfig => {
  const projectId = process.env.EAS_PROJECT_ID || "0bdc81f4-8644-4f81-9c4b-41992b8d9d3f";
  if (projectId && !/^[a-f0-9-]{36}$/i.test(projectId))
    throw new Error("EAS_PROJECT_ID must be the Expo project UUID");
  return {
    ...config,
    name: "وجهة",
    slug: "wijha",
    owner: "ralmatham",
    scheme: "wijha",
    version: "1.0.0",
    orientation: "portrait",
    userInterfaceStyle: "light",
    icon: "./assets/icon.png",
    ios: {
      supportsTablet: true,
      bundleIdentifier: "io.ralmatham.wjh",
      infoPlist: {
        NSMicrophoneUsageDescription:
          "يستخدم وجهة الميكروفون فقط عند اختيار تسجيل طلب صوتي.",
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      package: "io.ralmatham.wjh",
      permissions: ["android.permission.RECORD_AUDIO"],
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#F5F2EE",
      },
    },
    plugins: [
      "expo-router",
      "expo-web-browser",
      "expo-font",
      [
        "expo-splash-screen",
        {
          image: "./assets/splash.png",
          imageWidth: 140,
          backgroundColor: "#F5F2EE",
        },
      ],
    ],
    runtimeVersion: { policy: "fingerprint" },
    updates: projectId
      ? { url: `https://u.expo.dev/${projectId}`, fallbackToCacheTimeout: 0 }
      : { enabled: false },
    extra: { ...config.extra, ...(projectId ? { eas: { projectId } } : {}) },
  };
};
