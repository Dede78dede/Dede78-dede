/**
 * VaultFirewall (Command Guardian)
 * 
 * Implements a security pipeline for the Obsidian MCP integration.
 * Ensures that LLMs and Agents cannot perform destructive actions
 * (like path traversal, deleting files, or writing outside allowed directories).
 */
export class VaultFirewall {
  private allowedWritePath: string;

  constructor(allowedWritePath: string = 'AI/Responses') {
    // Normalize the allowed path (remove leading/trailing slashes)
    this.allowedWritePath = this.normalizePath(allowedWritePath);
  }

  /**
   * Updates the allowed write path dynamically.
   */
  setAllowedWritePath(path: string) {
    this.allowedWritePath = this.normalizePath(path);
  }

  /**
   * Validates a read request.
   * Prevents path traversal attacks.
   */
  validateRead(filePath: string): boolean {
    if (this.hasPathTraversal(filePath)) {
      console.error(`[VaultFirewall] Blocked read attempt with path traversal: ${filePath}`);
      return false;
    }
    return true;
  }

  /**
   * Validates a write request.
   * Ensures the file is written ONLY within the allowed directory
   * and prevents path traversal.
   */
  validateWrite(filePath: string): boolean {
    if (this.hasPathTraversal(filePath)) {
      console.error(`[VaultFirewall] Blocked write attempt with path traversal: ${filePath}`);
      return false;
    }

    const normalizedFilePath = this.normalizePath(filePath);
    
    // If allowedWritePath is empty, we allow writing anywhere (not recommended, but possible)
    if (this.allowedWritePath === '') {
      return true;
    }

    // Check if the file path starts with the allowed directory
    if (!normalizedFilePath.startsWith(this.allowedWritePath + '/')) {
      console.error(`[VaultFirewall] Blocked write attempt outside allowed directory (${this.allowedWritePath}): ${filePath}`);
      return false;
    }

    return true;
  }

  /**
   * Validates a list request.
   * Prevents path traversal.
   */
  validateList(directory: string): boolean {
    if (this.hasPathTraversal(directory)) {
      console.error(`[VaultFirewall] Blocked list attempt with path traversal: ${directory}`);
      return false;
    }
    return true;
  }

  /**
   * Checks for path traversal sequences (e.g., ../ or absolute paths).
   */
  private hasPathTraversal(path: string): boolean {
    // Block absolute paths (starting with / or C:\)
    if (path.startsWith('/') || path.startsWith('\\') || /^[a-zA-Z]:\\/.test(path)) {
      return true;
    }
    
    // Block parent directory traversal
    if (path.includes('../') || path.includes('..\\')) {
      return true;
    }

    return false;
  }

  /**
   * Normalizes a path by removing leading/trailing slashes and replacing backslashes.
   */
  private normalizePath(path: string): string {
    return path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  }
}
