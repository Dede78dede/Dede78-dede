import { SmarterRouter } from '../routing/SmarterRouter';
import { DistillationTask } from './types';
import { PrivacyLevel } from '../routing/types';

export class DistillationEngine {
  private router: SmarterRouter;
  // In produzione questo sarebbe un Vector Database (es. ChromaDB) o IndexedDB
  private cache: Map<string, DistillationTask> = new Map();

  constructor(router: SmarterRouter) {
    this.router = router;
  }

  /**
   * Fase 1: Generazione del Dataset (Teacher)
   * Usa il modello Cloud per generare N esempi perfetti per un determinato task.
   */
  public async distillTask(taskId: string, taskDescription: string, numExamples: number = 3): Promise<DistillationTask> {
    console.log(`[Distillation] Avvio distillazione per task: ${taskId}`);
    
    const prompt = `Sei un AI Teacher. Devi generare ${numExamples} esempi perfetti (input e output) per insegnare a un modello più piccolo come eseguire questo task:
Task: "${taskDescription}"

Rispondi ESATTAMENTE con un array JSON in questo formato:
[
  { "input": "esempio di richiesta utente", "output": "risposta perfetta e formattata correttamente" }
]`;

    // Forza l'uso del Cloud (Teacher)
    const [error, result] = await this.router.execute(prompt, {
      privacy: PrivacyLevel.MINIMUM, 
      temperature: 0.4
    });

    if (error) {
      throw new Error(`Errore durante la distillazione: ${error.message}`);
    }

    const { response } = result;

    try {
      const jsonMatch = response.text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error("Il Teacher non ha restituito un array JSON valido.");
      
      const examples = JSON.parse(jsonMatch[0]) as Array<{ input: string; output: string }>;
      
      const task: DistillationTask = {
        id: taskId,
        taskDescription,
        fewShotExamples: examples,
        createdAt: Date.now()
      };

      this.cache.set(taskId, task);
      console.log(`[Distillation] Distillazione completata. Salvati ${examples.length} esempi.`);
      return task;
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      throw new Error(`Errore durante il parsing della distillazione: ${errorMessage}`);
    }
  }

  /**
   * Fase 2: Inferenza Ottimizzata (Student)
   * Recupera gli esempi distillati e li inietta nel prompt per il modello locale.
   */
  public async getOptimizedSystemPrompt(taskId: string): Promise<string | undefined> {
    const task = this.cache.get(taskId);
    if (!task || task.fewShotExamples.length === 0) {
      return undefined;
    }

    let optimizedPrompt = `Sei un assistente specializzato in questo task: "${task.taskDescription}".\n`;
    optimizedPrompt += `Ecco alcuni esempi di come devi rispondere:\n\n`;

    task.fewShotExamples.forEach((ex, i) => {
      optimizedPrompt += `--- Esempio ${i + 1} ---\n`;
      optimizedPrompt += `USER: ${ex.input}\n`;
      optimizedPrompt += `ASSISTANT: ${ex.output}\n\n`;
    });

    optimizedPrompt += `Ora rispondi alla prossima richiesta seguendo rigorosamente lo stile e il formato degli esempi sopra.`;
    
    return optimizedPrompt;
  }
}
