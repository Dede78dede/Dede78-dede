import { VaultFirewall } from './VaultFirewall';

/**
 * Service to interact with a local Obsidian Vault via a backend MCP (Model Context Protocol) server.
 * This is an alternative to the File System Access API (ObsidianService) and relies on a local backend.
 */
export class ObsidianMCPService {
  private vaultPath: string;
  private firewall: VaultFirewall;

  constructor(vaultPath: string, allowedWritePath: string = 'AI/Responses') {
    this.vaultPath = vaultPath;
    this.firewall = new VaultFirewall(allowedWritePath);
  }

  /**
   * Updates the allowed write path dynamically.
   */
  setAllowedWritePath(path: string) {
    this.firewall.setAllowedWritePath(path);
  }

  /**
   * Reads the content of a note from the Obsidian Vault.
   * @param filePath The path to the note relative to the vault root.
   * @returns The content of the note as a string.
   */
  async readNote(filePath: string): Promise<string> {
    if (!this.vaultPath) throw new Error("Obsidian Vault Path non configurato.");
    if (!this.firewall.validateRead(filePath)) throw new Error("Accesso in lettura bloccato dal Vault Firewall (Path Traversal).");
    
    const response = await fetch("/api/obsidian/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vaultPath: this.vaultPath, filePath })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Errore lettura Obsidian: ${error.error || response.statusText}`);
    }

    const data = await response.json();
    return data.content;
  }

  /**
   * Writes content to a note in the Obsidian Vault.
   * @param filePath The path to the note relative to the vault root.
   * @param content The content to write.
   * @returns True if successful.
   */
  async writeNote(filePath: string, content: string): Promise<boolean> {
    if (!this.vaultPath) throw new Error("Obsidian Vault Path non configurato.");
    if (!this.firewall.validateWrite(filePath)) throw new Error("Accesso in scrittura bloccato dal Vault Firewall (Percorso non consentito o Path Traversal).");
    
    const response = await fetch("/api/obsidian/write", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vaultPath: this.vaultPath, filePath, content })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Errore scrittura Obsidian: ${error.error || response.statusText}`);
    }

    return true;
  }

  /**
   * Lists all notes in a specific directory within the Obsidian Vault.
   * @param directory The directory to list notes from (relative to vault root). Defaults to root.
   * @returns An array of file paths.
   */
  async listNotes(directory: string = ""): Promise<string[]> {
    if (!this.vaultPath) throw new Error("Obsidian Vault Path non configurato.");
    if (!this.firewall.validateList(directory)) throw new Error("Accesso alla directory bloccato dal Vault Firewall (Path Traversal).");
    
    const response = await fetch("/api/obsidian/list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vaultPath: this.vaultPath, directory })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Errore lista Obsidian: ${error.error || response.statusText}`);
    }

    const data = await response.json();
    return data.files;
  }
}
