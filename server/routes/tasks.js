const express = require("express");
const router = express.Router();
const { db, adminAuth } = require("../firebaseAdmin");

router.use(async (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";

    if (!token) {
      return res.status(401).json({ error: "Sign-in required." });
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    req.userId = decodedToken.uid;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired sign-in token." });
  }
});

router.post("/", async (req, res) => {
  try {
    const { title, priority = "medium", dueDate = "" } = req.body;

    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ error: "A task title is required." });
    }

    if (!["low", "medium", "high"].includes(priority)) {
      return res.status(400).json({ error: "Invalid priority." });
    }

    if (typeof dueDate !== "string") {
      return res.status(400).json({ error: "Invalid due date." });
    }

    const task = {
      title: title.trim(),
      completed: false,
      priority,
      dueDate,
      userId: req.userId,
      createdAt: new Date(),
    };

    const ref = await db.collection("tasks").add(task);
    res.status(201).json({ id: ref.id, ...task });
  } catch (error) {
    console.error("Create task failed:", error);
    res.status(500).json({ error: "Could not create task." });
  }
});

router.get("/", async (req, res) => {
  try {
    const snapshot = await db
      .collection("tasks")
      .where("userId", "==", req.userId)
      .get();

    res.json(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
  } catch (error) {
    console.error("Load tasks failed:", error);
    res.status(500).json({ error: "Could not load tasks." });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { title, priority, dueDate, completed } = req.body;
    const updates = {};

    if (title !== undefined) {
      if (typeof title !== "string" || !title.trim()) {
        return res.status(400).json({ error: "Invalid task title." });
      }
      updates.title = title.trim();
    }

    if (priority !== undefined) {
      if (!["low", "medium", "high"].includes(priority)) {
        return res.status(400).json({ error: "Invalid priority." });
      }
      updates.priority = priority;
    }

    if (dueDate !== undefined) {
      if (typeof dueDate !== "string") {
        return res.status(400).json({ error: "Invalid due date." });
      }
      updates.dueDate = dueDate;
    }

    if (completed !== undefined) {
      if (typeof completed !== "boolean") {
        return res.status(400).json({ error: "Invalid completed value." });
      }
      updates.completed = completed;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No valid task fields provided." });
    }

    const ref = db.collection("tasks").doc(req.params.id);
    const taskDoc = await ref.get();

    if (!taskDoc.exists || taskDoc.data().userId !== req.userId) {
      return res.status(404).json({ error: "Task not found." });
    }

    await ref.update(updates);
    return res.json({ id: ref.id, ...taskDoc.data(), ...updates });
  } catch (error) {
    console.error("Update task failed:", error);
    return res.status(500).json({ error: "Could not update task." });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const ref = db.collection("tasks").doc(req.params.id);
    const taskDoc = await ref.get();

    if (!taskDoc.exists || taskDoc.data().userId !== req.userId) {
      return res.status(404).json({ error: "Task not found." });
    }

    await ref.delete();
    res.json({ message: "Deleted." });
  } catch (error) {
    console.error("Delete task failed:", error);
    res.status(500).json({ error: "Could not delete task." });
  }
});

module.exports = router;