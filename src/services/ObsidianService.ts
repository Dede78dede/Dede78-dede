/**
 * Servizio per interagire con il File System locale (Obsidian Vault)
 * Utilizza la File System Access API. Se l'API è bloccata (es. in un iframe),
 * passa automaticamente a una modalità di fallback che scarica i file.
 */
export class ObsidianService {
  private static directoryHandle: FileSystemDirectoryHandle | null = null;
  private static isFallbackMode: boolean = false;

  /**
   * Richiede all'utente di selezionare una cartella (il Vault di Obsidian).
   * Gestisce automaticamente il fallback se l'API non è disponibile.
   * @returns Promise<boolean> true se l'accesso è stato concesso o se il fallback è attivo.
   */
  static async requestVaultAccess(): Promise<boolean> {
    try {
      // @ts-ignore - File System Access API non è completamente tipizzata in tutti gli ambienti
      this.directoryHandle = await window.showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'documents',
      });
      this.isFallbackMode = false;
      return true;
    } catch (error: any) {
      console.error("Accesso al Vault negato o annullato:", error);
      
      // Fallback per iframes (come AI Studio) dove showDirectoryPicker è bloccato
      if (error.message && error.message.includes('Cross origin sub frames')) {
        console.warn("File System Access API bloccata. Attivazione modalità di fallback (Download).");
        this.isFallbackMode = true;
        return true; // Ritorniamo true per permettere l'uso della modalità fallback
      }
      
      return false;
    }
  }

  /**
   * Verifica se abbiamo già l'accesso al Vault (o se siamo in modalità fallback).
   * @returns boolean true se possiamo operare sui file.
   */
  static hasAccess(): boolean {
    return this.directoryHandle !== null || this.isFallbackMode;
  }

  /**
   * Ottiene il nome del Vault selezionato.
   * @returns string Il nome della directory o un messaggio di fallback.
   */
  static getVaultName(): string {
    if (this.isFallbackMode) return 'Modalità Download (Fallback)';
    return this.directoryHandle ? this.directoryHandle.name : '';
  }

  /**
   * Crea un nuovo file markdown nel Vault (o lo scarica in fallback).
   * @param filename Nome del file (es. "training_request.md"). L'estensione .md viene aggiunta se mancante.
   * @param content Contenuto del file in formato markdown.
   * @returns Promise<boolean> true se l'operazione ha avuto successo.
   */
  static async createMarkdownFile(filename: string, content: string): Promise<boolean> {
    if (!this.hasAccess()) {
      throw new Error("Nessun Vault selezionato. Richiedi prima l'accesso.");
    }

    const name = filename.endsWith('.md') ? filename : `${filename}.md`;

    if (this.isFallbackMode) {
      // Modalità Fallback: Scarica il file
      try {
        const blob = new Blob([content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return true;
      } catch (error) {
        console.error(`Errore durante il download del file ${filename}:`, error);
        return false;
      }
    }

    try {
      // Crea o sovrascrivi il file
      const fileHandle = await this.directoryHandle!.getFileHandle(name, { create: true });
      
      // Crea un FileSystemWritableFileStream per scrivere
      // @ts-ignore
      const writable = await fileHandle.createWritable();
      
      // Scrivi il contenuto
      await writable.write(content);
      
      // Chiudi il file
      await writable.close();
      
      return true;
    } catch (error) {
      console.error(`Errore durante la creazione del file ${filename}:`, error);
      return false;
    }
  }

  /**
   * Genera il contenuto per una richiesta di Training
   */
  static generateTrainingRequest(projectName: string, baseModel: string): string {
    return `---
type: training_request
project: ${projectName}
status: pending
date: ${new Date().toISOString().split('T')[0]}
base_model: ${baseModel}
---

# Richiesta di Training: ${projectName}

## Obiettivo
[Descrivi l'obiettivo del training]

## Dataset
[Specifica il percorso o la descrizione del dataset]

## Parametri
- Epochs: 3
- Batch Size: 8
- Learning Rate: 2e-5
`;
  }

  /**
   * Genera il contenuto per una richiesta di Merge
   */
  static generateMergeRequest(projectName: string): string {
    return `---
type: merge_request
project: ${projectName}
status: pending
date: ${new Date().toISOString().split('T')[0]}
---

# Richiesta di Merge: ${projectName}

## Modelli da unire
1. [Modello Base]
2. [Adattatore LoRA]

## Metodo di Merge
- Metodo: TIES / SLERP / Linear
- Peso (alpha): 0.5
`;
  }

  /**
   * Genera il contenuto per una richiesta di Valutazione
   */
  static generateEvalRequest(projectName: string): string {
    return `---
type: eval_request
project: ${projectName}
status: pending
date: ${new Date().toISOString().split('T')[0]}
---

# Richiesta di Valutazione: ${projectName}

## Modello da valutare
[Nome del modello]

## Benchmark
- [ ] MMLU
- [ ] GSM8K
- [ ] HumanEval
- [ ] Custom Dataset: [Percorso]
`;
  }
}
