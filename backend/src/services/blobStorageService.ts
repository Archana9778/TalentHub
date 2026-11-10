/**
 * TalentHub Blob Storage Service
 * Abstraction over Azure Blob Storage / Azurite emulator.
 *
 * STORAGE_PROVIDER=azurite  → uses Azurite via connection string (local dev)
 * STORAGE_PROVIDER=azure    → uses DefaultAzureCredential (Managed Identity / Entra ID)
 *
 * SAS URLs:
 *   - Azurite: Shared Key SAS (supported by Azurite emulator)
 *   - Azure  : User Delegation SAS via DefaultAzureCredential or Shared Key
 */
import {
  BlobServiceClient,
  ContainerClient,
  BlobSASPermissions,
  SASProtocol,
  generateBlobSASQueryParameters,
  StorageSharedKeyCredential,
} from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';
import { config } from '../config';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UploadResult {
  blobName: string;
  blobUrl?: string;
  containerName: string;
  contentType: string;
  sizeBytes: number;
}

// ─── Credentials & Client ────────────────────────────────────────────────────

function buildBlobServiceClient(): BlobServiceClient {
  const provider = config.storage.provider;

  if (provider === 'azure') {
    // Production: Managed Identity / DefaultAzureCredential
    const accountName = config.storage.accountName;
    if (!accountName) {
      throw new Error('[BlobStorage] AZURE_STORAGE_ACCOUNT_NAME is required for provider=azure');
    }
    const credential = new DefaultAzureCredential();
    return new BlobServiceClient(
      `https://${accountName}.blob.core.windows.net`,
      credential
    );
  }

  // Azurite (local emulator)
  const connectionString = config.storage.connectionString;
  if (!connectionString) {
    throw new Error('[BlobStorage] AZURE_STORAGE_CONNECTION_STRING is required for provider=azurite');
  }
  return BlobServiceClient.fromConnectionString(connectionString);
}

let _client: BlobServiceClient | null = null;
export function getClient(): BlobServiceClient {
  if (!_client) _client = buildBlobServiceClient();
  return _client;
}

// ─── Container Initialisation ────────────────────────────────────────────────

let _containerEnsured = false;

export async function ensureContainer(): Promise<ContainerClient> {
  const client = getClient();
  const containerName = config.storage.containerName;
  const containerClient = client.getContainerClient(containerName);

  if (!_containerEnsured) {
    // Create private container (no anonymous access)
    await containerClient.createIfNotExists({ access: undefined });
    _containerEnsured = true;
    console.log(`[BlobStorage] Container '${containerName}' ready.`);
  }

  return containerClient;
}

// ─── Upload ──────────────────────────────────────────────────────────────────

export async function uploadResumeBuffer(
  blobName: string,
  buffer: Buffer,
  mimeType: string,
  originalFilenameOrMeta?: string | Record<string, string>
): Promise<UploadResult> {
  const containerClient = await ensureContainer();
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  const originalFilename = typeof originalFilenameOrMeta === 'string'
    ? originalFilenameOrMeta
    : (originalFilenameOrMeta?.originalName || 'resume.pdf');

  const metadata: Record<string, string> = typeof originalFilenameOrMeta === 'object' && originalFilenameOrMeta !== null
    ? { ...originalFilenameOrMeta, originalFilename: encodeURIComponent(originalFilename) }
    : {
        originalFilename: encodeURIComponent(originalFilename),
        uploadedAt: new Date().toISOString(),
      };

  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: {
      blobContentType: mimeType,
      blobContentDisposition: `attachment; filename="${encodeURIComponent(originalFilename)}"`,
    },
    metadata,
  });

  return {
    blobName,
    blobUrl: blockBlobClient.url,
    containerName: config.storage.containerName,
    contentType: mimeType,
    sizeBytes: buffer.length,
  };
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteBlob(blobName: string): Promise<boolean> {
  try {
    const containerClient = await ensureContainer();
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    const result = await blockBlobClient.deleteIfExists();
    return result.succeeded;
  } catch (err) {
    console.error(`[BlobStorage] deleteBlob(${blobName}) failed:`, err);
    return false;
  }
}

