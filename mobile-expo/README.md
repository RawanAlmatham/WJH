# تطبيق وجهة — Expo

تطبيق iOS وأندرويد متصل بـ https://wijha.ralmatham.ai، بنفس الحساب واللوحات والبيانات. يعرض القوالب المنشورة من الموقع داخل WebView؛ لا يحتوي نسخة منفصلة من بيانات المهام، ويحتاج اتصال إنترنت.

المشروع: https://expo.dev/accounts/ralmatham/projects/wijha
معرّف التطبيق للنظامين: `io.ralmatham.wjh`، والرابط الداخلي: `wijha://`.

## التشغيل والفحص

```sh
cd mobile-expo
npm ci
npm run check
npm run lint
npx expo-doctor
npm start
```

يمكن معاينة الواجهة في Expo Go. العودة من تسجيل Google تعتمد على scheme التطبيق، لذلك اختبار الدخول الكامل يحتاج development build أو النسخة التجريبية المثبتة.

## النسخ التجريبية والمتاجر

```sh
npx eas-cli@latest build --profile preview --platform android
npx eas-cli@latest build --profile simulator --platform ios
npx eas-cli@latest build --profile preview --platform ios
npx eas-cli@latest build --profile production --platform all
```

APK للأندرويد، نسخة simulator للماك، ونسخة iPhone الفعلية تحتاج شهادات Apple وتسجيل الجهاز أو TestFlight. إصدار المتجر يحتاج حسابَي Apple Developer وGoogle Play، ومراجعة وصف التطبيق وسياسة الخصوصية والتوقيع. لا تستبدل مفتاح توقيع تطبيق منشور مسبقًا: استخدم نفس توقيعه ورقم بناء أعلى للترقية.

## تحديث القوالب والتطبيق

- القوالب: يُنشر تعديل الموقع بالطريقة المعتادة؛ يظهر للمستخدم عند فتح أو تحديث وجهة. لا يلزم رفع تطبيق جديد لتعديل قالب.
- واجهة Expo وJavaScript المتوافقة: جرّب أولًا على قناة preview ثم production:

```sh
npx eas-cli@latest update --channel preview --message "وصف التحديث" --environment preview
npx eas-cli@latest update --channel production --message "وصف التحديث" --environment production
```

- مكونات أصلية جديدة، أذونات، أو إعدادات توقيع: بناء جديد. سياسة `fingerprint` تمنع وصول تحديث إلى إصدار غير متوافق.
- زر «تحديث» يعيد تحميل القوالب، ويتحقق من تحديث Expo المتوافق؛ يعرض خيار إعادة تشغيل بعد تنزيله. التحقق التلقائي على تشغيل التطبيق مضبوط بواسطة expo-updates.

## تسجيل الدخول

Google يفتح في متصفح النظام. يستخدم الخادم رمزًا عشوائيًا لمرة واحدة وصالحًا لـ٩٠ ثانية، مرتبطًا بمفتاح تحقق خاص بالتطبيق. يستبدله WebView عبر POST بملف جلسة HttpOnly؛ لا يُرسل JWT في رابط العودة ولا يُخزّن في كود التطبيق. رابط العودة يُقبل فقط إذا طابق حالة طلب الدخول الجاري.

الأسرار تبقى على الخادم. معرّف EAS ليس سرًا. `.easignore` في جذر المستودع يقصر رفع EAS على ملفات التطبيق.

## تحقق قبل إطلاق المتاجر

اختبار الدخول والعودة، الخروج وإعادة الدخول، كل القوالب، تغيير اللوحة، التسجيل الصوتي بإذن المستخدم، روابط الموارد، زر رجوع أندرويد، انقطاع الإنترنت وإعادة المحاولة، وترقية نسخة تجريبية بتحديث preview. السماح بالميكروفون مرتبط بالتسجيل الذي يبدأه المستخدم؛ لا يُطلب في بداية تشغيل التطبيق.
