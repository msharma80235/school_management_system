import { Request, Response } from 'express';
import { answerQuestion } from '../utils/chatAgent';

// Rule-based help agent — every question runs the same predefined pipeline
// (sanitize → security filter → scope check → knowledge lookup → redaction).
export async function askChatAgent(req: Request, res: Response): Promise<void> {
  try {
    const { question } = req.body;
    const result = await answerQuestion(question);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}
