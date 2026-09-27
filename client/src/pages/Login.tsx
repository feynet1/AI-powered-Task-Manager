import { useState, type FormEvent } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import "./Signup.css";

function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [message, setMessage] = useState("");

    const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setMessage("");

        try {
            const userCredential = await signInWithEmailAndPassword(
                auth,
                email,
                password
            );
            setMessage(`Welcome, ${userCredential.user.email}!`);
        } catch (error) {
            setMessage(
                error instanceof Error ? error.message : "Unable to log in."
            );
        }
    };

    return (
        <main className="signup-page">
            <form className="signup-card" onSubmit={handleLogin}>
                <h2>Log in</h2>

                <label htmlFor="login-email">Email</label>
                <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    required
                />

                <label htmlFor="login-password">Password</label>
                <input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    required
                />

                <button type="submit">Log in</button>
                {message && <p role="status">{message}</p>}
            </form>
        </main>
    );
}

export default Login;