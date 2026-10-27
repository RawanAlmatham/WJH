import type { BoardModule } from "./boardModules";
import type { PresentationSection } from "./presentationSections";

/** Published products. Each template owns its own workflow and data model. */
export const boardTemplates = [
  "personal",
  "idea_lab",
  "commerce_import",
  "business",
] as const;

export type BoardTemplate = (typeof boardTemplates)[number] | string;

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

export type BoardTemplateConfig = {
  title: string;
  description: string;
  accent: string;
  softAccent: string;
  highlights: string[];
  modules: BoardModule[];
  sections: PresentationSection[];
  navigation: Record<TemplateNavigationKey, string>;
  starterTasks: Array<{
    title: string;
    description: string;
    priority: "urgent" | "high" | "medium" | "low";
  }>;
};

export const BOARD_TEMPLATE_LABELS: Record<string, BoardTemplateConfig> = {
  business: {
    title: "إدارة الأعمال",
    description:
      "مساحة بسيطة تجمع المال والمنتجات والموردين والوثائق والمهام وبنك الأفكار.",
    accent: "#205844",
    softAccent: "#EAF1E9",
    highlights: [
      "مساهمات ومصروفات والتزامات",
      "منتجات وموردون وطلبات شراء",
      "أفكار تتحول إلى مشروعات",
    ],
    modules: [],
    sections: [],
    starterTasks: [],
    navigation: {
      home: "نظرة عامة",
      weekly: "المتابعة",
      plan: "التأسيس والوثائق",
      projects: "المنتجات والمشروعات",
      tasks: "المهام العامة",
      team: "الفريق",
      feeds: "الموردون والمشتريات",
      lessons: "بنك الأفكار",
      launches: "المواعيد",
      calendar: "التقويم",
      reports: "المال",
    },
  },
  personal: {
    title: "اللوحة الشخصية",
    description:
      "مهام بسيطة حسب جوانب حياتك، مع تركيز اليوم واقتراح أقرب ٣ مهام لموعدها.",
    accent: "#1E3A8A",
    softAccent: "#E9EDF7",
    highlights: [
      "تصنيفات تختارها بنفسك",
      "موعد الإنجاز ووقت التنفيذ",
      "أولويات يومية باختيارك",
    ],
    modules: [],
    sections: [],
    starterTasks: [],
    navigation: {
      home: "تركيزي اليوم",
      weekly: "الأسبوع",
      plan: "جوانب حياتي",
      projects: "المشاريع",
      tasks: "كل مهامي",
      team: "الفريق",
      feeds: "المصادر",
      lessons: "الملاحظات",
      launches: "المواعيد",
      calendar: "التقويم",
      reports: "الملخص",
    },
  },
  commerce_import: {
    title: "تأسيس تجارة واستيراد",
    description:
      "من اختيار المنتج والمورد إلى أول طلبية وأول بيع، مع أقسام ومهام مرنة للفرد والفريق.",
    accent: "#1E3A8A",
    softAccent: "#E9EDF7",
    highlights: [
      "أقسام قابلة للتعديل والترتيب",
      "مهام وإسناد ومواعيد وخطوات",
      "أرشفة واستعادة دون فقد البيانات",
    ],
    modules: [],
    sections: [],
    starterTasks: [],
    navigation: {
      home: "رحلة المشروع",
      weekly: "المتابعة",
      plan: "الأقسام",
      projects: "رحلة المشروع",
      tasks: "كل المهام",
      team: "الفريق",
      feeds: "الملفات والروابط",
      lessons: "الملاحظات",
      launches: "المواعيد",
      calendar: "التقويم",
      reports: "الملخص",
    },
  },
  idea_lab: {
    title: "مختبر الأفكار",
    description:
      "مساحة لفهم المشكلات، جمع الأدلة، إجراء المقابلات، واختبار أفكار الأعمال مع الفريق.",
    accent: "#1E3A8A",
    softAccent: "#E9EDF7",
    highlights: [
      "بنك مستقل للمشكلات والأفكار",
      "مقابلات وتجارب مرتبطة بالأدلة",
      "تحليل اختياري باستخدام مفتاح العضو",
    ],
    modules: [],
    sections: [],
    navigation: {
      home: "بوصلة الفرص",
      weekly: "المقابلات",
      plan: "المشكلات",
      projects: "الأفكار",
      tasks: "التجارب",
      team: "الفريق",
      feeds: "المصادر",
      lessons: "القرارات",
      launches: "المواعيد",
      calendar: "التقويم",
      reports: "مقارنة الفرص",
    },
    starterTasks: [],
  },
};

export const EMPTY_BOARD_TEMPLATE_CONFIG: BoardTemplateConfig = {
  title: "مساحة عمل",
  description: "مساحة مستقلة تُصمم حسب احتياجها.",
  accent: "#1E3A8A",
  softAccent: "#E9EDF7",
  highlights: [],
  modules: [],
  sections: [],
  navigation: {
    home: "الرئيسية",
    weekly: "التحديث الأسبوعي",
    plan: "الخطة",
    projects: "المشاريع",
    tasks: "المهام",
    team: "الفريق",
    feeds: "المصادر",
    lessons: "الدروس المستفادة",
    launches: "المواعيد المهمة",
    calendar: "التقويم",
    reports: "التقارير",
  },
  starterTasks: [],
};
