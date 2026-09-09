export const notificationTypes = [
  "task_assigned",
  "comment_mention",
  "comment_reply",
  "support_requested",
  "task_due_changed",
  "task_priority_changed",
  "task_due_soon",
  "task_overdue",
  "launch_due_soon",
] as const;

export type NotificationType = (typeof notificationTypes)[number];

export const notificationTypeLabels: Record<NotificationType, string> = {
  task_assigned: "إسناد المهام",
  comment_mention: "الإشارات في التعليقات",
  comment_reply: "الردود على التعليقات",
  support_requested: "طلبات الدعم",
  task_due_changed: "تغيير مواعيد المهام",
  task_priority_changed: "تغيير أولوية المهام",
  task_due_soon: "تذكيرات استحقاق المهام",
  task_overdue: "المهام المتأخرة",
  launch_due_soon: "الإطلاقات القريبة",
};

export const defaultBrowserNotificationTypes = [...notificationTypes];
