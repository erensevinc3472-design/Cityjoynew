// CityJoy Firebase Yapılandırması
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyAZy4hvU2plhOSZjT21sDWQwyRSB0-SORE",
    authDomain: "cityjoy-d5d29.firebaseapp.com",
    projectId: "cityjoy-d5d29",
    storageBucket: "cityjoy-d5d29.firebasestorage.app",
    messagingSenderId: "1042083508506",
    appId: "1:1042083508506:web:2c246269fcca10683b3ca3",
    measurementId: "G-L6Q6DCMW94"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
