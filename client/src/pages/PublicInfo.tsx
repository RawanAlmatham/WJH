import { ArrowRight, Mail, ShieldCheck } from "lucide-react";

const updatedAt = "8 سبتمبر 2026";

function PageShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#F7F9FC] px-5 py-10 text-[#26364A] sm:px-8"
    >
      <div className="mx-auto max-w-3xl">
        <a
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#52769F] hover:underline"
        >
          <ArrowRight className="size-4" /> العودة إلى أثر
        </a>
        <article className="mt-6 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-10">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-[#EDF4FA] text-[#52769F]">
            <ShieldCheck className="size-6" />
          </div>
          <h1 className="mt-5 text-3xl font-bold">{title}</h1>
          <p className="mt-3 leading-8 text-slate-600">{description}</p>
          <p className="mt-2 text-xs text-slate-400">آخر تحديث: {updatedAt}</p>
          <div className="mt-8 space-y-8 text-sm leading-8 text-slate-700">
            {children}
          </div>
        </article>
      </div>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-lg font-bold text-[#344B64]">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

export function Privacy() {
  return (
    <PageShell
      title="سياسة الخصوصية"
      description="توضح هذه السياسة البيانات التي تحتاجها منصة أثر لتقديم خدمة إدارة العمل الداخلية وكيفية التعامل معها."
    >
      <Section title="البيانات التي نعالجها">
        <p>
          نعالج بيانات الحساب الأساسية مثل الاسم والبريد الإلكتروني، إضافة إلى
          بيانات العمل التي يدخلها المستخدم داخل اللوحات، ومنها المشاريع والمهام
          والتعليقات والروابط وحالة الإنجاز.
        </p>
      </Section>
      <Section title="لماذا نستخدم البيانات؟">
        <p>
          تُستخدم البيانات لتسجيل الدخول، وإدارة صلاحيات الوصول، وتشغيل مزايا
          المنصة، وإظهار العمل لأعضاء اللوحة المصرح لهم، وتحسين موثوقية الخدمة
          وأمانها.
        </p>
      </Section>
      <Section title="المشاركة والوصول">
        <p>
          لا تبيع أثر البيانات ولا تستخدمها للإعلانات. لا تظهر بيانات اللوحة إلا
          للمستخدمين الذين مُنحوا صلاحية الوصول إليها، وقد تُعالج البيانات لدى
          مزودي الاستضافة والتشغيل بالقدر اللازم لتقديم الخدمة.
        </p>
      </Section>
      <Section title="الاحتفاظ والحذف">
        <p>
          تُحفظ البيانات ما دام الحساب أو مساحة العمل قائمة أو بحسب احتياج الجهة
          المشغلة. يمكن لمدير اللوحة إدارة الأعضاء والمحتوى، ويمكن طلب حذف
          البيانات أو تصحيحها عبر قناة الدعم.
        </p>
      </Section>
      <Section title="الأمان">
        <p>
          تُطبق ضوابط وصول وإجراءات تشغيلية لحماية البيانات. وعلى المستخدم
          المحافظة على سرية بيانات دخوله وإبلاغ الدعم عند الاشتباه بأي استخدام
          غير مصرح به.
        </p>
      </Section>
      <Section title="التواصل">
        <p>
          للاستفسارات المتعلقة بالخصوصية تواصل عبر{" "}
          <a
            className="font-semibold text-[#52769F] hover:underline"
            href="mailto:ralmatham@ksaa.gov.sa"
          >
            ralmatham@ksaa.gov.sa
          </a>
          .
        </p>
      </Section>
    </PageShell>
  );
}

export function Support() {
  return (
    <PageShell
      title="دعم أثر"
      description="نساعدك في مشاكل الدخول والدعوات والصلاحيات واستخدام اللوحات والمشاريع والمهام."
    >
      <Section title="قبل التواصل">
        <ul className="list-disc space-y-2 pr-5">
          <li>تأكد أنك تستخدم البريد الذي وصلت إليه الدعوة.</li>
          <li>حدّث التطبيق أو الصفحة ثم أعد تسجيل الدخول.</li>
          <li>
            اذكر اسم اللوحة والخطوة التي سبقت المشكلة، وأرفق صورة للشاشة إن
            أمكن.
          </li>
        </ul>
      </Section>
      <Section title="التواصل مع الدعم">
        <a
          className="inline-flex items-center gap-2 rounded-xl bg-[#52769F] px-5 py-3 font-semibold text-white hover:bg-[#46698F]"
          href="mailto:ralmatham@ksaa.gov.sa?subject=دعم%20منصة%20أثر"
        >
          <Mail className="size-4" /> ralmatham@ksaa.gov.sa
        </a>
        <p className="mt-3 text-xs text-slate-500">
          أرسل وصف المشكلة واسم اللوحة ونوع الجهاز، وتجنب إرسال كلمة المرور.
        </p>
      </Section>
    </PageShell>
  );
}
