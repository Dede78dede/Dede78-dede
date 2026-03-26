import { gapi } from 'gapi-script';
import { StorageProviderType, FileMimeType, ErrorCode } from '../core/enums';
import { Result, AppError, TryCatch } from '../core/errors';
import { IStorageProvider, StorageNode, StorageFileContent } from '../core/protocols';

/**
 * Configuration for Google Drive API.
 */
export interface GoogleDriveConfig {
  readonly clientId: string;
  readonly apiKey: string;
  readonly scopes: string;
  readonly discoveryDocs: string[];
}

/**
 * Google Drive implementation of the IStorageProvider protocol.
 * Handles OAuth2 authentication and Drive API interactions.
 */
export class GoogleDriveProvider implements IStorageProvider {
  public readonly type = StorageProviderType.GOOGLE_DRIVE;
  private readonly config: GoogleDriveConfig;
  private isInitialized = false;

  constructor(config: GoogleDriveConfig) {
    this.config = config;
  }

  /**
   * Initializes the Google API client and authenticates the user.
   */
  @TryCatch(ErrorCode.UNAUTHORIZED)
  public async initialize(): Promise<Result<void>> {
    if (this.isInitialized) return [null, undefined];

    await new Promise<void>((resolve, reject) => {
      gapi.load('client:auth2', {
        callback: resolve,
        onerror: reject,
      });
    });

    await gapi.client.init({
      apiKey: this.config.apiKey,
      clientId: this.config.clientId,
      discoveryDocs: this.config.discoveryDocs,
      scope: this.config.scopes,
    });

    const authInstance = gapi.auth2.getAuthInstance();
    if (!authInstance.isSignedIn.get()) {
      await authInstance.signIn();
    }

    this.isInitialized = true;
    return [null, undefined];
  }

  /**
   * Reads a file's content from Google Drive.
   */
  @TryCatch(ErrorCode.NETWORK_ERROR)
  public async readFile<T>(fileId: string): Promise<Result<StorageFileContent<T>>> {
    this.ensureInitialized();

    const response = await gapi.client.drive.files.get({
      fileId: fileId,
      alt: 'media',
    });

    const metadataResponse = await gapi.client.drive.files.get({
      fileId: fileId,
      fields: 'id, name, mimeType, modifiedTime, size, parents',
    });

    const metadata: StorageNode = {
      id: metadataResponse.result.id!,
      name: metadataResponse.result.name!,
      mimeType: metadataResponse.result.mimeType!,
      modifiedTime: metadataResponse.result.modifiedTime!,
      size: metadataResponse.result.size ? parseInt(metadataResponse.result.size, 10) : undefined,
      parentId: metadataResponse.result.parents?.[0],
    };

    let data: T;
    if (metadata.mimeType === FileMimeType.JSON) {
      data = typeof response.result === 'string' ? JSON.parse(response.result) : response.result;
    } else {
      data = response.result as unknown as T;
    }

    return [null, { data, metadata }];
  }

  /**
   * Writes content to a file in Google Drive.
   * Creates a new file if it doesn't exist, or updates an existing one.
   */
  @TryCatch(ErrorCode.NETWORK_ERROR)
  public async writeFile<T>(
    name: string,
    content: T,
    parentId?: string,
    mimeType: FileMimeType = FileMimeType.JSON
  ): Promise<Result<StorageNode>> {
    this.ensureInitialized();

    const existingFiles = await this.findFileByName(name, parentId);
    const fileId = existingFiles.length > 0 ? existingFiles[0].id : undefined;

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const close_delim = `\r\n--${boundary}--`;

    const metadata = {
      name,
      mimeType,
      ...(!fileId ? { parents: [parentId || 'appDataFolder'] } : {}),
    };

    const fileContent = typeof content === 'string' ? content : JSON.stringify(content);

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      `Content-Type: ${mimeType}\r\n\r\n` +
      fileContent +
      close_delim;

    const request = gapi.client.request({
      path: fileId ? `/upload/drive/v3/files/${fileId}` : '/upload/drive/v3/files',
      method: fileId ? 'PATCH' : 'POST',
      params: { uploadType: 'multipart', fields: 'id, name, mimeType, modifiedTime, size, parents' },
      headers: {
        'Content-Type': `multipart/related; boundary="${boundary}"`,
      },
      body: multipartRequestBody,
    });

    const response = await request;

    return [null, {
      id: response.result.id,
      name: response.result.name,
      mimeType: response.result.mimeType,
      modifiedTime: response.result.modifiedTime,
      size: response.result.size ? parseInt(response.result.size, 10) : undefined,
      parentId: response.result.parents?.[0],
    }];
  }

  /**
   * Lists files in a specific directory in Google Drive.
   */
  @TryCatch(ErrorCode.NETWORK_ERROR)
  public async listFiles(parentId?: string): Promise<Result<StorageNode[]>> {
    this.ensureInitialized();

    let query = "trashed = false";
    if (parentId) {
      query += ` and '${parentId}' in parents`;
    } else {
      query += ` and 'appDataFolder' in parents`;
    }

    const response = await gapi.client.drive.files.list({
      q: query,
      fields: 'files(id, name, mimeType, modifiedTime, size, parents)',
      spaces: 'appDataFolder',
    });

    const files = response.result.files || [];

    return [null, files.map((file) => ({
      id: file.id!,
      name: file.name!,
      mimeType: file.mimeType!,
      modifiedTime: file.modifiedTime!,
      size: file.size ? parseInt(file.size, 10) : undefined,
      parentId: file.parents?.[0],
    }))];
  }

  /**
   * Deletes a file from Google Drive.
   */
  @TryCatch(ErrorCode.NETWORK_ERROR)
  public async deleteFile(fileId: string): Promise<Result<void>> {
    this.ensureInitialized();

    await gapi.client.drive.files.delete({
      fileId: fileId,
    });
    
    return [null, undefined];
  }

  /**
   * Helper method to find a file by name and optional parent ID.
   */
  private async findFileByName(name: string, parentId?: string): Promise<gapi.client.drive.File[]> {
    let query = `name = '${name}' and trashed = false`;
    if (parentId) {
      query += ` and '${parentId}' in parents`;
    } else {
      query += ` and 'appDataFolder' in parents`;
    }

    const response = await gapi.client.drive.files.list({
      q: query,
      fields: 'files(id, name)',
      spaces: 'appDataFolder',
    });

    return response.result.files || [];
  }

  /**
   * Ensures the provider is initialized before making API calls.
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new AppError('Google Drive Provider not initialized', ErrorCode.UNAUTHORIZED);
    }
  }
}
