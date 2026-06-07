import { Router, Request, Response, NextFunction } from 'express';
import { mcpClient } from '../services/mcpClient.js';
import { nlpService } from '../services/nlpService.js';
import { bundlerService } from '../services/bundlerService.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import {
  SearchProductsSchema,
  GetProductSchema,
  ListCategoriesSchema,
  ListDeliveryCitiesSchema,
  CheckDeliverySchema,
  CreateOrderSchema,
  TrackOrderSchema
} from '../utils/validator.js';


const router = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
};

/**
 * Diagnostic Endpoint: Verify Gemini API model compatibility
 */
router.get(
  '/test-connection',
  asyncHandler(async (req: Request, res: Response) => {
    const logs: string[] = [];
    logs.push(`Starting Gemini connection and rotation test at ${new Date().toISOString()}`);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ success: false, error: 'GEMINI_API_KEY is missing' });
    }

    const keys = apiKey.split(',').map((k) => k.trim()).filter(Boolean);
    logs.push(`Found ${keys.length} API key(s) in configuration.`);

    const keyResults: any[] = [];

    for (let i = 0; i < keys.length; i++) {
      const maskedKey = keys[i].slice(0, 8) + '...' + keys[i].slice(-4);
      logs.push(`Testing Key #${i} (${maskedKey})...`);
      
      try {
        const genAI = new GoogleGenerativeAI(keys[i]);
        const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
        const response = await model.generateContent('Hello! Answer in 1 word.');
        const text = response.response.text().trim();
        logs.push(`  Success! Response: "${text}"`);
        keyResults.push({ index: i, maskedKey, success: true, response: text });
      } catch (err: any) {
        logs.push(`  Failed: ${err.message}`);
        keyResults.push({ index: i, maskedKey, success: false, error: err.message });
      }
    }

    const result = {
      success: keyResults.some((k) => k.success),
      keysTested: keyResults.length,
      keyDetails: keyResults,
      logs,
    };

    fs.writeFileSync('d:\\kapruka-ai\\mcp-debug-log.json', JSON.stringify(result, null, 2));
    res.json(result);
  })
);

router.post(
  '/chat',
  asyncHandler(async (req: Request, res: Response) => {
    const { text, history } = req.body;
    if (!text) {
      return res.status(400).json({ success: false, error: 'Request body must contain "text" property' });
    }
    const intent = await nlpService.parseUserIntent(text, history);
    if (intent.target_city) {
      intent.target_city = await nlpService.resolveCanonicalCity(intent.target_city);
    }
    const bundle = await bundlerService.compileBundle(intent);
    const reply = await nlpService.generateChatReply(text, intent, bundle, history);
    res.json({
      success: true,
      data: {
        intent,
        bundle,
        reply,
      },
    });
  })
);

router.get(
  '/search',
  asyncHandler(async (req: Request, res: Response) => {
    const parsedQuery = {
      q: req.query.q,
      category: req.query.category,
      min_price: req.query.min_price ? Number(req.query.min_price) : undefined,
      max_price: req.query.max_price ? Number(req.query.max_price) : undefined,
      in_stock_only: req.query.in_stock_only === 'true' ? true : req.query.in_stock_only === 'false' ? false : undefined,
      sort: req.query.sort,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      cursor: req.query.cursor,
      currency: req.query.currency,
    };
    const validated = SearchProductsSchema.parse(parsedQuery);
    const result = await mcpClient.searchProducts(validated);
    res.json({ success: true, data: result });
  })
);

router.get(
  '/product',
  asyncHandler(async (req: Request, res: Response) => {
    const validated = GetProductSchema.parse({
      product_id: req.query.product_id,
      currency: req.query.currency,
    });
    const result = await mcpClient.getProduct(validated.product_id, validated.currency);
    res.json({ success: true, data: result });
  })
);

router.get(
  '/categories',
  asyncHandler(async (req: Request, res: Response) => {
    const parsedQuery = { depth: req.query.depth ? Number(req.query.depth) : undefined };
    const validated = ListCategoriesSchema.parse(parsedQuery);
    const result = await mcpClient.listCategories(validated.depth);
    res.json({ success: true, data: result });
  })
);

router.get(
  '/cities',
  asyncHandler(async (req: Request, res: Response) => {
    const parsedQuery = { query: req.query.query, limit: req.query.limit ? Number(req.query.limit) : undefined };
    const validated = ListDeliveryCitiesSchema.parse(parsedQuery);
    const result = await mcpClient.listDeliveryCities(validated.query, validated.limit);
    res.json({ success: true, data: result });
  })
);

router.post(
  '/check-delivery',
  asyncHandler(async (req: Request, res: Response) => {
    const validated = CheckDeliverySchema.parse(req.body);
    const result = await mcpClient.checkDelivery(validated.city, validated.delivery_date, validated.product_id);
    res.json({ success: true, data: result });
  })
);

router.post(
  '/create-order',
  asyncHandler(async (req: Request, res: Response) => {
    const validated = CreateOrderSchema.parse(req.body);
    const result = await mcpClient.createOrder(validated);
    res.json({ success: true, data: result });
  })
);

router.get(
  '/track-order',
  asyncHandler(async (req: Request, res: Response) => {
    const validated = TrackOrderSchema.parse({ order_number: req.query.order_number });
    const result = await mcpClient.trackOrder(validated.order_number);
    res.json({ success: true, data: result });
  })
);

export default router;
