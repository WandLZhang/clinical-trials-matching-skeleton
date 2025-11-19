// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDdGN0bfe417Es3OGQxzUnShpoqbqVmN8g",
  authDomain: "wz-clinical-trials-skeleton.firebaseapp.com",
  projectId: "wz-clinical-trials-skeleton",
  storageBucket: "wz-clinical-trials-skeleton.firebasestorage.app",
  messagingSenderId: "121711875690",
  appId: "1:121711875690:web:6de7e80bfa74462f1e1c13"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export default app;
