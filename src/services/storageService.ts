import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { storage } from './firebase';
import { readAsStringAsync } from 'expo-file-system';

export interface UploadResult {
  url: string;
  path: string;
}

// Upload custom alarm sound to Firebase Storage
export const uploadAlarmSound = async (
  uid: string,
  fileUri: string,
  fileName: string
): Promise<UploadResult> => {
  try {
    // Read file as base64
    const base64 = await readAsStringAsync(fileUri, {
      encoding: 'base64',
    });

    // Convert base64 to blob
    const response = await fetch(`data:audio/mpeg;base64,${base64}`);
    const blob = await response.blob();

    // Create storage reference
    const storagePath = `users/${uid}/alarm-sounds/${Date.now()}_${fileName}`;
    const storageRef = ref(storage, storagePath);

    // Upload file
    await uploadBytes(storageRef, blob);

    // Get download URL
    const url = await getDownloadURL(storageRef);

    return { url, path: storagePath };
  } catch (error) {
    console.error('Error uploading alarm sound:', error);
    throw error;
  }
};

// Delete alarm sound from Firebase Storage
export const deleteAlarmSound = async (storagePath: string): Promise<void> => {
  try {
    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);
  } catch (error) {
    console.error('Error deleting alarm sound:', error);
    throw error;
  }
};
