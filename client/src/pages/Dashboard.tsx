import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import "./Dashboard.css";

type Priority = "low" | "medium" | "high";
type TaskFilter = "all" | "active" | "completed" | "overdue";
type SortMode = "created-desc" | "due-asc" | "priority-desc" | "title-asc";
type ViewMode = "all" | "today" | "upcoming" | "overdue";
type LayoutMode = "list" | "board";

type TaskStatus =
  | "inbox"
  | "next"
  | "doing"
  | "waiting"
  | "done"
  | "backlog"
  | "ready"
  | "in-review"
  | "blocked";

type Task = {
  id: string;
  title: string;
  list: string;
  status: TaskStatus;
  completed: boolean;
  priority: Priority;
  dueDate: string;
  notes?: string;
  recurrence?: string;
  tags?: string[];
  assignee?: string;
  project?: string;
  description?: string;
  links?: string[];
  estimate?: string;
  blocker?: boolean;
  blockerNote?: string;
  createdAt?: string;
  updatedAt?: string;
};

type TaskDetailsDraft = {
  assignee: string;
  project: string;
  description: string;
  links: string;
  estimate: string;
  blocker: boolean;
  blockerNote: string;
};

const API_URL = "http://localhost:5000";

const BOARD_COLUMNS: TaskStatus[] = [
  "inbox",
  "next",
  "doing",
  "waiting",
  "done",
  "backlog",
  "ready",
  "in-review",
  "blocked",
];

