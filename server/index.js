const express = require("express");
const cors = require("cors");
const taskRoutes = require("./routes/tasks");
const adminRoutes = require("./routes/admin");

const app = express();
const allowedOrigins = [
  process.env.CLIENT_ORIGIN || "http://localhost:5173",
  process.env.CLIENT_ORIGIN_ALT || "http://127.0.0.1:5173",
  process.env.ADMIN_ORIGIN || "http://localhost:5174",
  process.env.ADMIN_ORIGIN_ALT || "http://127.0.0.1:5174",
];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());
app.use("/tasks", taskRoutes);
app.use("/admin", adminRoutes);

app.get("/ping", (req, res) => {
  res.json({ message: "Server is running" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});