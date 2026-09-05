/* ===========================================================================
   Relay — Firebase initialization
   This file now uses Firebase SDK version 12.18.0 and contains your project config.
   =========================================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
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
export const db = getFirestore(app);
export const analytics = getAnalytics(app);
