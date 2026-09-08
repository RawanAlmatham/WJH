export const presentationSections = [
  "completion",
  "priorities",
  "attention",
  "upcoming",
  "projects",
  "goals",
  "team",
  "support",
  "lessons",
  "feeds",
] as const;

export type PresentationSection = (typeof presentationSections)[number];

export const DEFAULT_PRESENTATION_SECTIONS: PresentationSection[] = [
  "completion",
  "priorities",
  "attention",
  "upcoming",
];
