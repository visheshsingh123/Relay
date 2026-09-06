import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-storage.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyAuSpkUAE9WDqQYFHjwDmKlM7xVHWmrRXc",
  authDomain: "relay-d08d9.firebaseapp.com",
  projectId: "relay-d08d9",
  storageBucket: "relay-d08d9.firebasestorage.app",
  messagingSenderId: "514747185252",
  appId: "1:514747185252:web:4eed7954cb0ff4ca960771",
  measurementId: "G-EP6Q8H6DVH"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Enable IndexedDB persistent local cache for instant loads & multi-tab sync
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

export const storage = getStorage(app);
export const analytics = getAnalytics(app);
