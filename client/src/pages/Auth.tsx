import { useState, type FormEvent } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "../firebase";
import "./Signup.css";

function Auth() {
  const [isSignup, setIsSignup] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");

    try {
      if (isSignup) {
        await createUserWithEmailAndPassword(auth, email, password);
        setMessage("Account created successfully!");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        setMessage("Logged in successfully!");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    }
  };

  const switchMode = () => {
    setIsSignup(!isSignup);
    setMessage("");
  };

  return (
    <main className="signup-page">
      <form className="signup-card" onSubmit={handleSubmit}>
        <h2>{isSignup ? "Create your account" : "Log in"}</h2>

        <label htmlFor="auth-email">Email</label>
        <input
          id="auth-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
        />

        <label htmlFor="auth-password">Password</label>
        <input
          id="auth-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete={isSignup ? "new-password" : "current-password"}
          minLength={isSignup ? 6 : undefined}
          required
        />

        <button type="submit">{isSignup ? "Sign up" : "Log in"}</button>

        {message && <p role="status">{message}</p>}

        <p>
          {isSignup ? "Already have an account?" : "Need an account?"}{" "}
          <button type="button" onClick={switchMode}>
            {isSignup ? "Log in" : "Sign up"}
          </button>
        </p>
      </form>
    </main>
  );
}

export default Auth;