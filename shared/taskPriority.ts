export type PrioritizableTask = {
  id?: number;
  status: string;
  priority: string;
  dueDate?: Date | string | null;
  createdAt?: Date | string | null;
};

export type TaskDueFilter =
  | "all"
  | "overdue"
  | "today"
  | "week"
  | "upcoming"
  | "none";

const priorityRank: Record<string, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function timestamp(value: Date | string | null | undefined, fallback: number) {
  if (!value) return fallback;
  const result = new Date(value).getTime();
  return Number.isNaN(result) ? fallback : result;
}

function taskDate(value: Date | string | null | undefined) {
  if (!value) return null;
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? null : value;

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const result = dateOnly
    ? new Date(
        Number(dateOnly[1]),
        Number(dateOnly[2]) - 1,
        Number(dateOnly[3])
      )
    : new Date(value);
  return Number.isNaN(result.getTime()) ? null : result;
}

export function matchesTaskDueFilter(
  task: Pick<PrioritizableTask, "dueDate" | "status">,
  filter: TaskDueFilter,
  now = new Date()
) {
  if (filter === "all") return true;

  const dueDate = taskDate(task.dueDate);
  if (filter === "none") return !dueDate;
  if (!dueDate) return false;

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  if (filter === "overdue")
    return task.status !== "complete" && dueDate < today;
  if (filter === "today") return dueDate >= today && dueDate < tomorrow;
  if (filter === "week") return dueDate >= weekStart && dueDate < weekEnd;
  return dueDate >= tomorrow;
}

function isOverdue(task: PrioritizableTask, now: Date) {
  if (task.status === "complete") return false;
  if (task.status === "overdue") return true;
  return timestamp(task.dueDate, Infinity) < now.getTime();
}

/**
 * Orders work by operational urgency without mutating the original array:
 * overdue, declared priority, nearest due date, then oldest creation date.
 */
export function sortTasksByPriority<T extends PrioritizableTask>(
  tasks: T[],
  now = new Date()
) {
  return [...tasks].sort((a, b) => {
    const overdueDifference =
      Number(isOverdue(b, now)) - Number(isOverdue(a, now));
    if (overdueDifference) return overdueDifference;

    const priorityDifference =
      (priorityRank[b.priority] ?? 0) - (priorityRank[a.priority] ?? 0);
    if (priorityDifference) return priorityDifference;

    const dueDifference =
      timestamp(a.dueDate, Infinity) - timestamp(b.dueDate, Infinity);
    if (dueDifference) return dueDifference;

    const createdDifference =
      timestamp(a.createdAt, Infinity) - timestamp(b.createdAt, Infinity);
    if (createdDifference) return createdDifference;

    return (a.id ?? 0) - (b.id ?? 0);
  });
}
