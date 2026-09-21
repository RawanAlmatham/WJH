import type { BoardModule } from "./boardModules";
import type { PresentationSection } from "./presentationSections";

export const boardTemplates = [
  "work",
  "startup",
  "ecommerce",
  "personal-tasks",
  "travel",
] as const;

export type BoardTemplate = (typeof boardTemplates)[number];

export const templateNavigationKeys = [
  "home",
  "weekly",
  "plan",
  "projects",
  "tasks",
  "team",
  "feeds",
  "lessons",
  "launches",
  "calendar",
  "reports",
] as const;

export type TemplateNavigationKey = (typeof templateNavigationKeys)[number];

type StarterTask = {
  title: string;
  description: string;
  priority: "urgent" | "high" | "medium" | "low";
};

export const BOARD_TEMPLATE_LABELS: Record<
  BoardTemplate,
  {
    title: string;
    description: string;
    accent: string;
    softAccent: string;
    highlights: string[];
    modules: BoardModule[];
    sections: PresentationSection[];
    navigation: Record<TemplateNavigationKey, string>;
    starterTasks: StarterTask[];
  }
> = {
  work: {
    title: "قالب العمل",
    description: "إدارة فرق المشاريع ومتابعة الحملات والجداول التشغيلية.",
    accent: "#1E3A8A",
    softAccent: "#E9EDF7",
    highlights: [
      "أهداف وخطة سنوية",
      "مشاريع ومهام الفريق",
      "دروس وخلاصات بحثية",
    ],
    modules: [
      "plan",
      "projects",
      "tasks",
      "team",
      "feeds",
      "calendar",
      "lessons",
    ],
    sections: [
      "completion",
      "priorities",
      "attention",
      "upcoming",
      "team",
      "feeds",
    ],
    navigation: {
      home: "الرئيسية",
      weekly: "تحديث الأسبوع",
      plan: "الخطة السنوية",
      projects: "المشاريع",
      tasks: "المهام",
      team: "الفريق",
      feeds: "الخلاصات البحثية",
      lessons: "الدروس المستفادة",
      launches: "الإطلاقات",
      calendar: "التقويم",
      reports: "التقارير",
    },
    starterTasks: [
      {
        title: "تحديد أهداف الفريق لهذه الفترة",
        description:
          "اكتب النتائج التي تريد من الفريق الوصول إليها وحدد الأولويات.",
        priority: "high",
      },
      {
        title: "إضافة أول مشروع ومخرجاته",
        description: "حوّل الهدف الأهم إلى مشروع واضح وحدد مخرجاته الرئيسية.",
        priority: "medium",
      },
      {
        title: "دعوة أعضاء الفريق وتحديد الأدوار",
        description: "أضف أعضاء الفريق وحدد صلاحية كل عضو داخل اللوحة.",
        priority: "medium",
      },
    ],
  },
  startup: {
    title: "قالب شركة ناشئة",
    description: "إدارة خارطة المنتج والتجارب والنمو وإيقاع الفريق السريع.",
    accent: "#7A2E5C",
    softAccent: "#F5EAF0",
    highlights: ["رؤية وأهداف مرحلية", "خارطة المنتج", "تجارب وإطلاقات"],
    modules: ["plan", "projects", "tasks", "team", "calendar", "reports"],
    sections: [
      "completion",
      "priorities",
      "attention",
      "upcoming",
      "goals",
      "team",
    ],
    navigation: {
      home: "مركز الشركة",
      weekly: "تحديث الفريق",
      plan: "الرؤية والأهداف",
      projects: "خارطة المنتج",
      tasks: "سجل التنفيذ",
      team: "فريق الشركة",
      feeds: "رادار السوق",
      lessons: "نتائج التجارب",
      launches: "إطلاقات المنتج",
      calendar: "تقويم الشركة",
      reports: "مؤشرات النمو",
    },
    starterTasks: [
      {
        title: "صياغة فرضية المنتج والقيمة المقترحة",
        description:
          "حدد العميل المستهدف والمشكلة والقيمة التي يقدمها المنتج بوضوح.",
        priority: "high",
      },
      {
        title: "تحديد نطاق الإصدار الأول",
        description: "اختر أقل مجموعة خصائص تكفي لاختبار الفرضية مع العملاء.",
        priority: "high",
      },
      {
        title: "اختيار مؤشرات النمو للأسبوع",
        description:
          "حدد المقاييس التي سيتابعها الفريق مثل التفعيل والاحتفاظ والتحويل.",
        priority: "medium",
      },
    ],
  },
  ecommerce: {
    title: "قالب تجارة إلكترونية",
    description:
      "إدارة المنتجات والعروض والمتابعات اليومية للعمليات التشغيلية.",
    accent: "#45613F",
    softAccent: "#E9EDE4",
    highlights: ["تشغيل المتجر", "حملات وعروض", "تقارير الأداء"],
    modules: ["tasks", "projects", "calendar", "team", "reports"],
    sections: ["completion", "projects", "attention", "upcoming", "team"],
    navigation: {
      home: "ملخص المتجر",
      weekly: "متابعة التشغيل",
      plan: "خطة النمو",
      projects: "الحملات والمبادرات",
      tasks: "عمليات المتجر",
      team: "فريق المتجر",
      feeds: "رصد السوق",
      lessons: "تحسينات المتجر",
      launches: "العروض والمواسم",
      calendar: "تقويم المتجر",
      reports: "تقارير الأداء",
    },
    starterTasks: [
      {
        title: "مراجعة جاهزية المنتجات والمخزون",
        description:
          "تحقق من توفر المنتجات والأسعار والصور ووصف صفحات المنتجات.",
        priority: "high",
      },
      {
        title: "تجهيز الحملة أو العرض القادم",
        description: "حدد العرض والجمهور وقنوات التسويق وتاريخ الإطلاق.",
        priority: "high",
      },
      {
        title: "متابعة الطلبات وخدمة العملاء",
        description:
          "راجع الطلبات المتأخرة والاسترجاعات والاستفسارات المفتوحة.",
        priority: "medium",
      },
    ],
  },
  "personal-tasks": {
    title: "قالب متابعة مهام شخصية",
    description: "تنظيم مهامك اليومية والتخطيط الأسبوعي والمراجعات السريعة.",
    accent: "#896400",
    softAccent: "#FFF3CC",
    highlights: ["أولويات يومية", "تخطيط أسبوعي", "مراجعة الإنجاز"],
    modules: ["plan", "tasks", "calendar", "reports"],
    sections: ["completion", "priorities", "attention", "upcoming"],
    navigation: {
      home: "يومي",
      weekly: "مراجعة الأسبوع",
      plan: "أهدافي",
      projects: "مشاريعي",
      tasks: "مهامي",
      team: "المشاركون",
      feeds: "مصادري",
      lessons: "ملاحظاتي",
      launches: "المواعيد المهمة",
      calendar: "تقويمي",
      reports: "إنجازي",
    },
    starterTasks: [
      {
        title: "كتابة أهم ثلاث أولويات",
        description: "اختر ثلاث نتائج مهمة تريد إنجازها خلال هذا الأسبوع.",
        priority: "high",
      },
      {
        title: "ترتيب مهام اليوم",
        description: "قسّم أولوياتك إلى خطوات قصيرة قابلة للتنفيذ.",
        priority: "medium",
      },
      {
        title: "تحديد موعد المراجعة الأسبوعية",
        description:
          "احجز وقتًا ثابتًا لمراجعة ما أُنجز وتجهيز الأسبوع التالي.",
        priority: "low",
      },
    ],
  },
  travel: {
    title: "قالب تنظيم الرحلات",
    description:
      "رتّب حجوزات الرحلة وبرنامج كل يوم والمهام المشتركة في مكان واحد.",
    accent: "#0F766E",
    softAccent: "#E6F4F1",
    highlights: ["برنامج يومي", "حجوزات وتنقلات", "قائمة تجهيز"],
    modules: ["plan", "projects", "tasks", "team", "calendar"],
    sections: ["priorities", "attention", "upcoming", "team"],
    navigation: {
      home: "ملخص الرحلة",
      weekly: "استعدادات الرحلة",
      plan: "خطة الرحلة",
      projects: "محطات الرحلة",
      tasks: "قائمة التجهيز",
      team: "المسافرون",
      feeds: "دليل الوجهات",
      lessons: "ملاحظات الرحلة",
      launches: "الحجوزات",
      calendar: "برنامج الرحلة",
      reports: "ملخص الرحلة",
    },
    starterTasks: [
      {
        title: "تثبيت حجوزات الطيران والسكن",
        description:
          "اجمع أرقام الحجوزات ومواعيد الوصول والمغادرة في مكان واحد.",
        priority: "high",
      },
      {
        title: "بناء البرنامج اليومي للرحلة",
        description:
          "أضف الأنشطة والتنقلات والحجوزات لكل يوم وحدد أوقاتها ومواقعها.",
        priority: "high",
      },
      {
        title: "تجهيز المستندات والأمتعة",
        description:
          "راجع الجوازات والتأشيرات والتأمين وقائمة الأغراض قبل المغادرة.",
        priority: "medium",
      },
    ],
  },
} as const;

export const DEFAULT_BOARD_TEMPLATE: BoardTemplate = "work";
