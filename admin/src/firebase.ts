import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBxmcgQ2prd3qE6TzBTlYM00N1IAS0eRq4",
  authDomain: "ai-task-manager-f689f.firebaseapp.com",
  projectId: "ai-task-manager-f689f",
  storageBucket: "ai-task-manager-f689f.firebasestorage.app",
  messagingSenderId: "608053445128",
  appId: "1:608053445128:web:0cbfb4a221e0c281f287bd",
  measurementId: "G-ZLH080X23S",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export default app;
