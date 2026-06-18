import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { ZodError } from 'zod';
import mcpRouter from './routes/mcp.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/mcp', mcpRouter);

// Health Check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Global Error Handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error encountered:', err);

  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: err.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: err.message || 'An unexpected error occurred',
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
  
  // Run self-diagnostics on Gemini API keys and write results to a local file
  const diagnoseGeminiKeys = async () => {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const fs = await import('fs');
    const apiKey = process.env.GEMINI_API_KEY || '';
    const keys = apiKey.split(',').map(k => k.trim()).filter(Boolean);
    const reports = [];

    console.log(`[NLP-Diag] Starting diagnostics for ${keys.length} keys...`);

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const maskedKey = key.slice(0, 8) + '...' + key.slice(-4);
      
      if (!key.startsWith('AIza') && !key.startsWith('AQ')) {
        reports.push({ index: i, key: maskedKey, success: false, error: 'Invalid key format (does not start with AIza or AQ)' });
        continue;
      }

      try {
        const genAI = new GoogleGenerativeAI(key);
        const requestOptions = process.env.GEMINI_BASE_URL ? {
          baseUrl: process.env.GEMINI_BASE_URL
        } : undefined;
        const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' }, requestOptions);
        const response = await model.generateContent('Hi');
        reports.push({ index: i, key: maskedKey, success: true, text: response.response.text().trim() });
      } catch (err: any) {
        reports.push({ index: i, key: maskedKey, success: false, error: err.message });
      }
    }

    try {
      fs.writeFileSync('d:\\kapruka-ai\\test-report.json', JSON.stringify({
        timestamp: new Date().toISOString(),
        reports
      }, null, 2));
      console.log('[NLP-Diag] Wrote diagnostic report to test-report.json');
    } catch (writeErr) {
      console.error('[NLP-Diag] Failed to write test-report.json:', writeErr);
    }
  };

  diagnoseGeminiKeys().catch(console.error);
});
