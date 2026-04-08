import { WorkflowStatus, WorkflowStepStatus } from '../core/enums';
import { firestoreDb } from '../db/firestore';
import admin from 'firebase-admin';

/**
 * Plugin: Google AI Full-Stack Workflow
 * Questo plugin inizializza un workflow predefinito nel database che modella
 * le 4 fasi descritte nel documento "Sviluppo e Integrazione di un Sistema Multi-Agente".
 */
export class GoogleAIWorkflowPlugin {
  static async install(userId: string = 'anonymous') {
    try {
      const workflowId = `wf_google_ai_${Date.now()}`;
      
      const batch = firestoreDb.batch();
      
      const workflowRef = firestoreDb.collection('workflows').doc(workflowId);
      batch.set(workflowRef, {
        id: workflowId,
        userId,
        name: 'Google AI Enterprise Platform Setup',
        status: WorkflowStatus.PENDING,
        globalContext: JSON.stringify({
          document_reference: 'data/google_ai_workflow.md',
          target_architecture: 'Multi-Agent Customer Support'
        }),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      const steps = [
        {
          id: `step_1_${workflowId}`,
          order: 1,
          name: 'Fase 1: Setup Ambiente (AI Studio & IDX)',
          prompt: 'Analizza il documento e genera gli script Gemini CLI per il setup dei container su Project IDX.'
        },
        {
          id: `step_2_${workflowId}`,
          order: 2,
          name: 'Fase 2: Sviluppo Sicuro (Jules & Antigravity)',
          prompt: 'Configura le regole di Antigravity per l\'analisi delle PR e i prompt di sistema per Jules.'
        },
        {
          id: `step_3_${workflowId}`,
          order: 3,
          name: 'Fase 3: RAG e FileSearch API',
          prompt: 'Progetta l\'integrazione della FileSearch API per l\'Agente Diagnostico (ADK) e l\'Agente Front-End (Vertex).'
        },
        {
          id: `step_4_${workflowId}`,
          order: 4,
          name: 'Fase 4: Sinergia Multi-Agente (Google A2A)',
          prompt: 'Definisci il protocollo di comunicazione A2A tra l\'Agente Principale e l\'Agente Diagnostico.'
        }
      ];

      for (const step of steps) {
        const stepRef = workflowRef.collection('steps').doc(step.id);
        batch.set(stepRef, {
          id: step.id,
          workflowId,
          stepOrder: step.order,
          name: step.name,
          modelConfig: JSON.stringify({ provider: 'google', model: 'gemini-3.1-pro-preview' }),
          inputPromptTemplate: step.prompt,
          status: WorkflowStepStatus.PENDING,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      const julesRef = firestoreDb.collection('agents').doc('agent_jules');
      batch.set(julesRef, {
        id: 'agent_jules',
        userId,
        name: 'Jules (Global Code Vision)',
        type: 'CODE_ANALYZER',
        status: 'ONLINE',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      const antigravityRef = firestoreDb.collection('agents').doc('agent_antigravity');
      batch.set(antigravityRef, {
        id: 'agent_antigravity',
        userId,
        name: 'Antigravity (Security Sentinel)',
        type: 'IDS_WAF',
        status: 'ONLINE',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      await batch.commit();
      
      console.log('[Plugin] Google AI Workflow installato con successo.');
      return workflowId;
    } catch (error) {
      console.error('[Plugin] Errore durante l\'installazione del workflow:', error);
      throw error;
    }
  }
}
