import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyCpjitabGljJDWnDxvu5y6l4CuNqe6ovQE",
    authDomain: "lernen-deutsch-38102.firebaseapp.com",
    databaseURL: "https://lernen-deutsch-38102-default-rtdb.firebaseio.com",
    projectId: "lernen-deutsch-38102",
    storageBucket: "lernen-deutsch-38102.firebasestorage.app",
    messagingSenderId: "1062030106036",
    appId: "1:1062030106036:web:b545aac2e79fed31fca6e1",
    measurementId: "G-11BZ1C0L6R"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const database = getDatabase(app);
