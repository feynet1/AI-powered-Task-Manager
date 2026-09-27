const express = require("express");
const cors = require("cors");
const taskRoutes = require("./routes/tasks");
app.use("/tasks", taskRoutes);

const app = express();
app.use(cors());
app.use(express.json());

app.get("/ping", (req, res) => {
    res.json({ message: "Server is running 🚀" });
});

const PORT = 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});