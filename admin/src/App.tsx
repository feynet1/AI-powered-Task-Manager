import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
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

const API_URL = "http://localhost:5000";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const loadOverview = async () => {
      if (!user) {
        setSummary(null);
        return;
      }

      try {
        const token = await user.getIdToken();
        const response = await fetch(`${API_URL}/admin/overview`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || "Admin access is required.");
        }

        const data = await response.json();
        setSummary(data);
        setError("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load admin data.");
        setSummary(null);
      }
    };

    if (user) {
      loadOverview();
    }
  }, [user]);

  if (loading) {
    return <div className="page-wrap"><div className="card"><p>Loading admin session...</p></div></div>;
  }

  if (!user) {
    return (
      <div className="page-wrap">
        <div className="card auth-card">
          <p className="eyebrow">Admin access</p>
          <h1>Sign in to continue</h1>
          <p>Use the same Firebase account as the main app. Only admin-role users can access this dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrap">
      <div className="shell">
        <header className="topbar">
          <div>
            <p className="eyebrow">Operations</p>
            <h1>Admin dashboard</h1>
          </div>
          <button type="button" onClick={() => signOut(auth)} className="ghost-button">
            Sign out
          </button>
        </header>

        {error ? (
          <div className="error-box">{error}</div>
        ) : summary ? (
          <>
            <section className="stats-grid">
              <article className="stat-card">
                <span>Total tasks</span>
                <strong>{summary.totalTasks}</strong>
              </article>
              <article className="stat-card">
                <span>Completed</span>
                <strong>{summary.completedTasks}</strong>
              </article>
              <article className="stat-card">
                <span>Pending</span>
                <strong>{summary.pendingTasks}</strong>
              </article>
              <article className="stat-card">
                <span>Users</span>
                <strong>{summary.totalUsers}</strong>
              </article>
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
                      <td colSpan={4}>No tasks found.</td>
                    </tr>
                  ) : (
                    summary.recentTasks.map((task) => (
                      <tr key={task.id}>
                        <td>{task.title}</td>
                        <td>{task.status}</td>
                        <td>{task.priority}</td>
                        <td>{task.createdAt ? new Date(task.createdAt).toLocaleDateString() : "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </section>
          </>
        ) : (
          <div className="card">
            <p>Loading task overview...</p>
          </div>
        )}
      </div>
    </div>
  );
}