// ─── SAS URL Generation ───────────────────────────────────────────────────────

export async function generateReadSasUrl(
  blobName: string,
  expiryMinutes: number = config.storage.sasExpiryMinutes
): Promise<string> {
  const provider = config.storage.provider;
  const containerName = config.storage.containerName;

  if (provider === 'azure') {
    return _generateAzureSasUrl(containerName, blobName, expiryMinutes);
  }

  return _generateAzuriteSasUrl(containerName, blobName, expiryMinutes);
}

/**
 * Azurite: Shared Key SAS (the only mechanism supported by the emulator).
 * Account key is sourced from AZURE_STORAGE_CONNECTION_STRING server-side only.
 * Never sent to the client.
 */
function _generateAzuriteSasUrl(
  containerName: string,
  blobName: string,
  expiryMinutes: number
): string {
  const connStr = config.storage.connectionString;
  if (!connStr) throw new Error('[BlobStorage] Missing connection string for Azurite SAS');

  const params = _parseConnectionString(connStr);
  const accountName = params['AccountName'] || config.storage.accountName;
  const accountKey = params['AccountKey'];

  if (!accountName || !accountKey) {
    throw new Error('[BlobStorage] Cannot parse AccountName / AccountKey from connection string');
  }

  const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
  const startsOn = new Date(Date.now() - 5 * 60 * 1000); // 5-minute clock skew tolerance
  const expiresOn = new Date(Date.now() + expiryMinutes * 60 * 1000);

  const sasQueryParams = generateBlobSASQueryParameters(
    {
      containerName,
      blobName,
      permissions: BlobSASPermissions.parse('r'), // read-only
      startsOn,
      expiresOn,
      protocol: SASProtocol.HttpsAndHttp, // Azurite runs on HTTP locally
    },
    sharedKeyCredential
  );

  const blobEndpoint = params['BlobEndpoint'] || `http://127.0.0.1:10000/${accountName}`;
  return `${blobEndpoint}/${containerName}/${blobName}?${sasQueryParams.toString()}`;
}

/**
 * Azure Production: User Delegation SAS via DefaultAzureCredential.
 * Requires Storage Blob Data Reader role + Entra token.
 */
async function _generateAzureSasUrl(
  containerName: string,
  blobName: string,
  expiryMinutes: number
): Promise<string> {
  const accountName = config.storage.accountName;
  if (!accountName) throw new Error('[BlobStorage] AZURE_STORAGE_ACCOUNT_NAME missing');

  const client = getClient();
  const startsOn = new Date(Date.now() - 5 * 60 * 1000);
  const expiresOn = new Date(Date.now() + expiryMinutes * 60 * 1000);

  const userDelegationKey = await client.getUserDelegationKey(startsOn, expiresOn);

  const sasQueryParams = generateBlobSASQueryParameters(
    {
      containerName,
      blobName,
      permissions: BlobSASPermissions.parse('r'),
      startsOn,
      expiresOn,
      protocol: SASProtocol.Https,
    },
    userDelegationKey,
    accountName
  );

  return `https://${accountName}.blob.core.windows.net/${containerName}/${blobName}?${sasQueryParams.toString()}`;
}

export async function downloadBlobToBuffer(blobName: string): Promise<Buffer> {
  const containerClient = await ensureContainer();
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  return await blockBlobClient.downloadToBuffer();
}

/** Health-check: returns true if the Blob service endpoint is reachable. */
export async function pingBlobStorage(): Promise<boolean> {
  try {
    const client = getClient();
    const iter = client.listContainers();
    await iter.next();
    return true;
  } catch {
    return false;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _parseConnectionString(connStr: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of connStr.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) {
      result[part.substring(0, idx).trim()] = part.substring(idx + 1).trim();
    }
  }
  return result;
}

export class BlobStorageService {
  static getClient = getClient;
  static ensureContainer = ensureContainer;
  static uploadResumeBuffer = uploadResumeBuffer;
  static deleteBlob = deleteBlob;
  static generateReadSasUrl = generateReadSasUrl;
  static downloadBlobToBuffer = downloadBlobToBuffer;
  static pingBlobStorage = pingBlobStorage;
}
