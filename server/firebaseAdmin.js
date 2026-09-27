const { getApps, initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const serviceAccount = require("./ai-task-manager-f689f-639736ed80b3.json");

const app =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp({ credential: cert(serviceAccount) });

module.exports = {
  db: getFirestore(app),
  adminAuth: getAuth(app),
};

