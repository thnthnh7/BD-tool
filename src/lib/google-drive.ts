"use client";

const SCOPES = "https://www.googleapis.com/auth/drive.file";
const DISCOVERY_DOC = "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest";

let tokenClient: google.accounts.oauth2.TokenClient | null = null;
let gapiInited = false;
let gisInited = false;
let accessToken: string | null = null;

function getClientId() {
  const id = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!id) throw new Error("Missing NEXT_PUBLIC_GOOGLE_CLIENT_ID in environment variables");
  return id;
}

function loadScript(src: string): Promise<void> {
  if (document.querySelector(`script[src="${src}"]`)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

async function ensureGapiLoaded(): Promise<void> {
  if (gapiInited) return;
  await loadScript("https://apis.google.com/js/api.js");
  await new Promise<void>((resolve) => gapi.load("client", resolve));
  await gapi.client.init({ discoveryDocs: [DISCOVERY_DOC] });
  gapiInited = true;
}

async function ensureGisLoaded(): Promise<void> {
  if (gisInited) return;
  await loadScript("https://accounts.google.com/gsi/client");
  gisInited = true;
}

function requestAccessToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: getClientId(),
        scope: SCOPES,
        callback: (response) => {
          if (response.error) {
            reject(new Error(response.error_description || response.error));
            return;
          }
          accessToken = response.access_token;
          resolve(response.access_token);
        },
      });
    }

    if (accessToken) {
      resolve(accessToken);
      return;
    }

    tokenClient.requestAccessToken({ prompt: "consent" });
  });
}

async function authenticate(): Promise<string> {
  await ensureGapiLoaded();
  await ensureGisLoaded();
  return requestAccessToken();
}

export type DriveUploadResult = {
  fileId: string;
  webViewLink: string;
};

export async function uploadExcelToDrive(
  buffer: ArrayBuffer,
  fileName: string,
  folderId?: string,
): Promise<DriveUploadResult> {
  const token = await authenticate();

  const metadata: Record<string, unknown> = {
    name: fileName,
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
  if (folderId) metadata.parents = [folderId];

  const form = new FormData();
  form.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" }),
  );
  form.append(
    "file",
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    },
  );

  if (!response.ok) {
    const text = await response.text();
    if (response.status === 401) {
      accessToken = null;
      throw new Error("Google session expired. Please try again.");
    }
    throw new Error(`Drive upload failed: ${text}`);
  }

  const data = await response.json();
  return { fileId: data.id, webViewLink: data.webViewLink };
}

export function revokeGoogleAccess() {
  if (accessToken) {
    google.accounts.oauth2.revoke(accessToken, () => {});
    accessToken = null;
  }
}
