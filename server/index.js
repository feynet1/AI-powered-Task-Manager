const express = require("express");
const cors = require("cors");
const taskRoutes = require("./routes/tasks");

const app = express();

app.use(cors({ origin: "http://localhost:5173" })); // Adjust if your Vite port differs
app.use(express.json());
app.use("/tasks", taskRoutes);

app.get("/ping", (req, res) => {
  res.json({ message: "Server is running" });
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});