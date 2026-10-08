export type IdeaTaskView = "mine" | "unassigned" | "all";

export function matchesIdeaTaskView(
  task: { id: number; assigneeUserId: number | null },
  subtasks: { taskId: number; assigneeUserId: number | null }[],
  userId: number,
  view: IdeaTaskView
) {
  if (view === "all") return true;
  if (view === "unassigned") return task.assigneeUserId === null;
  return (
    task.assigneeUserId === userId ||
    subtasks.some(
      item => item.taskId === task.id && item.assigneeUserId === userId
    )
  );
}

export function initialTaskAssignee(
  task: { assigneeUserId: number | null } | null | undefined,
  userId: number
) {
  return task ? task.assigneeUserId : userId;
}
