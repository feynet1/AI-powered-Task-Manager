const express = require("express");
const router = express.Router();
const { db, adminAuth } = require("../firebaseAdmin");

const ADMIN_EMAILS = new Set(["feymesay@gmail.com"]);

async function getUserRole(uid) {
  try {
    const [userRecord, userDoc] = await Promise.all([
      adminAuth.getUser(uid),
      db.collection("users").doc(uid).get(),
    ]);

    const normalizedEmail = userRecord.email?.toLowerCase();
    if (normalizedEmail && ADMIN_EMAILS.has(normalizedEmail)) {
      return "admin";
    }

    return userDoc.data()?.role || userRecord.customClaims?.role || "user";
  } catch {
    return "user";
  }
}

router.use(async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    if (!token) {
      return res.status(401).json({ error: "Authentication required." });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const role = await getUserRole(decoded.uid);

    if (role !== "admin") {
      return res.status(403).json({ error: "Admin access required." });
    }

    req.adminUid = decoded.uid;
    return next();
  } catch (error) {
    console.error("Admin auth failed:", error);
    return res.status(401).json({ error: "Invalid or expired token." });
  }
});

router.get("/overview", async (req, res) => {
  try {
    const [tasksSnap, usersSnap] = await Promise.all([
      db.collection("tasks").get(),
      db.collection("users").get(),
    ]);

    const tasks = tasksSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    const recentTasks = [...tasks]
      .sort((a, b) => {
        const aTime = new Date(a.createdAt?.seconds ? a.createdAt.seconds * 1000 : a.createdAt || 0).getTime();
        const bTime = new Date(b.createdAt?.seconds ? b.createdAt.seconds * 1000 : b.createdAt || 0).getTime();
        return bTime - aTime;
      })
      .slice(0, 10)
      .map((task) => ({
        id: task.id,
        title: task.title || "Untitled task",
        status: task.status || "inbox",
        priority: task.priority || "medium",
        createdAt: task.createdAt?.toDate ? task.createdAt.toDate().toISOString() : task.createdAt || null,
      }));

    return res.json({
      totalTasks: tasks.length,
      completedTasks: tasks.filter((task) => Boolean(task.completed)).length,
      pendingTasks: tasks.filter((task) => !task.completed).length,
      totalUsers: usersSnap.size,
      recentTasks,
    });
  } catch (error) {
    console.error("Admin overview failed:", error);
    return res.status(500).json({ error: "Could not load admin overview." });
  }
});

router.get("/tasks", async (req, res) => {
  try {
    const snapshot = await db.collection("tasks").orderBy("createdAt", "desc").get();
    const tasks = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return res.json(tasks);
  } catch (error) {
    console.error("Admin tasks failed:", error);
    return res.status(500).json({ error: "Could not load tasks." });
  }
});

router.get("/users", async (req, res) => {
  try {
    const list = await adminAuth.listUsers(1000);
    const users = await Promise.all(
      list.users.map(async (userRecord) => {
        const userDoc = await db.collection("users").doc(userRecord.uid).get();
        const metaRole = userDoc.data()?.role || userRecord.customClaims?.role || "user";

        return {
          uid: userRecord.uid,
          email: userRecord.email || "No email",
          displayName: userRecord.displayName || "Unknown user",
          role: metaRole,
          lastSignInAt: userRecord.metadata?.lastSignInTime || null,
        };
      })
    );

    return res.json(users.sort((a, b) => a.email.localeCompare(b.email)));
  } catch (error) {
    console.error("Admin users failed:", error);
    return res.status(500).json({ error: "Could not load users." });
  }
});

router.patch("/users/:uid/role", async (req, res) => {
  try {
    const { role } = req.body;
    const validRoles = ["user", "admin"];

    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: "Role must be 'user' or 'admin'." });
    }

    const uid = req.params.uid;
    await adminAuth.setCustomUserClaims(uid, { role });
    await db.collection("users").doc(uid).set({ role }, { merge: true });

    return res.json({ uid, role });
  } catch (error) {
    console.error("Admin user role update failed:", error);
    return res.status(500).json({ error: "Could not update user role." });
  }
});

router.patch("/tasks/:id", async (req, res) => {
  try {
    const { status, priority, completed, title } = req.body;
    const ref = db.collection("tasks").doc(req.params.id);
    const taskDoc = await ref.get();

    if (!taskDoc.exists) {
      return res.status(404).json({ error: "Task not found." });
    }

    const updates = {};

    if (title !== undefined) {
      if (typeof title !== "string" || !title.trim()) {
        return res.status(400).json({ error: "Invalid title." });
      }
      updates.title = title.trim();
    }

    if (status !== undefined) {
      const allowedStatuses = [
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

      if (!allowedStatuses.includes(status)) {
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
    await ref.update(updates);

    const updatedDoc = await ref.get();
    return res.json({ id: updatedDoc.id, ...updatedDoc.data() });
  } catch (error) {
    console.error("Admin task update failed:", error);
    return res.status(500).json({ error: "Could not update task." });
  }
});

router.delete("/tasks/:id", async (req, res) => {
  try {
    const ref = db.collection("tasks").doc(req.params.id);
    const taskDoc = await ref.get();

    if (!taskDoc.exists) {
      return res.status(404).json({ error: "Task not found." });
    }

    await ref.delete();
    return res.json({ message: "Deleted." });
  } catch (error) {
    console.error("Admin task delete failed:", error);
    return res.status(500).json({ error: "Could not delete task." });
  }
});

module.exports = router;
