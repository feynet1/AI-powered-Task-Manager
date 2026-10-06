import { type FormEvent, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import { auth } from "./firebase";

type AdminSummary = {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  totalUsers: number;
  recentTasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    createdAt?: string;
  }>;
};

type TaskItem = {
  id: string;
  title: string;
  status: string;
  priority: string;
  list?: string;
  assignee?: string;
  completed?: boolean;
  createdAt?: string | { seconds?: number };
};

type UserItem = {
  uid: string;
  email: string;
  displayName: string;
  role: string;
  lastSignInAt?: string | null;
};

const API_URL = "http://localhost:5000";
const STATUS_OPTIONS = [
  "all",
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

const PRIORITY_OPTIONS = ["all", "low", "medium", "high"];
const USER_ROLE_OPTIONS = ["all", "admin", "user"];
type SectionKey = "overview" | "tasks" | "users";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("all");
  const [activeSection, setActiveSection] = useState<SectionKey>("overview");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);

  const refreshAdminData = useCallback(
    async (currentUser: User | null = user) => {
      if (!currentUser) {
        setSummary(null);
        setTasks([]);
        return;
      }

      try {
        const token = await currentUser.getIdToken();
        const [overviewRes, tasksRes, usersRes] = await Promise.all([
          fetch(`${API_URL}/admin/overview`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_URL}/admin/tasks`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_URL}/admin/users`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (!overviewRes.ok || !tasksRes.ok || !usersRes.ok) {
          const overviewPayload = await overviewRes.json().catch(() => ({}));
          const tasksPayload = await tasksRes.json().catch(() => ({}));
          const usersPayload = await usersRes.json().catch(() => ({}));
          throw new Error(
            overviewPayload.error || tasksPayload.error || usersPayload.error || "Admin access is required."
          );
        }

        const overview = await overviewRes.json();
        const taskList = await tasksRes.json();
        const userList = await usersRes.json();

        setSummary(overview);
        setTasks(taskList);
        setUsers(userList);
        setError("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load admin data.");
        setSummary(null);
        setTasks([]);
        setUsers([]);
      }
    },
    [user]
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setLoading(false);

      if (nextUser) {
        await refreshAdminData(nextUser);
      } else {
        setSummary(null);
        setTasks([]);
        setUsers([]);
      }
    });

    return unsubscribe;
  }, [refreshAdminData]);

  const filteredTasks = useMemo(() => {
    const term = search.toLowerCase().trim();

    return tasks.filter((task) => {
      const matchesStatus = statusFilter === "all" || task.status === statusFilter;
      const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter;
      const matchesSearch =
        !term ||
        task.title?.toLowerCase().includes(term) ||
        task.list?.toLowerCase().includes(term) ||
        task.assignee?.toLowerCase().includes(term);

      return matchesStatus && matchesPriority && matchesSearch;
    });
  }, [tasks, search, statusFilter, priorityFilter]);

  const filteredUsers = useMemo(() => {
    const term = userSearch.toLowerCase().trim();

    return users.filter((member) => {
      const matchesRole = userRoleFilter === "all" || member.role === userRoleFilter;
      const matchesSearch =
        !term ||
        member.email.toLowerCase().includes(term) ||
        member.displayName.toLowerCase().includes(term) ||
        member.role.toLowerCase().includes(term);

      return matchesRole && matchesSearch;
    });
  }, [users, userSearch, userRoleFilter]);

  const overviewMetrics = useMemo(() => {
    const inProgress = tasks.filter((task) =>
      ["next", "doing", "ready", "in-review"].includes(task.status || "inbox")
    ).length;
    const blocked = tasks.filter((task) => task.status === "blocked").length;
    const highPriority = tasks.filter((task) => task.priority === "high").length;
    const admins = users.filter((member) => member.role === "admin").length;

    return {
      inProgress,
      blocked,
      highPriority,
      admins,
    };
  }, [tasks, users]);

  const handleAdminLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    try {
      setSigningIn(true);
      const credentials = await signInWithEmailAndPassword(auth, loginEmail.trim(), loginPassword);
      await refreshAdminData(credentials.user);
      setLoginEmail("");
      setLoginPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in to the admin dashboard.");
    } finally {
      setSigningIn(false);
    }
  };

  const handleStatusUpdate = async (taskId: string, nextStatus: string) => {
    if (!user) return;

    try {
      const token = await user.getIdToken();
      const response = await fetch(`${API_URL}/admin/tasks/${taskId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: nextStatus,
          completed: nextStatus === "done",
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || "Failed to update task.");
      }

      await refreshAdminData(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update task.");
    }
  };

  const handleTaskDelete = async (taskId: string) => {
    if (!user) return;

    try {
      const token = await user.getIdToken();
      const response = await fetch(`${API_URL}/admin/tasks/${taskId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || "Failed to delete task.");
      }

      await refreshAdminData(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete task.");
    }
  };

  const handleRoleUpdate = async (uid: string, nextRole: string) => {
    if (!user) return;

    try {
      const token = await user.getIdToken();
      const response = await fetch(`${API_URL}/admin/users/${uid}/role`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: nextRole }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || "Failed to update user role.");
      }

      await refreshAdminData(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user role.");
    }
  };

  if (loading) {
    return (
      <div className="page-wrap">
        <div className="card">
          <p>Loading admin session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page-wrap">
        <div className="card auth-card">
          <p className="eyebrow">Admin access</p>
          <h1>Sign in to continue</h1>
          <p>
            Use the same Firebase email and password as your main app account. The backend checks whether this user is an admin.
          </p>

          <form onSubmit={handleAdminLogin} style={{ display: "grid", gap: "12px", marginTop: "18px" }}>
            <label htmlFor="admin-email">Email</label>
            <input
              id="admin-email"
              type="email"
              value={loginEmail}
              onChange={(event) => setLoginEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />

            <label htmlFor="admin-password">Password</label>
            <input
              id="admin-password"
              type="password"
              value={loginPassword}
              onChange={(event) => setLoginPassword(event.target.value)}
              placeholder="Your Firebase password"
              autoComplete="current-password"
              required
            />

            <button type="submit" className="primary-button" disabled={signingIn}>
              {signingIn ? "Signing in..." : "Sign in with Firebase"}
            </button>
          </form>

          {error ? <div className="error-box" style={{ marginTop: "14px" }}>{error}</div> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrap">
      <div className="admin-shell">
        <aside className="sidebar">
          <div className="brand-block">
            <span className="brand-mark">TM</span>
            <div>
              <p className="eyebrow">Control center</p>
              <h2>TaskFlow</h2>
            </div>
          </div>

          <nav className="side-nav" aria-label="Admin sections">
            {[
              { key: "overview", label: "Overview" },
              { key: "tasks", label: "Tasks" },
              { key: "users", label: "Users" },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                className={activeSection === item.key ? "nav-item active" : "nav-item"}
                onClick={() => setActiveSection(item.key as SectionKey)}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <button type="button" onClick={() => signOut(auth)} className="ghost-button sidebar-signout">
            Sign out
          </button>
        </aside>

        <main className="content-panel">
          <header className="topbar">
            <div>
              <p className="eyebrow">Operations</p>
              <h1>{activeSection === "overview" ? "Overview" : activeSection === "tasks" ? "Task operations" : "User management"}</h1>
            </div>
          </header>

          {error ? <div className="error-box">{error}</div> : null}

          {activeSection === "overview" && summary ? (
            <>
              <section className="stats-grid">
                <article className="stat-card accent-blue">
                  <span>Total tasks</span>
                  <strong>{summary.totalTasks}</strong>
                </article>
                <article className="stat-card accent-green">
                  <span>Completed</span>
                  <strong>{summary.completedTasks}</strong>
                </article>
                <article className="stat-card accent-amber">
                  <span>Pending</span>
                  <strong>{summary.pendingTasks}</strong>
                </article>
                <article className="stat-card accent-violet">
                  <span>Users</span>
                  <strong>{summary.totalUsers}</strong>
                </article>
              </section>

              <section className="insight-grid">
                <div className="card panel-card">
                  <div className="table-header">
                    <h2>Operational snapshot</h2>
                  </div>

                  <div className="mini-metrics">
                    <div>
                      <span>In progress</span>
                      <strong>{overviewMetrics.inProgress}</strong>
                    </div>
                    <div>
                      <span>Blocked</span>
                      <strong>{overviewMetrics.blocked}</strong>
                    </div>
                    <div>
                      <span>Admins</span>
                      <strong>{overviewMetrics.admins}</strong>
                    </div>
                  </div>
                </div>

                <div className="card panel-card">
                  <div className="table-header">
                    <h2>Priority focus</h2>
                  </div>

                  <ul className="list-stack">
                    <li>
                      <span>High priority</span>
                      <strong>{overviewMetrics.highPriority}</strong>
                    </li>
                    <li>
                      <span>Completed</span>
                      <strong>{summary.completedTasks}</strong>
                    </li>
                    <li>
                      <span>Pending queue</span>
                      <strong>{summary.pendingTasks}</strong>
                    </li>
                  </ul>
                </div>
              </section>

              <section className="card table-card">
                <div className="table-header">
                  <h2>Recent tasks</h2>
                </div>

                <table>
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Status</th>
                      <th>Priority</th>
                      <th>Created</th>
                    </tr>
                  </thead>

                  <tbody>
                    {summary.recentTasks.length === 0 ? (
                      <tr>
                        <td colSpan={4}>No recent tasks found.</td>
                      </tr>
                    ) : (
                      summary.recentTasks.map((task) => (
                        <tr key={task.id}>
                          <td>{task.title}</td>
                          <td>{task.status}</td>
                          <td>{task.priority}</td>
                          <td>
                            {task.createdAt
                              ? new Date(task.createdAt).toLocaleDateString()
                              : "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </section>
            </>
          ) : null}

          {activeSection === "tasks" ? (
            <section className="card table-card">
              <div className="task-controls">
                <div className="search-wrap">
                  <label htmlFor="admin-search">Search tasks</label>
                  <input
                    id="admin-search"
                    type="text"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search by title, list, or assignee"
                  />
                </div>

                <div className="filter-stack">
                  <div className="filter-group" aria-label="Task status filters">
                    {STATUS_OPTIONS.map((option) => (
                      <button
                        key={option}
                        type="button"
                        className={statusFilter === option ? "filter-pill active" : "filter-pill"}
                        onClick={() => setStatusFilter(option)}
                      >
                        {option === "all" ? "All" : option}
                      </button>
                    ))}
                  </div>

                  <div className="filter-group" aria-label="Task priority filters">
                    {PRIORITY_OPTIONS.map((option) => (
                      <button
                        key={option}
                        type="button"
                        className={priorityFilter === option ? "filter-pill active" : "filter-pill"}
                        onClick={() => setPriorityFilter(option)}
                      >
                        {option === "all" ? "All" : option}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>List</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Assignee</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.length === 0 ? (
                    <tr>
                      <td colSpan={6}>No tasks match the current filter.</td>
                    </tr>
                  ) : (
                    filteredTasks.map((task) => (
                      <tr key={task.id}>
                        <td>{task.title}</td>
                        <td>{task.list || "Personal"}</td>
                        <td>
                          <span className="status-badge">{task.status || "inbox"}</span>
                        </td>
                        <td>{task.priority || "medium"}</td>
                        <td>{task.assignee || "Unassigned"}</td>
                        <td>
                          <div className="row-actions">
                            {task.status === "done" ? (
                              <button
                                type="button"
                                className="secondary-button"
                                onClick={() => handleStatusUpdate(task.id, "inbox")}
                              >
                                Reopen
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="secondary-button"
                                onClick={() => handleStatusUpdate(task.id, "done")}
                              >
                                Mark done
                              </button>
                            )}
                            <button
                              type="button"
                              className="danger-button"
                              onClick={() => handleTaskDelete(task.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </section>
          ) : null}

          {activeSection === "users" ? (
            <section className="card table-card">
              <div className="table-header">
                <h2>User management</h2>
              </div>

              <div className="task-controls compact-controls">
                <div className="search-wrap">
                  <label htmlFor="user-search">Search users</label>
                  <input
                    id="user-search"
                    type="text"
                    value={userSearch}
                    onChange={(event) => setUserSearch(event.target.value)}
                    placeholder="Search by email or name"
                  />
                </div>

                <div className="filter-group" aria-label="User role filters">
                  {USER_ROLE_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={userRoleFilter === option ? "filter-pill active" : "filter-pill"}
                      onClick={() => setUserRoleFilter(option)}
                    >
                      {option === "all" ? "All roles" : option}
                    </button>
                  ))}
                </div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Last sign-in</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={4}>No users found.</td>
                    </tr>
                  ) : (
                    filteredUsers.map((member) => (
                      <tr key={member.uid}>
                        <td>
                          <div className="user-cell">
                            <strong>{member.displayName}</strong>
                            <span>{member.email}</span>
                          </div>
                        </td>
                        <td>
                          <span className={member.role === "admin" ? "role-badge admin" : "role-badge user"}>
                            {member.role}
                          </span>
                        </td>
                        <td>{member.lastSignInAt || "Unknown"}</td>
                        <td>
                          <button
                            type="button"
                            className={member.role === "admin" ? "secondary-button" : "primary-button"}
                            onClick={() => handleRoleUpdate(member.uid, member.role === "admin" ? "user" : "admin")}
                          >
                            {member.role === "admin" ? "Remove admin" : "Make admin"}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </section>
          ) : null}
        </main>
      </div>
    </div>
  );
}
