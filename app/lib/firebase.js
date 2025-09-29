import { initializeApp } from 'firebase/app';
import { getFirestore } from '@firebase/firestore';
import {getAuth} from "firebase/auth";
import { getStorage} from "firebase/storage";
import { getMessaging, onMessage, getToken } from "firebase/messaging";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyBHacwj15LBBgPxVhxHJakT5yPSWMoRjXQ",
    authDomain: "larn-fa8d1.firebaseapp.com",
    projectId: "larn-fa8d1",
    storageBucket: "larn-fa8d1.appspot.com",
    messagingSenderId: "249805182808",
    appId: "1:249805182808:web:5a08166712763ed251b72d",
    measurementId: "G-0GMGNXM2ZZ"
  };
  
const app = initializeApp(firebaseConfig);

let messaging;
if (typeof window !== "undefined" && "Notification" in window) {
  messaging = getMessaging(app);
}
export { messaging, onMessage, getToken };
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage();
