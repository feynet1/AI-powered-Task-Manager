const express = require("express");
const router = express.Router();
const { db, adminAuth } = require("../firebaseAdmin");

router.use(async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : "";

    if (!token) {
      return res.status(401).json({ error: "Sign-in required." });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    req.userId = decoded.uid;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired sign-in token." });
  }
});

router.post("/", async (req, res) => {
  try {
    const {
      title,
      list = "Personal",
      status = "inbox",
      priority = "medium",
      dueDate = "",
      notes = "",
      recurrence = "",
      tags = [],
      assignee = "",
      project = "",
      description = "",
      dependencies = [],
      blocker = false,
      blockerNote = "",
      links = [],
      estimate = "",
      reporter = "",
    } = req.body;

    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ error: "A task title is required." });
    }

    if (!["low", "medium", "high"].includes(priority)) {
      return res.status(400).json({ error: "Invalid priority." });
    }

    const allowedStatus = [
      "inbox",
      "next",
      "doing",
      "waiting",
      "done",
      "backlog",
      "ready",
      "in-review",
      "blocked",
    ];

    if (!allowedStatus.includes(status)) {
      return res.status(400).json({ error: "Invalid status." });
    }

    const task = {
      title: title.trim(),
      list,
      status,
      completed: false,
      priority,
      dueDate: typeof dueDate === "string" ? dueDate : "",
      notes,
      recurrence,
      tags: Array.isArray(tags) ? tags : [],
      assignee,
      project,
      description,
      dependencies: Array.isArray(dependencies) ? dependencies : [],
      blocker: Boolean(blocker),
      blockerNote,
      links: Array.isArray(links) ? links : [],
      estimate,
      reporter,
      userId: req.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
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

    const tasks = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title,
        list: data.list || "Personal",
        status: data.status || "inbox",
        completed: Boolean(data.completed),
        priority: data.priority || "medium",
        dueDate: data.dueDate || "",
        notes: data.notes || "",
        recurrence: data.recurrence || "",
        tags: Array.isArray(data.tags) ? data.tags : [],
        assignee: data.assignee || "",
        project: data.project || "",
        description: data.description || "",
        dependencies: Array.isArray(data.dependencies) ? data.dependencies : [],
        blocker: Boolean(data.blocker),
        blockerNote: data.blockerNote || "",
        links: Array.isArray(data.links) ? data.links : [],
        estimate: data.estimate || "",
        reporter: data.reporter || "",
        createdAt: data.createdAt?.toDate?.() || data.createdAt || null,
        updatedAt: data.updatedAt?.toDate?.() || data.updatedAt || null,
      };
    });

    res.json(tasks);
  } catch (error) {
    console.error("Load tasks failed:", error);
    res.status(500).json({ error: "Could not load tasks." });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const {
      title,
      list,
      status,
      priority,
      dueDate,
      notes,
      recurrence,
      tags,
      assignee,
      project,
      description,
      dependencies,
      blocker,
      blockerNote,
      links,
      estimate,
      reporter,
      completed,
    } = req.body;

    const allowedStatus = [
      "inbox",
      "next",
      "doing",
      "waiting",
      "done",
      "backlog",
      "ready",
      "in-review",
      "blocked",
    ];

    const updates = {};

    if (title !== undefined) {
      if (typeof title !== "string" || !title.trim()) {
        return res.status(400).json({ error: "Invalid title." });
      }
      updates.title = title.trim();
    }

    if (list !== undefined) updates.list = list;
    if (status !== undefined) {
      if (!allowedStatus.includes(status)) {
        return res.status(400).json({ error: "Invalid status." });
      }
      updates.status = status;
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

    if (notes !== undefined) updates.notes = notes;
    if (recurrence !== undefined) updates.recurrence = recurrence;
    if (tags !== undefined) updates.tags = Array.isArray(tags) ? tags : [];
    if (assignee !== undefined) updates.assignee = assignee;
    if (project !== undefined) updates.project = project;
    if (description !== undefined) updates.description = description;
    if (dependencies !== undefined) {
      updates.dependencies = Array.isArray(dependencies) ? dependencies : [];
    }
    if (blocker !== undefined) updates.blocker = Boolean(blocker);
    if (blockerNote !== undefined) updates.blockerNote = blockerNote;
    if (links !== undefined) updates.links = Array.isArray(links) ? links : [];
    if (estimate !== undefined) updates.estimate = estimate;
    if (reporter !== undefined) updates.reporter = reporter;

    if (completed !== undefined) {
      if (typeof completed !== "boolean") {
        return res.status(400).json({ error: "Invalid completed value." });
      }
      updates.completed = completed;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No valid task fields provided." });
    }

    updates.updatedAt = new Date();

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
    return res.json({ message: "Deleted." });
  } catch (error) {
    console.error("Delete task failed:", error);
    return res.status(500).json({ error: "Could not delete task." });
  }
});

module.exports = router;