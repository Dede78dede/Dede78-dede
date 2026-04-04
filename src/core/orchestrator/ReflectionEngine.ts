import { SmarterRouter } from '../routing/SmarterRouter';
import { ReflectionOptions } from './types';
import { PrivacyLevel } from '../routing/types';

export class ReflectionEngine {
  private router: SmarterRouter;

  constructor(router: SmarterRouter) {
    this.router = router;
  }

  public async generateWithReflection(task: string, options?: ReflectionOptions): Promise<string> {
    const maxReflections = options?.maxReflections || 3;
    let currentDraft = "";
    let iteration = 0;

    const actorPrivacy = options?.privacyLevel || PrivacyLevel.STRICT; // L'Actor di default è locale (gratis)
    const criticPrivacy = options?.criticPrivacyLevel || PrivacyLevel.MINIMUM; // Il Critic di default è Cloud (intelligente)

    while (iteration < maxReflections) {
      iteration++;
      console.log(`[Reflection] Generazione bozza (Iterazione ${iteration})...`);
      
      // 1. ACTOR: Genera la bozza
      const actorPrompt = iteration === 1 
        ? `Esegui questo task:\n${task}` 
        : `Esegui questo task:\n${task}\n\nQuesta era la tua bozza precedente:\n${currentDraft}\n\nMigliorala seguendo le critiche ricevute.`;
      
      const [actorError, actorResult] = await this.router.execute(actorPrompt, {
        privacy: actorPrivacy,
        temperature: 0.7
      });

      if (actorError) {
        throw new Error(`[Reflection] Errore Actor: ${actorError.message}`);
      }
      currentDraft = actorResult.response.text;

      // 2. CRITIC: Valuta la bozza
      console.log(`[Reflection] Valutazione della bozza...`);
      const criticPrompt = `Sei un revisore esperto. Valuta questa bozza rispetto al task originale.
Task originale: ${task}
Bozza: ${currentDraft}

Rispondi ESATTAMENTE con questo formato JSON:
{
  "passed": boolean,
  "critique": "spiegazione dettagliata degli errori o conferme",
  "score": numero da 1 a 10
}`;

      const [criticError, criticResult] = await this.router.execute(criticPrompt, {
        privacy: criticPrivacy,
        temperature: 0.1 // Bassa temperatura per output deterministico
      });

      if (criticError) {
        console.warn(`[Reflection] Errore Critic: ${criticError.message}. Procedo con la bozza attuale.`);
        return currentDraft;
      }

      try {
        // Estrazione JSON grezza (in prod si usa Structured Output o Zod)
        const jsonMatch = criticResult.response.text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("Il Critic non ha restituito un JSON valido.");
        
        const evaluation = JSON.parse(jsonMatch[0]) as { passed: boolean; critique: string; score: number };
        console.log(`[Reflection] Punteggio: ${evaluation.score}/10. Passed: ${evaluation.passed}`);

        if (evaluation.passed || evaluation.score >= 9) {
          console.log(`[Reflection] Bozza approvata!`);
          return currentDraft;
        } else {
          console.log(`[Reflection] Bozza respinta. Critica: ${evaluation.critique}`);
          // Aggiungiamo la critica al task per la prossima iterazione dell'Actor
          currentDraft += `\n\n[CRITICA RICEVUTA DAL REVISORE]:\n${evaluation.critique}`;
        }
      } catch (e) {
        console.warn("[Reflection] Errore nel parsing della critica, procedo con la bozza attuale.", e);
        return currentDraft; // Fallback di sicurezza
      }
    }

    console.log(`[Reflection] Raggiunto limite massimo di riflessioni. Restituisco l'ultima bozza.`);
    return currentDraft;
  }
}
