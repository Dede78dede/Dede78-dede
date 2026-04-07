import { IRouterMiddleware, RoutingContext } from '../types';
import { pipeline, FeatureExtractionPipeline } from '@huggingface/transformers';

export class CompetenceMiddleware implements IRouterMiddleware {
  private static extractor: FeatureExtractionPipeline | null = null;
  private static complexAnchor: any = null;
  private static simpleAnchor: any = null;
  private static isInitializing = false;

  static async initModel() {
    if (this.extractor || this.isInitializing) return;
    this.isInitializing = true;
    try {
      const pipe: any = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
        dtype: 'q8'
      });
      this.extractor = pipe as FeatureExtractionPipeline;
      const complexText = "Scrivi un server web in Python usando FastAPI con autenticazione JWT e database PostgreSQL. Spiega il ragionamento passo passo.";
      const simpleText = "Ciao, come stai? Che ore sono? Dimmi una barzelletta.";
      
      this.complexAnchor = await this.extractor(complexText, { pooling: 'mean', normalize: true });
      this.simpleAnchor = await this.extractor(simpleText, { pooling: 'mean', normalize: true });
    } catch (e) {
      console.error("[CompetenceMiddleware] Failed to initialize ML Model:", e);
    } finally {
      this.isInitializing = false;
    }
  }

  private static dotProduct(a: any, b: any) {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += a[i] * b[i];
    }
    return sum;
  }

  public async handle(context: RoutingContext, next: () => Promise<void>): Promise<void> {
    // Fase 2: Analisi della complessità (Competence)
    let complexityScore = 0;
    
    try {
      if (!CompetenceMiddleware.extractor && !CompetenceMiddleware.isInitializing) {
        CompetenceMiddleware.initModel().catch(console.error);
      }

      if (CompetenceMiddleware.extractor && CompetenceMiddleware.complexAnchor && CompetenceMiddleware.simpleAnchor) {
        const promptEmbedding = await CompetenceMiddleware.extractor(context.prompt, { pooling: 'mean', normalize: true });
        const simComplex = CompetenceMiddleware.dotProduct(promptEmbedding.data, CompetenceMiddleware.complexAnchor.data);
        const simSimple = CompetenceMiddleware.dotProduct(promptEmbedding.data, CompetenceMiddleware.simpleAnchor.data);
        
        const totalSim = Math.max(0.0001, simComplex + simSimple);
        complexityScore = Math.max(0, Math.min(1, simComplex / totalSim));
        
        if (context.prompt.length > 500) complexityScore += 0.2;
        complexityScore = Math.min(1, complexityScore);
      } else {
        // Fallback to heuristics
        const reasoningKeywords = ['calcola', 'logica', 'codice', 'funzione', 'analizza', 'risolvi', 'algoritmo', 'python', 'javascript', 'react', 'typescript'];
        const lowerPrompt = context.prompt.toLowerCase();
        const keywordMatches = reasoningKeywords.filter(kw => lowerPrompt.includes(kw)).length;
        complexityScore = Math.min(keywordMatches * 0.15, 0.5);
        if (context.prompt.length > 100) complexityScore += 0.2;
        if (context.prompt.length > 300) complexityScore += 0.3;
        if (context.prompt.length > 1000) complexityScore += 0.4;
      }
    } catch (e) {
      console.warn("[CompetenceMiddleware] ML routing failed, falling back to heuristics", e);
      complexityScore = 0.5; // Default to medium complexity on error
    }

    // Se richiede ragionamento complesso o è un prompt molto lungo, flagga per High Reasoning
    if (complexityScore > 0.6 || context.prompt.length > 1500) {
      context.requiresHighReasoning = true;
      context.metadata.competenceReason = `Richiesto alto ragionamento logico (Score: ${complexityScore.toFixed(2)})`;
    } else {
      context.requiresHighReasoning = false;
      context.metadata.competenceReason = `Ragionamento base sufficiente (Score: ${complexityScore.toFixed(2)})`;
    }

    await next();
  }
}
