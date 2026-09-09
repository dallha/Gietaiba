import { getWorkspaceAccessToken } from '../pages/UnifiedLogin.js';

const getAccessToken = (): string => {
  const cachedToken = getWorkspaceAccessToken();
  if (cachedToken) return cachedToken;
  
  throw new Error('Google Workspace access token not found. Please log out and sign in with Google again to refresh the token.');
};

export const exportToSheets = async (title: string, csvData: string) => {
  const token = getAccessToken();
  // We use multipart upload to Google Drive to create a spreadsheet
  const boundary = 'foo_bar_baz';
  const metadata = {
    name: title,
    mimeType: 'application/vnd.google-apps.spreadsheet'
  };
  const body = `
--${boundary}
Content-Type: application/json; charset=UTF-8

${JSON.stringify(metadata)}
--${boundary}
Content-Type: text/csv

${csvData}
--${boundary}--
  `.trim();

  const uploadRes = await fetch(`https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body
  });
  if (!uploadRes.ok) throw new Error('Failed to upload data to Google Sheets');
  return uploadRes.json();
};

export const createDocument = async (title: string, text: string) => {
  const token = getAccessToken();
  const createRes = await fetch(`https://docs.googleapis.com/v1/documents`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title
    })
  });
  if (!createRes.ok) {
    const errorText = await createRes.text();
    console.error("Docs creation error:", errorText);
    throw new Error('Failed to create document');
  }
  const docData = await createRes.json();

  const updateRes = await fetch(`https://docs.googleapis.com/v1/documents/${docData.documentId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      requests: [
        {
          insertText: {
            location: { index: 1 },
            text
          }
        }
      ]
    })
  });
  if (!updateRes.ok) throw new Error('Failed to update document text');
  return docData;
};

export const createTask = async (title: string, notes: string) => {
  const token = getAccessToken();
  const createRes = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/@default/tasks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title,
      notes
    })
  });
  if (!createRes.ok) throw new Error('Failed to create task');
  return createRes.json();
};

export const createForm = async (title: string) => {
  const token = getAccessToken();
  const createRes = await fetch(`https://forms.googleapis.com/v1/forms`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      info: { title }
    })
  });
  if (!createRes.ok) throw new Error('Failed to create form');
  return createRes.json();
};
