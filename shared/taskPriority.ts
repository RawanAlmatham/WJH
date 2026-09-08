export type PrioritizableTask = {
  id?: number;
  status: string;
  priority: string;
  dueDate?: Date | string | null;
  createdAt?: Date | string | null;
};

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
