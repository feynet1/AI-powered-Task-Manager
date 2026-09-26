const express = require("express");
const router = express.Router();
const db = require("../firebaseAdmin");

// CREATE TASK
router.post("/", async (req, res) => {
  try {
    const { title, userId } = req.body;

    const newTask = {
      title,
      status: "pending",
      createdAt: new Date(),
      userId,
    };

    const docRef = await db.collection("tasks").add(newTask);

    res.json({ id: docRef.id, ...newTask });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET TASKS
router.get("/:userId", async (req, res) => {
  try {
    const snapshot = await db
      .collection("tasks")
      .where("userId", "==", req.params.userId)
      .get();

    const tasks = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// UPDATE TASK
router.put("/:id", async (req, res) => {
  try {
    await db.collection("tasks").doc(req.params.id).update(req.body);
    res.json({ message: "Updated" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE TASK
router.delete("/:id", async (req, res) => {
  try {
    await db.collection("tasks").doc(req.params.id).delete();
    res.json({ message: "Deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;