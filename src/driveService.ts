/**
 * Google Drive integration service for LPG Service Portal.
 * Complies with Google Workspace Skill guidelines:
 * - Scope: https://www.googleapis.com/auth/drive.file
 * - In-memory access token storage (no localStorage/sessionStorage)
 * - User confirmation required for destructive operations (delete)
 */

declare const firebase: any;

let cachedAccessToken: string | null = null;
let currentDriveUser: any = null;

// Initialize Drive secondary Firebase App or reuse global Firebase app
function getDriveAuth() {
  if (typeof window === 'undefined' || typeof firebase === 'undefined') {
    throw new Error('Firebase script is loading. Please try again.');
  }

  // Check if drive app is already created
  let driveApp = firebase.apps.find((a: any) => a.name === 'google_drive_app');
  if (!driveApp) {
    // Config from /firebase-applet-config.json
    const config = {
      projectId: "gen-lang-client-0356696938",
      appId: "1:689731429541:web:fbdd877e2b8b9a88e7994c",
      apiKey: "AIzaSyBNiD2Vg0Dw69xUYibyMTeea5jyin75cPw",
      authDomain: "gen-lang-client-0356696938.firebaseapp.com",
      storageBucket: "gen-lang-client-0356696938.firebasestorage.app",
      messagingSenderId: "689731429541"
    };
    driveApp = firebase.initializeApp(config, 'google_drive_app');
  }
  return driveApp.auth();
}

/**
 * Sign in with Google Drive scope and cache access token in-memory only.
 */
export async function connectGoogleDrive(): Promise<{ user: any; token: string }> {
  const auth = getDriveAuth();
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/drive.file');
  provider.setCustomParameters({ prompt: 'select_account' });

  const result = await auth.signInWithPopup(provider);
  const credential = result.credential;

  if (!credential?.accessToken) {
    throw new Error('Failed to obtain Google Drive access token.');
  }

  cachedAccessToken = credential.accessToken;
  currentDriveUser = result.user;

  return {
    user: currentDriveUser,
    token: cachedAccessToken!
  };
}

/**
 * Disconnect Google Drive and clear token from memory.
 */
export async function disconnectGoogleDrive(): Promise<void> {
  cachedAccessToken = null;
  currentDriveUser = null;
  try {
    const auth = getDriveAuth();
    await auth.signOut();
  } catch (err) {
    console.warn('Sign out warning:', err);
  }
}

/**
 * Get the in-memory cached token.
 */
export function getCachedDriveToken(): string | null {
  return cachedAccessToken;
}

export function getCurrentDriveUser(): any {
  return currentDriveUser;
}

/**
 * Upload an LPG delivery report or backup file to Google Drive.
 */
export async function uploadToGoogleDrive(
  fileName: string,
  content: string,
  mimeType: string = 'text/plain'
): Promise<any> {
  const token = getCachedDriveToken();
  if (!token) {
    throw new Error('Google Drive is not connected. Please connect first.');
  }

  const metadata = {
    name: fileName,
    mimeType: mimeType,
    description: 'Saved from LPG Service Portal'
  };

  const boundary = '-------314159265358979323846';
  const delimiter = "\r\n--" + boundary + "\r\n";
  const closeDelimiter = "\r\n--" + boundary + "--";

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: ' + mimeType + '\r\n\r\n' +
    content +
    closeDelimiter;

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,createdTime',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: multipartRequestBody
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error('Drive upload failed: ' + errText);
  }

  return await response.json();
}

/**
 * List files created or accessible by this app in Google Drive.
 */
export async function listDriveFiles(): Promise<any[]> {
  const token = getCachedDriveToken();
  if (!token) return [];

  const response = await fetch(
    'https://www.googleapis.com/drive/v3/files?q=trashed=false&fields=files(id,name,mimeType,createdTime,size,webViewLink)&orderBy=createdTime desc',
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error('Failed to list Google Drive files: ' + errText);
  }

  const data = await response.json();
  return data.files || [];
}

/**
 * Delete a file in Google Drive with required user confirmation dialog.
 */
export async function deleteDriveFile(fileId: string, fileName: string): Promise<boolean> {
  const token = getCachedDriveToken();
  if (!token) {
    throw new Error('Google Drive is not connected.');
  }

  // MANDATORY USER CONFIRMATION
  const confirmed = window.confirm(
    `Are you sure you want to permanently delete "${fileName}" from Google Drive? This action cannot be undone.`
  );
  if (!confirmed) return false;

  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error('Failed to delete file from Google Drive: ' + errText);
  }

  return true;
}

// Expose on window for convenient portal integration
if (typeof window !== 'undefined') {
  (window as any).driveService = {
    connect: connectGoogleDrive,
    disconnect: disconnectGoogleDrive,
    getToken: getCachedDriveToken,
    getUser: getCurrentDriveUser,
    upload: uploadToGoogleDrive,
    listFiles: listDriveFiles,
    deleteFile: deleteDriveFile
  };
}
