import { useEffect, useState, type FormEvent } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { auth, db } from "../firebase";
import "./Dashboard.css";

type Priority = "low" | "medium" | "high";
type TaskFilter = "all" | "active" | "completed" | "overdue";

type Task = {
  id: string;
  title: string;
  completed: boolean;
  priority: Priority;
  dueDate: string;
};

function Dashboard({ uid }: { uid: string }) {
  const [title, setTitle] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [filter, setFilter] = useState<TaskFilter>("all");
  const [loadingTasks, setLoadingTasks] = useState(true);


  useEffect(() => {
    const tasksQuery = query(
      collection(db, "tasks"),
      where("userId", "==", uid)
    );

    setLoadingTasks(true);

    return onSnapshot(
      tasksQuery,
      (snapshot) => {
        setTasks(
          snapshot.docs.map((taskDoc) => ({
            id: taskDoc.id,
            title: taskDoc.data().title as string,
            completed: taskDoc.data().completed as boolean,
            priority : taskDoc.data().priority as Priority || "medium",
            dueDate : taskDoc.data().dueDate as string || "",
          }))
        );
        setLoadingTasks(false);
      },
      (snapshotError) => {
        setError(snapshotError.message);
        setLoadingTasks(false);
      }
    );
  }, [uid]);

  const startEditingTask = (task: Task) => {
    setEditingTaskId(task.id);
    setTitle(task.title);
    setPriority(task.priority);
    setDueDate(task.dueDate);
  };
  const addTask = async (event: FormEvent) => {
    event.preventDefault();
    const taskTitle = title.trim();
    if (!taskTitle) return;
    try {
      if (editingTaskId) {
        await updateDoc(doc(db, "tasks", editingTaskId), {
          title: taskTitle,
          priority,
          dueDate,
        });
        setEditingTaskId(null);
      } else {
        await addDoc(collection(db, "tasks"), {
          title: taskTitle,
          completed: false,
          userId: uid,
          priority,
          dueDate,
        });
      }
      setTitle("");
      setPriority("medium");
      setDueDate("");
      setError("");
    } catch (taskError) {
      setError(taskError instanceof Error ? taskError.message : "Could not add task.");
    }
  
  }
  const toggleTask = async (task: Task) => {
    try {
      await updateDoc(doc(db, "tasks", task.id), {
        completed: !task.completed,
      });
    } catch (taskError) {
      setError(taskError instanceof Error ? taskError.message : "Could not update task.");
    }
  };

  const removeTask = async (taskId: string) => {
    if (!window.confirm("Are you sure you want to delete this task?")) return;
    try {
      await deleteDoc(doc(db, "tasks", taskId));
    } catch (taskError) {
      setError(taskError instanceof Error ? taskError.message : "Could not delete task.");
    }
  };

  const completedCount = tasks.filter((task) => task.completed).length;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
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
          <button className="logout-button" onClick={() => signOut(auth)}>
            Log out
          </button>
        </header>

        <form className="task-form" onSubmit={addTask}>
          <input
            aria-label="New task"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="What do you need to get done?"
            required
          />
     
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
            aria-label="Due date"
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
          />

          <button type="submit">Add task</button>
        </form>

        {error && <p className="dashboard-error" role="alert">{error}</p>}

        <nav className="task-filters" aria-label="Filter tasks">
          {(["all", "active", "completed", "overdue"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={filter === option}
              className={filter === option ? "filter-button selected" : "filter-button"}
              onClick={() => setFilter(option)}
            >
              {option[0].toUpperCase() + option.slice(1)}
            </button>
          ))}
        </nav>
       
        <section className="task-section" aria-label="Task list">
          {loadingTasks ? (
           <div className="loading-state" role="status">
            <span className="loading-spinner" aria-hidden="true" />
            Loading tasks...
          </div>
) : filteredTasks.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">✓</span>
              <h2>{tasks.length === 0 ? "Your task list is clear" : "No matching tasks"}</h2>
              <p>
                {tasks.length === 0
                   ? "Add a task above to get started. "
                   : "Try a different filter."
                }
              </p>
            </div>
          ) : (
            <ul className="task-list">
              {filteredTasks.map((task) => (
                <li className="task-item" key={task.id}>
                  <label className="task-label">
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => toggleTask(task)}
                    />
                    <span className={task.completed ? "task-title completed" : "task-title"}>
                      {task.title}
                    </span>
                  </label>
                  <button type ="button" onClick={() => startEditingTask(task)} aria-label={`Edit ${task.title}`}>
                    Edit
                  </button>
                  <button
                    className="delete-button"
                    type="button"
                    onClick={() => removeTask(task.id)}
                    aria-label={`Delete ${task.title}`}
                  >
                    Delete
                  </button>
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