import type { BoardModule } from "./boardModules";
import type { PresentationSection } from "./presentationSections";

/** Published products. Each template owns its own workflow and data model. */
export const boardTemplates = ["idea_lab"] as const;

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