async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error("Please sign in again.");

  const token = await user.getIdToken();
  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${token}`);

  if (options.body) headers.set("Content-Type", "application/json");

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || "The request failed.");
  }

  return data as T;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatStatus(status: TaskStatus): string {
  return status
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [list, setList] = useState("Personal");
  const [status, setStatus] = useState<TaskStatus>("inbox");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [recurrence, setRecurrence] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [detailDraft, setDetailDraft] = useState<TaskDetailsDraft | null>(null);
  const [savingDetails, setSavingDetails] = useState(false);

  const [filter, setFilter] = useState<TaskFilter>("all");
  const [showCompleted, setShowCompleted] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("created-desc");
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("list");
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [error, setError] = useState("");

  const loadTasks = useCallback(async () => {
    try {
      const loadedTasks = await apiRequest<Task[]>("/tasks");

      setTasks(
        loadedTasks.map((task) => ({
          ...task,
          list: task.list || "Personal",
          status: task.status || "inbox",
          completed: Boolean(task.completed),
          priority: task.priority || "medium",
          dueDate: task.dueDate || "",
          notes: task.notes || "",
          recurrence: task.recurrence || "",
          tags: Array.isArray(task.tags) ? task.tags : [],
          links: Array.isArray(task.links) ? task.links : [],
        }))
      );

      setError("");
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Could not load tasks."));
    } finally {
      setLoadingTasks(false);
    }
  }, []);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const resetDetailsModal = () => {
    setDetailTask(null);
    setDetailDraft(null);
  };

  const openTaskDetails = (task: Task) => {
    setDetailTask(task);
    setDetailDraft({
      assignee: task.assignee || "",
      project: task.project || "",
      description: task.description || "",
      links: (task.links || []).join(", "),
      estimate: task.estimate || "",
      blocker: Boolean(task.blocker),
      blockerNote: task.blockerNote || "",
    });
  };

  const saveTaskDetails = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!detailTask || !detailDraft) return;

    const links = detailDraft.links
      .split(",")
      .map((link) => link.trim())
      .filter(Boolean);

    setSavingDetails(true);

    try {
      await apiRequest(`/tasks/${detailTask.id}`, {
        method: "PUT",
        body: JSON.stringify({
          assignee: detailDraft.assignee,
          project: detailDraft.project,
          description: detailDraft.description,
          links,
          estimate: detailDraft.estimate,
          blocker: detailDraft.blocker,
          blockerNote: detailDraft.blockerNote,
        }),
      });

      resetDetailsModal();
      await loadTasks();
    } catch (saveError) {
      setError(getErrorMessage(saveError, "Could not save task details."));
    } finally {
      setSavingDetails(false);
    }
  };

  const handleDropTask = async (nextStatus: TaskStatus) => {
    if (!draggedTaskId) return;

    const task = tasks.find((item) => item.id === draggedTaskId);
    if (!task || task.status === nextStatus) {
      setDraggedTaskId(null);
      return;
    }

    try {
      await apiRequest(`/tasks/${draggedTaskId}`, {
        method: "PUT",
        body: JSON.stringify({ status: nextStatus }),
      });

      setDraggedTaskId(null);
      await loadTasks();
    } catch (dropError) {
      setError(getErrorMessage(dropError, "Could not move the task."));
      setDraggedTaskId(null);
    }
  };

  const resetForm = () => {
    setTitle("");
    setList("Personal");
    setStatus("inbox");
    setPriority("medium");
    setDueDate("");
    setNotes("");
    setRecurrence("");
    setTagsInput("");
    setEditingTaskId(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const taskTitle = title.trim();
    if (!taskTitle) return;

    const tags = tagsInput
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    const body = JSON.stringify({
      title: taskTitle,
      list,
      status,
      priority,
      dueDate,
      notes,
      recurrence,
      tags,
    });

    try {
      if (editingTaskId) {
        await apiRequest(`/tasks/${editingTaskId}`, {
          method: "PUT",
          body,
        });
      } else {
        await apiRequest("/tasks", {
          method: "POST",
          body,
        });
      }

      resetForm();
      await loadTasks();
    } catch (saveError) {
      setError(getErrorMessage(saveError, "Could not save the task."));
    }
  };

  const startEditing = (task: Task) => {
    setEditingTaskId(task.id);
    setTitle(task.title);
    setList(task.list || "Personal");
    setStatus(task.status || "inbox");
    setPriority(task.priority || "medium");
    setDueDate(task.dueDate || "");
    setNotes(task.notes || "");
    setRecurrence(task.recurrence || "");
    setTagsInput((task.tags || []).join(", "));
    setError("");
  };

  const toggleTask = async (task: Task) => {
    const isCompleted = task.completed || task.status === "done";

    const update =
      isCompleted && task.status === "done"
        ? { completed: false, status: "inbox" as TaskStatus }
        : { completed: !isCompleted };

    try {
      await apiRequest(`/tasks/${task.id}`, {
        method: "PUT",
        body: JSON.stringify(update),
      });
      await loadTasks();
    } catch (updateError) {
      setError(getErrorMessage(updateError, "Could not update the task."));
    }
  };

  const removeTask = async (task: Task) => {
    if (!window.confirm(`Delete "${task.title}"?`)) return;

    try {
      await apiRequest(`/tasks/${task.id}`, { method: "DELETE" });
      await loadTasks();
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, "Could not delete the task."));
    }
  };

  const today = getLocalDateString(new Date());

  const filteredTasks = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    const results = tasks.filter((task) => {
      const dueDateOnly = task.dueDate?.slice(0, 10) || "";
      const isCompleted = task.completed || task.status === "done";
      const isOverdue = Boolean(dueDateOnly) && dueDateOnly < today;

      const searchableText = [
        task.title,
        task.notes || "",
        task.list,
        task.status,
        task.priority,
        dueDateOnly,
        task.recurrence || "",
        task.assignee || "",
        task.project || "",
        task.description || "",
        ...(task.tags || []),
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = !search || searchableText.includes(search);

      const matchesArchive =
        showCompleted || filter === "completed" || !isCompleted;

      const matchesFilter =
        filter === "all" ||
        (filter === "active" && !isCompleted) ||
        (filter === "completed" && isCompleted) ||
        (filter === "overdue" && !isCompleted && isOverdue);

      const matchesView =
        viewMode === "all" ||
        (viewMode === "today" && dueDateOnly === today) ||
        (viewMode === "upcoming" &&
          Boolean(dueDateOnly) &&
          dueDateOnly > today) ||
        (viewMode === "overdue" && !isCompleted && isOverdue);

      return (
        matchesArchive &&
        matchesSearch &&
        matchesFilter &&
        matchesView
      );
    });

    return [...results].sort((a, b) => {
      switch (sortMode) {
        case "priority-desc": {
          const order: Record<Priority, number> = {
            high: 3,
            medium: 2,
            low: 1,
          };
          return order[b.priority] - order[a.priority];
        }

        case "due-asc": {
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return a.dueDate.slice(0, 10).localeCompare(b.dueDate.slice(0, 10));
        }

        case "title-asc":
          return a.title.localeCompare(b.title);

        case "created-desc":
        default: {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        }
      }
    });
  }, [
    tasks,
    filter,
    showCompleted,
    searchTerm,
    sortMode,
    viewMode,
    today,
  ]);

  const boardTasks = useMemo(() => {
    const grouped: Record<TaskStatus, Task[]> = {
      inbox: [],
      next: [],
      doing: [],
      waiting: [],
      done: [],
      backlog: [],
      ready: [],
      "in-review": [],
      blocked: [],
    };

    filteredTasks.forEach((task) => {
      grouped[task.status]?.push(task);
    });

    return grouped;
  }, [filteredTasks]);

  const completedCount = tasks.filter(
    (task) => task.completed || task.status === "done"
  ).length;

  const renderTaskCard = (task: Task) => {
    const isCompleted = task.completed || task.status === "done";

    return (
      <article
        className={draggedTaskId === task.id ? "task-card dragging" : "task-card"}
        key={task.id}
        draggable={layoutMode === "board"}
        onDragStart={() => setDraggedTaskId(task.id)}
        onDragEnd={() => setDraggedTaskId(null)}
      >
        <div className="task-card-top">
          <label className="task-label">
            <input
              type="checkbox"
              checked={isCompleted}
              onChange={() => void toggleTask(task)}
              aria-label={`Mark ${task.title} ${
                isCompleted ? "active" : "complete"
              }`}
            />
            <span className={isCompleted ? "task-title completed" : "task-title"}>
              {task.title}
            </span>
          </label>

          <div className="task-actions">
            <button
              className="edit-button"
              type="button"
              onClick={() => openTaskDetails(task)}
            >
              Details
            </button>
            <button
              className="edit-button"
              type="button"
              onClick={() => startEditing(task)}
            >
              Edit
            </button>
            <button
              className="delete-button"
              type="button"
              onClick={() => void removeTask(task)}
            >
              Delete
            </button>
          </div>
        </div>

        <div className="task-meta">
          <span className="task-list-badge">{task.list}</span>
          <span className="task-status-badge">{formatStatus(task.status)}</span>
          <span className={`task-priority priority-${task.priority}`}>
            {task.priority}
          </span>
          {task.dueDate && (
            <time dateTime={task.dueDate}>Due {task.dueDate}</time>
          )}
        </div>

        {task.notes && <p className="task-notes">{task.notes}</p>}

        {task.tags && task.tags.length > 0 && (
          <div className="task-tags">
            {task.tags.map((tag) => (
              <span key={`${task.id}-${tag}`} className="task-tag">
                {tag}
              </span>
            ))}
          </div>
        )}
      </article>
    );
  };

  return (
    <main className="dashboard-page">
      <section className="dashboard">
        <header className="dashboard-header">
          <div>
            <p className="dashboard-eyebrow">YOUR WORKSPACE</p>
            <h1>My tasks</h1>
            <p className="dashboard-subtitle">
              {completedCount} of {tasks.length} tasks completed
            </p>
          </div>

          <button
            className="logout-button"
            type="button"
            onClick={() => void signOut(auth)}
          >
            Log out
          </button>
        </header>

        <div className="dashboard-toolbar">
          <input
            className="search-input"
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search tasks..."
            aria-label="Search tasks"
          />

          <select
            className="sort-select"
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as SortMode)}
            aria-label="Sort tasks"
          >
            <option value="created-desc">Newest first</option>
            <option value="due-asc">Due date</option>
            <option value="priority-desc">Priority</option>
            <option value="title-asc">Title A-Z</option>
          </select>
        </div>

        <nav className="dashboard-view-tabs" aria-label="Task views">
          {(["all", "today", "upcoming", "overdue"] as const).map((option) => (
            <button
              key={option}
              type="button"
              className={viewMode === option ? "view-tab selected" : "view-tab"}
              aria-pressed={viewMode === option}
              onClick={() => setViewMode(option)}
            >
              {option === "all"
                ? "All"
                : option[0].toUpperCase() + option.slice(1)}
            </button>
          ))}
        </nav>

        <div className="layout-toggle" aria-label="Choose task layout">
          <button
            type="button"
            className={
              layoutMode === "list"
                ? "toggle-button selected"
                : "toggle-button"
            }
            aria-pressed={layoutMode === "list"}
            onClick={() => setLayoutMode("list")}
          >
            List
          </button>
          <button
            type="button"
            className={
              layoutMode === "board"
                ? "toggle-button selected"
                : "toggle-button"
            }
            aria-pressed={layoutMode === "board"}
            onClick={() => setLayoutMode("board")}
          >
            Board
          </button>
        </div>

        <nav className="task-filters" aria-label="Filter tasks">
          {(["all", "active", "completed", "overdue"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={filter === option}
              className={
                filter === option ? "filter-button selected" : "filter-button"
              }
              onClick={() => setFilter(option)}
            >
              {option[0].toUpperCase() + option.slice(1)}
            </button>
          ))}
        </nav>

        <label className="show-completed-toggle">
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(event) => setShowCompleted(event.target.checked)}
          />
          Show completed tasks ({completedCount})
        </label>

        <form className="task-form" onSubmit={handleSubmit}>
          <input
            aria-label="Task title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="What do you need to get done?"
            required
          />

          <select
            aria-label="Task list"
            value={list}
            onChange={(event) => setList(event.target.value)}
          >
            <option value="Personal">Personal</option>
            <option value="Work">Work</option>
            <option value="Errands">Errands</option>
            <option value="Health">Health</option>
            <option value="Learning">Learning</option>
          </select>

          <select
            aria-label="Task status"
            value={status}
            onChange={(event) => setStatus(event.target.value as TaskStatus)}
          >
            {BOARD_COLUMNS.map((option) => (
              <option key={option} value={option}>
                {formatStatus(option)}
              </option>
            ))}
          </select>

          <select
            aria-label="Task priority"
            value={priority}
            onChange={(event) => setPriority(event.target.value as Priority)}
          >
            <option value="low">Low priority</option>
            <option value="medium">Medium priority</option>
            <option value="high">High priority</option>
          </select>

          <input
            aria-label="Task due date"
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
          />

          <textarea
            aria-label="Task notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Notes or task details"
            rows={2}
          />

          <input
            aria-label="Task recurrence"
            value={recurrence}
            onChange={(event) => setRecurrence(event.target.value)}
            placeholder="Every Friday / every 12 months"
          />

          <input
            aria-label="Task tags"
            value={tagsInput}
            onChange={(event) => setTagsInput(event.target.value)}
            placeholder="home, urgent, calls"
          />

          <button type="submit">
            {editingTaskId ? "Save changes" : "Add task"}
          </button>

          {editingTaskId && (
            <button
              className="cancel-button"
              type="button"
              onClick={resetForm}
            >
              Cancel
            </button>
          )}
        </form>

        {error && (
          <p className="dashboard-error" role="alert">
            {error}
            <button type="button" onClick={() => void loadTasks()}>
              Retry
            </button>
          </p>
        )}

        {loadingTasks ? (
          <p className="loading-state" role="status">
            Loading tasks...
          </p>
        ) : filteredTasks.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">✓</span>
            <h2>
              {tasks.length === 0
                ? "Your task list is clear"
                : "No matching tasks"}
            </h2>
            <p>
              {tasks.length === 0
                ? "Add a task above to get started."
                : "Try a different filter, view, or search."}
            </p>
          </div>
        ) : layoutMode === "board" ? (
          <section className="kanban-board" aria-label="Kanban board">
            {BOARD_COLUMNS.map((column) => (
              <div
                className="kanban-column"
                key={column}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  void handleDropTask(column);
                }}
              >
                <div className="kanban-header">
                  <span>{formatStatus(column)}</span>
                  <span className="kanban-count">
                    {boardTasks[column].length}
                  </span>
                </div>
                <div className="kanban-cards">
                  {boardTasks[column].map(renderTaskCard)}
                </div>
              </div>
            ))}
          </section>
        ) : (
          <section className="task-section" aria-label="Task list">
            <ul className="task-list">
              {filteredTasks.map((task) => (
                <li className="task-item" key={task.id}>
                  {renderTaskCard(task)}
                </li>
              ))}
            </ul>
          </section>
        )}

        {detailTask && detailDraft && (
          <div
            className="modal-backdrop"
            onClick={(event) => {
              if (event.target === event.currentTarget) resetDetailsModal();
            }}
          >
            <form
              className="task-details-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="task-details-title"
              onSubmit={(event) => void saveTaskDetails(event)}
            >
              <header className="modal-header">
                <div>
                  <p className="dashboard-eyebrow">TASK DETAILS</p>
                  <h2 id="task-details-title">{detailTask.title}</h2>
                </div>
                <button
                  className="modal-close"
                  type="button"
                  aria-label="Close task details"
                  onClick={resetDetailsModal}
                >
                  ×
                </button>
              </header>

              <label>
                Assignee
                <input
                  value={detailDraft.assignee}
                  onChange={(event) =>
                    setDetailDraft({
                      ...detailDraft,
                      assignee: event.target.value,
                    })
                  }
                  placeholder="Name"
                />
              </label>

              <label>
                Project
                <input
                  value={detailDraft.project}
                  onChange={(event) =>
                    setDetailDraft({
                      ...detailDraft,
                      project: event.target.value,
                    })
                  }
                  placeholder="Project name"
                />
              </label>

              <label>
                Description
                <textarea
                  rows={3}
                  value={detailDraft.description}
                  onChange={(event) =>
                    setDetailDraft({
                      ...detailDraft,
                      description: event.target.value,
                    })
                  }
                  placeholder="More details about this task"
                />
              </label>

              <label>
                Links <span className="field-hint">(comma-separated URLs)</span>
                <textarea
                  rows={2}
                  value={detailDraft.links}
                  onChange={(event) =>
                    setDetailDraft({
                      ...detailDraft,
                      links: event.target.value,
                    })
                  }
                  placeholder="https://example.com"
                />
              </label>

              <label>
                Estimate
                <input
                  value={detailDraft.estimate}
                  onChange={(event) =>
                    setDetailDraft({
                      ...detailDraft,
                      estimate: event.target.value,
                    })
                  }
                  placeholder="e.g. 30 minutes"
                />
              </label>

              <label className="blocker-toggle">
                <input
                  type="checkbox"
                  checked={detailDraft.blocker}
                  onChange={(event) =>
                    setDetailDraft({
                      ...detailDraft,
                      blocker: event.target.checked,
                    })
                  }
                />
                This task is blocked
              </label>

              {detailDraft.blocker && (
                <label>
                  Blocker note
                  <textarea
                    rows={2}
                    value={detailDraft.blockerNote}
                    onChange={(event) =>
                      setDetailDraft({
                        ...detailDraft,
                        blockerNote: event.target.value,
                      })
                    }
                    placeholder="What is preventing progress?"
                  />
                </label>
              )}

              <footer className="modal-actions">
                <button
                  className="cancel-button"
                  type="button"
                  onClick={resetDetailsModal}
                >
                  Cancel
                </button>
                <button type="submit" disabled={savingDetails}>
                  {savingDetails ? "Saving..." : "Save details"}
                </button>
              </footer>
            </form>
          </div>
        )}
      </section>
    </main>
  );
}

export default Dashboard;