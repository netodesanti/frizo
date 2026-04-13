import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDv6pIcOt7YGK6uN55FlBSG78WzVoqHrL8",
  authDomain: "frizo-orders.firebaseapp.com",
  projectId: "frizo-orders",
  storageBucket: "frizo-orders.firebasestorage.app",
  messagingSenderId: "523939130689",
  appId: "1:523939130689:web:50a7e62a4b088fe09305c0"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
