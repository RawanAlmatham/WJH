export const boardModules = [
  "plan",
  "projects",
  "tasks",
  "team",
  "feeds",
  "calendar",
  "lessons",
  "reports",
] as const;

export type BoardModule = (typeof boardModules)[number];

export const DEFAULT_BOARD_MODULES: BoardModule[] = [...boardModules];
