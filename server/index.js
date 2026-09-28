const express = require("express");
const cors = require("cors");
const taskRoutes = require("./routes/tasks");


const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json());
app.use("/tasks", taskRoutes);

app.get("/ping", (req, res) => {
  res.json({ message: "Server is running" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});