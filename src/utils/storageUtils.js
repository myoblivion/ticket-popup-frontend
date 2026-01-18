import { storage } from '../firebaseConfig';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

export const uploadFileToStorage = async (file, path) => {
  // Create a unique reference, e.g., "teams/team123/tasks/task456/filename.png"
  const storageRef = ref(storage, `${path}/${Date.now()}_${file.name}`);
  
  // Upload
  const snapshot = await uploadBytes(storageRef, file);
  
  // Get URL
  const downloadURL = await getDownloadURL(snapshot.ref);
  
  return {
    name: file.name,
    type: file.type,
    url: downloadURL // Save THIS to Firestore, not the base64 data
  };
};