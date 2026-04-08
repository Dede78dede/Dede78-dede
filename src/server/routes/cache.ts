import { Router } from 'express';
import { firestoreDb } from '../../db/firestore';
import admin from 'firebase-admin';

export const cacheRouter = Router();

cacheRouter.post("/set", async (req, res) => {
  const { id, prompt, embedding, response } = req.body;
  if (!id || !prompt || !embedding || !response) return res.status(400).json({ error: "Missing parameters" });

  try {
    const userId = (req as any).user?.uid || 'anonymous';
    await firestoreDb.collection('caches').doc(id).set({
      id,
      userId,
      query: prompt,
      response,
      embedding: JSON.stringify(embedding),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

cacheRouter.get("/all", async (req, res) => {
  try {
    const userId = (req as any).user?.uid;
    let query: admin.firestore.Query = firestoreDb.collection('caches');
    if (userId) {
      query = query.where('userId', '==', userId);
    }
    const snapshot = await query.get();
    const rows = snapshot.docs.map(doc => doc.data());
    res.json({ cache: rows });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
