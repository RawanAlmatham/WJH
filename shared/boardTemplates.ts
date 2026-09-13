import type { BoardModule } from "./boardModules";
import type { PresentationSection } from "./presentationSections";

export const boardTemplates = [
  "work",
  "startup",
  "ecommerce",
  "personal-tasks",
] as const;

export type BoardTemplate = (typeof boardTemplates)[number];

export const BOARD_TEMPLATE_LABELS: Record<
  BoardTemplate,
  {
    title: string;
    description: string;
    modules: BoardModule[];
    sections: PresentationSection[];
  }
> = {
  work: {
    title: "قالب العمل",
    description: "إدارة فرق المشاريع ومتابعة الحملات والجداول التشغيلية.",
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
  },
  startup: {
    title: "قالب شركة ناشئة",
    description: "متابعة roadmap المنتج والملف التسويقي والتحديثات السريعة.",
    modules: ["plan", "projects", "tasks", "team", "calendar", "reports"],
    sections: [
      "completion",
      "priorities",
      "attention",
      "upcoming",
      "goals",
      "team",
    ],
  },
  ecommerce: {
    title: "قالب تجارة إلكترونية",
    description:
      "إدارة المنتجات والعروض والمتابعات اليومية للعمليات التشغيلية.",
    modules: ["tasks", "projects", "calendar", "team", "reports"],
    sections: ["completion", "projects", "attention", "upcoming", "team"],
  },
  "personal-tasks": {
    title: "قالب متابعة مهام شخصية",
    description: "تنظيم مهامك اليومية والتخطيط الأسبوعي والمراجعات السريعة.",
    modules: ["plan", "tasks", "calendar", "reports"],
    sections: ["completion", "priorities", "attention", "upcoming"],
  },
} as const;

export const DEFAULT_BOARD_TEMPLATE: BoardTemplate = "work";
