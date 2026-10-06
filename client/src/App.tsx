import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "./firebase";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";

type ThemeMode = "dark" | "light";

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const savedTheme = localStorage.getItem("task-theme");
    if (savedTheme === "dark" || savedTheme === "light") {
      return savedTheme;
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("task-theme", theme);
  }, [theme]);

  if (loading) return <p>Loading...</p>;

  return (
    <div className="app-shell">
      <button
        type="button"
        className="global-theme-toggle"
        onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
        aria-label="Toggle color mode"
      >
        {theme === "dark" ? "☀️ Light mode" : "🌙 Dark mode"}
      </button>

      {user ? <Dashboard /> : <Auth />}
    </div>
  );
}

export default App;