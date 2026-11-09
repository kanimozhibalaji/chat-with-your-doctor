import express from 'express';
import { chatWithBot, clearChatHistory } from '../controllers/chatbotController.js';

const chatbotRouter = express.Router();

// Chat with the RAG bot (no auth required — accessible to all visitors)
chatbotRouter.post("/chat", chatWithBot);

// Clear chat history (optional)
chatbotRouter.post("/clear", clearChatHistory);

export default chatbotRouter;
