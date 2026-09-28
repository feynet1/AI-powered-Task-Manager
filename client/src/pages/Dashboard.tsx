import { useCallback, useEffect, useState, type FormEvent } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import "./Dashboard.css";

type Priority = "low" | "medium" | "high";
type TaskFilter = "all" | "active" | "completed" | "overdue";

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
  dependencies?: string[];
  blocker?: boolean;
  blockerNote?: string;
  links?: string[];
  estimate?: string;
  reporter?: string;
  createdAt?: string;
  updatedAt?: string;
};

const API_URL = "http://localhost:5000";

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error("Please sign in again.");

  const token = await user.getIdToken();
  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${token}`);

  if (options.body) {
    headers.set("Content-Type", "application/json");
  }

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

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
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
  const [filter, setFilter] = useState<TaskFilter>("all");
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
    try {
      await apiRequest(`/tasks/${task.id}`, {
        method: "PUT",
        body: JSON.stringify({ completed: !task.completed }),
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

  const completedCount = tasks.filter((task) => task.completed).length;
  const today = new Date().toLocaleDateString("en-CA");

  const filteredTasks = tasks.filter((task) => {
    switch (filter) {
      case "active":
        return !task.completed;
      case "completed":
        return task.completed;
      case "overdue":
        return !task.completed && Boolean(task.dueDate) && task.dueDate < today;
      default:
        return true;
    }
  });

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
            <option value="inbox">Inbox</option>
            <option value="next">Next</option>
            <option value="doing">Doing</option>
            <option value="waiting">Waiting</option>
            <option value="done">Done</option>
            <option value="backlog">Backlog</option>
            <option value="ready">Ready</option>
            <option value="in-review">In review</option>
            <option value="blocked">Blocked</option>
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
            <button className="cancel-button" type="button" onClick={resetForm}>
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

        <section className="task-section" aria-label="Task list">
          {loadingTasks ? (
            <p className="loading-state" role="status">
              Loading tasks...
            </p>
          ) : filteredTasks.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">✓</span>
              <h2>{tasks.length === 0 ? "Your task list is clear" : "No matching tasks"}</h2>
              <p>
                {tasks.length === 0
                  ? "Add a task above to get started."
                  : "Try a different filter."}
              </p>
            </div>
          ) : (
            <ul className="task-list">
              {filteredTasks.map((task) => (
                <li className="task-item" key={task.id}>
                  <div className="task-content">
                    <label className="task-label">
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={() => void toggleTask(task)}
                      />
                      <span
                        className={
                          task.completed ? "task-title completed" : "task-title"
                        }
                      >
                        {task.title}
                      </span>
                    </label>

                    <div className="task-meta">
                      <span className="task-list-badge">{task.list}</span>
                      <span className="task-status-badge">{task.status}</span>
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
                  </div>

                  <div className="task-actions">
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
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>
    </main>
  );
}

export default Dashboard;