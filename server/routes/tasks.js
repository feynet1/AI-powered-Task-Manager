const express = require("express");
const router = express.Router();
const { db, adminAuth } = require("../firebaseAdmin");

const WEEKDAYS = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const ALLOWED_STATUSES = [
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

function parseRecurrence(rule) {
  if (typeof rule !== "string") return null;

  const value = rule.trim();

  const weekdayMatch = value.match(
    /^every\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/i
  );

  if (weekdayMatch) {
    return {
      type: "weekday",
      day: WEEKDAYS[weekdayMatch[1].toLowerCase()],
    };
  }

  const intervalMatch = value.match(
    /^every\s+([1-6])\s+(days?|weeks?|months?|years?)$/i
  );

  if (!intervalMatch) return null;

  return {
    type: "interval",
    interval: Number(intervalMatch[1]),
    unit: intervalMatch[2].toLowerCase().replace(/s$/, ""),
  };
}

function dateOnlyAsUtc(value, fallback) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
    if (!Number.isNaN(date.getTime())) return date;
  }

  return new Date(fallback);
}

function addMonthsClamped(date, months) {
  const targetMonth = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1)
  );

  const lastDayOfTargetMonth = new Date(
    Date.UTC(
      targetMonth.getUTCFullYear(),
      targetMonth.getUTCMonth() + 1,
      0
    )
  ).getUTCDate();

  return new Date(
    Date.UTC(
      targetMonth.getUTCFullYear(),
      targetMonth.getUTCMonth(),
      Math.min(date.getUTCDate(), lastDayOfTargetMonth)
    )
  );
}

function getNextDueDate(rule, currentDueDate, completedAt) {
  const recurrence = parseRecurrence(rule);
  if (!recurrence) return "";

  const completionDate = new Date(completedAt);
  completionDate.setUTCHours(0, 0, 0, 0);

  const baseDate = currentDueDate
    ? dateOnlyAsUtc(currentDueDate, completionDate)
    : new Date(completionDate);

  let nextDate;

  if (recurrence.type === "weekday") {
    nextDate = new Date(baseDate);

    const daysUntilWeekday =
      (recurrence.day - nextDate.getUTCDay() + 7) % 7 || 7;

    nextDate.setUTCDate(nextDate.getUTCDate() + daysUntilWeekday);

    while (nextDate <= completionDate) {
      nextDate.setUTCDate(nextDate.getUTCDate() + 7);
    }
  } else {
    const unitDays = {
      day: 1,
      week: 7,
    };

    let intervalCount = 1;

    const calculateDate = (count) => {
      const amount = recurrence.interval * count;

      if (recurrence.unit in unitDays) {
        const date = new Date(baseDate);
        date.setUTCDate(
          date.getUTCDate() + amount * unitDays[recurrence.unit]
        );
        return date;
      }

      const months = recurrence.unit === "year" ? amount * 12 : amount;
      return addMonthsClamped(baseDate, months);
    };

    nextDate = calculateDate(intervalCount);

    while (nextDate <= completionDate) {
      intervalCount += 1;
      nextDate = calculateDate(intervalCount);
    }
  }

  return nextDate.toISOString().slice(0, 10);
}

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
    return next();
  } catch {
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

    if (
      typeof recurrence !== "string" ||
      (recurrence.trim() && !parseRecurrence(recurrence))
    ) {
      return res.status(400).json({
        error:
          "Use a recurrence like 'Every Friday' or an interval from 1 to 6, such as 'Every 2 weeks'.",
      });
    }

    if (!ALLOWED_STATUSES.includes(status)) {
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
      recurrence: recurrence.trim(),
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
    return res.status(201).json({ id: ref.id, ...task });
  } catch (error) {
    console.error("Create task failed:", error);
    return res.status(500).json({ error: "Could not create task." });
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
        recurrenceNextTaskId: data.recurrenceNextTaskId || "",
        tags: Array.isArray(data.tags) ? data.tags : [],
        assignee: data.assignee || "",
        project: data.project || "",
        description: data.description || "",
        dependencies: Array.isArray(data.dependencies)
          ? data.dependencies
          : [],
        blocker: Boolean(data.blocker),
        blockerNote: data.blockerNote || "",
        links: Array.isArray(data.links) ? data.links : [],
        estimate: data.estimate || "",
        reporter: data.reporter || "",
        createdAt: data.createdAt?.toDate?.() || data.createdAt || null,
        updatedAt: data.updatedAt?.toDate?.() || data.updatedAt || null,
      };
    });

    return res.json(tasks);
  } catch (error) {
    console.error("Load tasks failed:", error);
    return res.status(500).json({ error: "Could not load tasks." });
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

    const updates = {};

    if (title !== undefined) {
      if (typeof title !== "string" || !title.trim()) {
        return res.status(400).json({ error: "Invalid title." });
      }
      updates.title = title.trim();
    }

    if (list !== undefined) updates.list = list;

    if (status !== undefined) {
      if (!ALLOWED_STATUSES.includes(status)) {
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

    if (recurrence !== undefined) {
      if (
        typeof recurrence !== "string" ||
        (recurrence.trim() && !parseRecurrence(recurrence))
      ) {
        return res.status(400).json({
          error:
            "Use a recurrence like 'Every Friday' or an interval from 1 to 6, such as 'Every 2 weeks'.",
        });
      }
      updates.recurrence = recurrence.trim();
    }

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

    const ref = db.collection("tasks").doc(req.params.id);
    const nextRef = db.collection("tasks").doc();
    const now = new Date();

    const updatedTask = await db.runTransaction(async (transaction) => {
      const taskDoc = await transaction.get(ref);

      if (!taskDoc.exists || taskDoc.data().userId !== req.userId) {
        const notFoundError = new Error("Task not found.");
        notFoundError.statusCode = 404;
        throw notFoundError;
      }

      const currentTask = taskDoc.data();
      const transactionUpdates = { ...updates, updatedAt: now };
      const finalTask = { ...currentTask, ...transactionUpdates };

      const wasCompleted =
        currentTask.completed === true || currentTask.status === "done";
      const isNowCompleted =
        finalTask.completed === true || finalTask.status === "done";
      const hasRecurrence = Boolean(parseRecurrence(finalTask.recurrence));

      const shouldCreateNext =
        !wasCompleted &&
        isNowCompleted &&
        hasRecurrence &&
        !currentTask.recurrenceNextTaskId;

      if (shouldCreateNext) {
        transactionUpdates.recurrenceNextTaskId = nextRef.id;

        const nextTask = {
          ...finalTask,
          status: "inbox",
          completed: false,
          dueDate: getNextDueDate(
            finalTask.recurrence,
            finalTask.dueDate,
            now
          ),
          createdAt: now,
          updatedAt: now,
        };

        delete nextTask.recurrenceNextTaskId;
        transaction.set(nextRef, nextTask);
      }

      transaction.update(ref, transactionUpdates);
      return { ...finalTask, ...transactionUpdates };
    });

    return res.json({ id: ref.id, ...updatedTask });
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({ error: error.message });
    }

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