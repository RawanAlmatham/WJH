import type { BoardModule } from "./boardModules";
import type { PresentationSection } from "./presentationSections";

/** No templates are published while the new independent experiences are designed. */
export const boardTemplates: readonly string[] = [];

export type BoardTemplate = string;

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

export const BOARD_TEMPLATE_LABELS: Record<string, BoardTemplateConfig> = {};

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
