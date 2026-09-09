export type CompletionPeriod = "day" | "week" | "month" | "quarter" | "year";

export type PeriodCompletionTask = {
  status: string;
  dueDate?: Date | string | null;
};

export type PeriodCompletionSummary = {
  completed: number;
  total: number;
  percentage: number;
  start: Date;
  end: Date;
};

function startOfDay(value: Date) {
  const result = new Date(value);
  result.setHours(0, 0, 0, 0);
  return result;
}

function parseTaskDate(value: Date | string | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const parsed = dateOnly
    ? new Date(
        Number(dateOnly[1]),
        Number(dateOnly[2]) - 1,
        Number(dateOnly[3])
      )
    : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getCompletionPeriodRange(
  period: CompletionPeriod,
  referenceDate = new Date()
) {
  const start = startOfDay(referenceDate);

  if (period === "week") {
    // أسبوع العمل في اللوحة يبدأ يوم الأحد وينتهي بنهاية السبت.
    start.setDate(start.getDate() - start.getDay());
  } else if (period === "month") {
    start.setDate(1);
  } else if (period === "quarter") {
    start.setMonth(Math.floor(start.getMonth() / 3) * 3, 1);
  } else if (period === "year") {
    start.setMonth(0, 1);
  }

  const end = new Date(start);
  if (period === "day") end.setDate(end.getDate() + 1);
  if (period === "week") end.setDate(end.getDate() + 7);
  if (period === "month") end.setMonth(end.getMonth() + 1);
  if (period === "quarter") end.setMonth(end.getMonth() + 3);
  if (period === "year") end.setFullYear(end.getFullYear() + 1);

  return { start, end };
}

export function calculatePeriodCompletion(
  tasks: PeriodCompletionTask[],
  period: CompletionPeriod,
  referenceDate = new Date()
): PeriodCompletionSummary {
  const tasksInPeriod = filterTasksByCompletionPeriod(
    tasks,
    period,
    referenceDate
  );
  const { start, end } = getCompletionPeriodRange(period, referenceDate);

  const completed = tasksInPeriod.filter(
    task => task.status === "complete"
  ).length;
  const total = tasksInPeriod.length;

  return {
    completed,
    total,
    percentage: total ? Math.round((completed / total) * 100) : 0,
    start,
    end,
  };
}

export function filterTasksByCompletionPeriod<T extends PeriodCompletionTask>(
  tasks: T[],
  period: CompletionPeriod,
  referenceDate = new Date()
): T[] {
  const { start, end } = getCompletionPeriodRange(period, referenceDate);
  return tasks.filter(task => {
    const dueDate = parseTaskDate(task.dueDate);
    return dueDate && dueDate >= start && dueDate < end;
  });
}
