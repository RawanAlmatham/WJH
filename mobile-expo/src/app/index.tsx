import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  BackHandler,
  Image,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import * as WebBrowser from "expo-web-browser";
import * as Crypto from "expo-crypto";
import * as Updates from "expo-updates";
import { useFonts } from "expo-font";
import { navigationKind, parseAuthCallback, SITE_URL } from "../lib/navigation";

type Source = {
  uri: string;
  method?: "POST";
  body?: string;
  headers?: Record<string, string>;
};
export default function Home() {
  const web = useRef<WebView>(null);
  const authBusy = useRef(false);
  const canBack = useRef(false);
  const mounted = useRef(true);
  const [source, setSource] = useState<Source>({ uri: SITE_URL });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [updateBusy, setUpdateBusy] = useState(false);
  const [fontLoaded] = useFonts({
    Wjh: require("../../assets/IBMPlexSansArabic-Bold.ttf"),
  });
  useEffect(() => {
    mounted.current = true;
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      if (canBack.current) {
        web.current?.goBack();
        return true;
      }
      return false;
    });
    const foreground = AppState.addEventListener("change", value => {
      if (value === "active" && error) web.current?.reload();
    });
    return () => {
      mounted.current = false;
      back.remove();
      foreground.remove();
    };
  }, [error]);
  function retry() {
    setError(false);
    setSource({ uri: SITE_URL });
    web.current?.reload();
  }
  async function login() {
    if (authBusy.current) return;
    authBusy.current = true;
    setAuthLoading(true);
    try {
      const verifier = (Crypto.randomUUID() + Crypto.randomUUID()).replaceAll(
        "-",
        ""
      );
      const state = (Crypto.randomUUID() + Crypto.randomUUID()).replaceAll(
        "-",
        ""
      );
      const challenge = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        verifier
      );
      const result = await WebBrowser.openAuthSessionAsync(
        SITE_URL +
          "/auth/mobile/start?" +
          new URLSearchParams({ challenge, state }),
        "wijha://auth"
      );
      if (result.type === "success") {
        const code = parseAuthCallback(result.url, state);
        if (mounted.current) {
          setError(false);
          setSource({
            uri: SITE_URL + "/auth/mobile/consume",
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ code, verifier }).toString(),
          });
        }
      }
    } catch {
      Alert.alert("تعذر تسجيل الدخول", "حاول مرة أخرى من داخل التطبيق.");
    } finally {
      authBusy.current = false;
      if (mounted.current) setAuthLoading(false);
    }
  }
  async function checkUpdate() {
    if (updateBusy) return;
    setUpdateBusy(true);
    try {
      web.current?.reload();
      if (Updates.isEnabled) {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          Alert.alert(
            "تحديث وجهة جاهز",
            "يمكنك إعادة تشغيل التطبيق الآن لتطبيق التحديث.",
            [
              { text: "لاحقًا", style: "cancel" },
              {
                text: "تحديث الآن",
                onPress: () => {
                  void Updates.reloadAsync().catch(() =>
                    Alert.alert("تعذر التحديث", "أغلق التطبيق وافتحه مجددًا.")
                  );
                },
              },
            ]
          );
        } else
          Alert.alert("وجهة محدثة", "تحديثات القوالب تظهر تلقائيًا عند فتحها.");
      } else
        Alert.alert(
          "تم تحديث القوالب",
          "تحديث التطبيق نفسه يتاح بعد ربط النسخة بحساب Expo."
        );
    } catch {
      Alert.alert("تعذر التحقق", "تأكد من اتصالك وحاول مرة أخرى.");
    } finally {
      if (mounted.current) setUpdateBusy(false);
    }
  }
  const titleFont = fontLoaded ? { fontFamily: "Wjh" } : {};
  return (
    <SafeAreaView style={styles.shell} edges={["top", "bottom"]}>
      <View style={styles.toolbar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="تحديث وجهة"
          disabled={updateBusy || authLoading}
          onPress={() => void checkUpdate()}
          style={styles.control}
        >
          <Text style={styles.action}>{updateBusy ? "…" : "تحديث"}</Text>
        </Pressable>
        <View style={styles.brand}>
          <Text style={[styles.brandText, titleFont]}>وجهة</Text>
          <Image
            source={require("../../assets/splash.png")}
            style={styles.symbol}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="رجوع"
          disabled={authLoading}
          onPress={() => {
            if (canBack.current) web.current?.goBack();
            else setSource({ uri: SITE_URL });
          }}
          style={styles.control}
        >
          <Text style={styles.action}>رجوع ›</Text>
        </Pressable>
      </View>
      <View style={styles.content}>
        <WebView
          ref={web}
          source={source}
          style={styles.web}
          originWhitelist={["https://wijha.ralmatham.ai"]}
          sharedCookiesEnabled
          thirdPartyCookiesEnabled={false}
          javaScriptEnabled
          domStorageEnabled
          allowsBackForwardNavigationGestures
          allowsInlineMediaPlayback
          setSupportMultipleWindows={false}
          mixedContentMode="never"
          onShouldStartLoadWithRequest={request => {
            const kind = navigationKind(request.url);
            if (kind === "internal") return true;
            if (kind === "login") {
              void login();
              return false;
            }
            if (kind === "external") {
              void Linking.openURL(request.url).catch(() =>
                Alert.alert("تعذر فتح الرابط")
              );
            }
            return false;
          }}
          onOpenWindow={event => {
            const url = event.nativeEvent.targetUrl;
            if (navigationKind(url) === "external")
              void Linking.openURL(url).catch(() =>
                Alert.alert("تعذر فتح الرابط")
              );
          }}
          onNavigationStateChange={nav => {
            canBack.current = nav.canGoBack;
            if (nav.url === SITE_URL + "/") {
              setSource(current =>
                current.method ? { uri: SITE_URL } : current
              );
            }
          }}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={() => {
            setError(true);
            setLoading(false);
          }}
          onHttpError={event => {
            if (
              event.nativeEvent.statusCode >= 500 ||
              event.nativeEvent.statusCode === 401
            ) {
              setError(true);
              setLoading(false);
            }
          }}
          mediaCapturePermissionGrantType="prompt"
        />
        {(loading || authLoading) && !error && (
          <View pointerEvents="none" style={styles.loading}>
            <ActivityIndicator color="#1E3A8A" />
            <Text style={styles.muted}>
              {authLoading ? "جارٍ تسجيل الدخول…" : "جارٍ فتح وجهة…"}
            </Text>
          </View>
        )}
        {error && (
          <View style={styles.error}>
            <Image
              source={require("../../assets/splash.png")}
              style={styles.errorSymbol}
            />
            <Text style={[styles.heading, titleFont]}>نرجع لوجهة؟</Text>
            <Text style={styles.description}>
              تعذر الاتصال. تأكد من الإنترنت ثم أعد المحاولة.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={retry}
              style={styles.primary}
            >
              <Text style={styles.primaryText}>إعادة المحاولة</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => void login()}
              style={styles.control}
            >
              <Text style={styles.action}>تسجيل الدخول مجددًا</Text>
            </Pressable>
          </View>
        )}
      </View>
      {Platform.OS === "web" && (
        <Text style={styles.muted}>
          شغّل نسخة iOS أو أندرويد لمعاينة التطبيق.
        </Text>
      )}
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: "#F5F2EE" },
  toolbar: {
    height: 54,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#E4E1DA",
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandText: { fontSize: 24, color: "#1E3A8A" },
  symbol: { width: 25, height: 25, resizeMode: "contain" },
  control: {
    minWidth: 64,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  action: { color: "#1E3A8A", fontSize: 13 },
  content: { flex: 1 },
  web: { flex: 1, backgroundColor: "#F5F2EE" },
  loading: {
    position: "absolute",
    top: 8,
    alignSelf: "center",
    padding: 10,
    borderRadius: 12,
    backgroundColor: "#F5F2EE",
    alignItems: "center",
    gap: 4,
  },
  muted: { color: "#62635F", fontSize: 12, textAlign: "center" },
  error: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#F5F2EE",
    justifyContent: "center",
    alignItems: "center",
    padding: 28,
    gap: 18,
  },
  errorSymbol: { width: 72, height: 72, resizeMode: "contain" },
  heading: { fontSize: 25, color: "#1E3A8A" },
  description: { textAlign: "center", color: "#62635F", lineHeight: 25 },
  primary: {
    backgroundColor: "#1E3A8A",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 28,
  },
  primaryText: { color: "#fff", fontSize: 16 },
});
