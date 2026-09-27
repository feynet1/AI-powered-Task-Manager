import { useState } from "react";
import { auth } from "../firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import "./Signup.css";

function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleSignup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      console.log(userCredential.user);
      setMessage("Account created successfully!");
    } catch (error) {
      setMessage("Error creating account. Please try again.");
      console.error(error);
    }
  };

  return (
    <main className="signup-page">
      <form className="signup-card" onSubmit={handleSignup}>
        <h2>Create your account</h2>
        <p className="signup-description">Sign up to get started.</p>

        <label htmlFor="signup-email">Email</label>
        <input
          id="signup-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          required
        />

        <label htmlFor="signup-password">Password</label>
        <input
          id="signup-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="At least 6 characters"
          autoComplete="new-password"
          minLength={6}
          required
        />

        <button type="submit">Sign up</button>
        {message && <p className="signup-message">{message}</p>}
      </form>
    </main>
  );
}

export default Signup;