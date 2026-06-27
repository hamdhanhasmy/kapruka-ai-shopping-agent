import { GoogleGenerativeAI } from '@google/generative-ai';
import { mcpClient } from './mcpClient.js';
import dotenv from 'dotenv';

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export interface ParsedIntent {
  items: string[];
  target_city: string | null;
  delivery_date: string | null; // Format YYYY-MM-DD
  max_budget: number | null;
  gift_message: string | null;
  recipient_relation: string | null;
  recipient_name: string | null;
  recipient_phone: string | null;
  delivery_address: string | null;
  sender_name: string | null;
  is_self_shopping: boolean;
  hamper_title?: string | null;
  track_order_number?: string | null;
}

export function normalizeIntent(intent: ParsedIntent): ParsedIntent {
  const check = (val: any): string | null => {
    if (val === undefined || val === null) return null;
    const str = String(val).trim();
    const lower = str.toLowerCase();
    if (lower === 'not specified' || lower === 'null' || lower === 'undefined' || lower === '') {
      return null;
    }
    return str;
  };

  return {
    items: Array.isArray(intent.items)
      ? intent.items.map(i => String(i).trim()).filter(i => {
          const l = i.toLowerCase();
          return l !== '' && l !== 'null' && l !== 'not specified';
        })
      : [],
    target_city: check(intent.target_city),
    delivery_date: check(intent.delivery_date),
    max_budget: typeof intent.max_budget === 'number' ? intent.max_budget : (intent.max_budget ? Number(intent.max_budget) : null),
    gift_message: check(intent.gift_message),
    recipient_relation: check(intent.recipient_relation),
    recipient_name: check(intent.recipient_name),
    recipient_phone: check(intent.recipient_phone),
    delivery_address: check(intent.delivery_address),
    sender_name: check(intent.sender_name),
    is_self_shopping: typeof intent.is_self_shopping === 'boolean' ? intent.is_self_shopping : false,
    hamper_title: check(intent.hamper_title),
    track_order_number: check(intent.track_order_number),
  };
}

export class NlpService {
  private genAIInstances: GoogleGenerativeAI[] = [];
  private currentKeyIndex = 0;

  constructor() {
    const keysStr = process.env.GEMINI_API_KEY || '';
    const apiKeys = keysStr.split(',').map(k => k.trim()).filter(Boolean);

    // Only load keys that start with "AIza" or "AQ"
    const validKeys = apiKeys.filter(key => {
      if (key.startsWith('AIza') || key.startsWith('AQ')) {
        return true;
      }
      console.warn(`[NLP] Skipping invalid Gemini API key format (must start with AIza or AQ): ${key.slice(0, 10)}...`);
      return false;
    });

    if (validKeys.length > 0) {
      this.genAIInstances = validKeys.map(key => new GoogleGenerativeAI(key));
      console.log(`[NLP] Configured API Key Rotation with ${this.genAIInstances.length} valid client instance(s).`);
    } else {
      console.warn('No valid GEMINI_API_KEY configured. Falling back to rule-based NLP.');
    }
  }

  /**
   * Helper to execute a Gemini request using the current active key instance.
   * If a rate limit or API error is hit, it cycles to the next key and retries.
   */
  private async executeWithRotation<T>(
    operation: (genAI: GoogleGenerativeAI, modelName: string) => Promise<T>
  ): Promise<T> {
    const totalInstances = this.genAIInstances.length;
    if (totalInstances === 0) {
      throw new Error('No GoogleGenerativeAI clients initialized.');
    }

    const modelsToTry = ['gemini-2.5-flash', 'gemini-flash-latest'];
    let lastError: any = null;

    // Try each model in sequence
    for (const modelName of modelsToTry) {
      // Try each key once in sequence starting from currentKeyIndex
      for (let attempt = 0; attempt < totalInstances; attempt++) {
        const idx = (this.currentKeyIndex + attempt) % totalInstances;
        const client = this.genAIInstances[idx];

        try {
          const result = await operation(client, modelName);
          // Successful execution! Update current active key index
          this.currentKeyIndex = idx;
          return result;
        } catch (err: any) {
          lastError = err;
          const errMsg = err.message || '';
          const errStatus = err.status || err.statusCode;
          
          const isQuotaOrLimit = 
            errStatus === 429 ||
            errMsg.includes('429') || 
            errMsg.includes('Quota exceeded') || 
            errMsg.includes('rate-limits') ||
            errMsg.includes('Too Many Requests');

          const isModelUnavailable = 
            errStatus === 503 ||
            errStatus === 404 ||
            errMsg.includes('503') || 
            errMsg.includes('Service Unavailable') || 
            errMsg.includes('high demand') ||
            errMsg.includes('overloaded') ||
            errMsg.includes('temporary') ||
            errMsg.includes('404') ||
            errMsg.includes('not found') ||
            errMsg.includes('not_found');

          if (isModelUnavailable) {
            console.warn(`[NLP] Model "${modelName}" is experiencing high demand or is unavailable. Swapping model... Details: ${errMsg.slice(0, 120)}...`);
            // Break key loop to try next model
            break;
          }

          if (isQuotaOrLimit) {
            console.warn(`[NLP] Quota limit hit on API key index ${idx} for model "${modelName}". Rotating key... Details: ${errMsg.slice(0, 120)}...`);
          } else {
            console.error(`[NLP] Error on key index ${idx} for model "${modelName}". Cycling key...`, err);
          }
        }
      }
    }

    // If we reach here, all instances failed
    throw lastError || new Error('All Gemini API key clients and models failed in rotation loop.');
  }

  /**
   * Parses the user's natural language input (supporting Singlish/vernacular)
   * to extract structured parameters.
   */
  public async parseUserIntent(query: string, history?: any[]): Promise<ParsedIntent> {
    if (this.genAIInstances.length > 0) {
      try {
        return await this.executeWithRotation(async (genAI, modelName) => {
          const requestOptions: any = { timeout: 8000 };
          if (process.env.GEMINI_BASE_URL) {
            requestOptions.baseUrl = process.env.GEMINI_BASE_URL;
          }

          const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: { responseMimeType: 'application/json' },
          }, requestOptions);

           const colomboDate = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
           const todayStr = colomboDate.toISOString().split('T')[0];

           let historyPrompt = '';
           if (history && history.length > 0) {
             const userHistory = history.filter((m: any) => m.sender === 'user');
             if (userHistory.length > 0) {
               historyPrompt = '\nHere is the recent conversation history of the User\'s requests for context (use it to resolve pronouns or carry over items/dates/cities/names if not explicitly specified in the query):\n' +
                 userHistory.map((m: any) => `User: ${m.text}`).join('\n') + '\n';
             }
           }

           const prompt = `
             Analyze this shopping/gifting request. The request may contain localized Sri Lankan slang, Singlish, or informal wording (e.g., "maching", "amma", "apata", "cake parak", "bday gift", "colombo 3", "negombo").
             Extract the following details as a JSON object:
             - "items": Array of item keywords or product categories requested (e.g., ["roses", "chocolate cake", "card"]). Normalize these to their singular form when querying (e.g., use "cake" instead of "cakes", "rose" instead of "roses").
             - "target_city": The destination city name (e.g., "Colombo 03", "Kandy"). If not found, output null.
             - "delivery_date": The target delivery date in YYYY-MM-DD format. Assume today is ${todayStr}. If a relative date is given (e.g. "next week", "tomorrow", "this weekend", "heta", "nalaki"), resolve it to YYYY-MM-DD. If not mentioned, output null.
             - "max_budget": Max budget constraint in LKR as a number. If not found, output null.
             - "gift_message": Any gift message text mentioned in quotes or text. If not found, output null.
             - "recipient_relation": The recipient's relation to sender (e.g. "mother/amma", "friend/maching", "partner").
             - "recipient_name": The recipient's full name if mentioned (e.g. "Jane", "John"). If not mentioned, output null.
             - "recipient_phone": The recipient's phone number if mentioned (e.g. "0771234567"). If not mentioned, output null.
             - "delivery_address": The street/home shipping address mentioned (e.g. "12 Galle Road", "no 5 temple road"). If not mentioned, output null.
             - "sender_name": The sender's name if mentioned (e.g. "Amal", "Kamal"). If not mentioned, output null.
             - "is_self_shopping": Boolean. Set to true if the customer is ordering/purchasing for themselves (Self-Shopping mode). Set to false if they are sending it as a gift to someone else (Gifting mode).
               - Self-Shopping mode (true) is the default unless they explicitly mention sending it to another person (e.g. "amma", "friend", "sister", "wife"), use words like "gift", "surprise", or provide a recipient name separate from their own.
               - If they say "mata" (for me), "ewanna" (send to me), "my address", "my name", "my phone", "ordering for myself", set this to true.
             - "hamper_title": A creative, personalized short title (3-5 words) for this cart/hamper bundle, based on the items, recipient relation, city, or purpose. Examples: "Amma's Sweet Birthday Surprise", "Kandy Snack Attack Box", "Weekly Grocery Staples", "Galle Avurudu Treats". If nothing is specified, default to a general name like "Bespoke Hamper Bundle".
             - "track_order_number": The order ID or order tracking number to track if the user is asking to track their order or asking where their order is (e.g. "VPAY827982BA"). If not found, output null.
               
              CRITICAL RULES for Self-Shopping mode (is_self_shopping is true):
              - If they mention their own name (e.g. "mage nama Hamsey"), set BOTH "recipient_name" and "sender_name" to that name.
              - If they mention their own phone number (e.g. "phone no eka 0786674557"), set "recipient_phone" to that phone number so the contact phone number input gets updated correctly.
             
             ${historyPrompt}
             User Query: "${query}"

             Return ONLY a JSON block with these keys: items (array), target_city (string or null), delivery_date (string or null), max_budget (number or null), gift_message (string or null), recipient_relation (string or null), recipient_name (string or null), recipient_phone (string or null), delivery_address (string or null), sender_name (string or null), is_self_shopping (boolean), hamper_title (string or null), track_order_number (string or null).
           `;

          const result = await model.generateContent(prompt);
          const text = result.response.text();
          return normalizeIntent(JSON.parse(text) as ParsedIntent);
        });
      } catch (error) {
        console.error('All Gemini clients failed for intent parsing, falling back to rule-based:', error);
        return this.parseRuleBased(query, history);
      }
    } else {
      return this.parseRuleBased(query, history);
    }
  }

  /**
   * Rule-based intent parser as a robust fallback with history context inheritance.
   */
  private parseRuleBased(query: string, history?: any[]): ParsedIntent {
    const queryLower = query.toLowerCase();
    const items: string[] = [];

    // Simple item detection
    if (queryLower.includes('cake') || queryLower.includes('gateau')) items.push('cake');
    if (queryLower.includes('rose') || queryLower.includes('flower') || queryLower.includes('bouquet')) items.push('roses');
    if (queryLower.includes('card') || queryLower.includes('wish')) items.push('card');
    if (queryLower.includes('chocolate') || queryLower.includes('choco')) items.push('chocolates');
    if (queryLower.includes('sweet') || queryLower.includes('avurudu')) items.push('sweets');

    // Inherit items from user history if none detected in current query
    if (items.length === 0 && history && history.length > 0) {
      for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].sender !== 'user') continue;
        const prevText = history[i].text.toLowerCase();
        if (prevText.includes('cake') || prevText.includes('gateau')) { items.push('cake'); break; }
        if (prevText.includes('rose') || prevText.includes('flower') || prevText.includes('bouquet')) { items.push('roses'); break; }
        if (prevText.includes('card') || prevText.includes('wish')) { items.push('card'); break; }
        if (prevText.includes('chocolate') || prevText.includes('choco')) { items.push('chocolates'); break; }
        if (prevText.includes('sweet') || prevText.includes('avurudu')) { items.push('sweets'); break; }
      }
    }

    if (items.length === 0) {
      items.push('gift');
    }

    // City extraction
    let target_city: string | null = null;
    const cities = ['colombo', 'kandy', 'negombo', 'galle', 'jaffna', 'batticaloa', 'gampaha', 'kalutara', 'kurunegala'];
    for (const city of cities) {
      if (queryLower.includes(city)) {
        target_city = city.charAt(0).toUpperCase() + city.slice(1);
        const colomboMatch = queryLower.match(/colombo\s*0?(\d+)/i);
        if (colomboMatch) {
          const zone = parseInt(colomboMatch[1]);
          target_city = `Colombo ${zone < 10 ? '0' + zone : zone}`;
        }
        break;
      }
    }

    // Inherit city from user history if none in current query
    if (!target_city && history && history.length > 0) {
      for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].sender !== 'user') continue;
        const prevText = history[i].text.toLowerCase();
        for (const city of cities) {
          if (prevText.includes(city)) {
            target_city = city.charAt(0).toUpperCase() + city.slice(1);
            const colomboMatch = prevText.match(/colombo\s*0?(\d+)/i);
            if (colomboMatch) {
              const zone = parseInt(colomboMatch[1]);
              target_city = `Colombo ${zone < 10 ? '0' + zone : zone}`;
            }
            break;
          }
        }
        if (target_city) break;
      }
    }

    // Budget extraction (LKR / Rs.)
    let max_budget: number | null = null;
    const budgetMatch = queryLower.match(/(?:under|below|budget|rs\.?|lkr)\s*(\d+[\d,]*)/) || queryLower.match(/(\d+[\d,]*)\s*(?:lkr|rs|rupees)/);
    if (budgetMatch) {
      max_budget = Number(budgetMatch[1].replace(/,/g, ''));
    }

    // Inherit budget from user history if none in current query
    if (!max_budget && history && history.length > 0) {
      for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].sender !== 'user') continue;
        const prevText = history[i].text.toLowerCase();
        const prevBudgetMatch = prevText.match(/(?:under|below|budget|rs\.?|lkr)\s*(\d+[\d,]*)/) || prevText.match(/(\d+[\d,]*)\s*(?:lkr|rs|rupees)/);
        if (prevBudgetMatch) {
          max_budget = Number(prevBudgetMatch[1].replace(/,/g, ''));
          break;
        }
      }
    }

    // Date extraction relative to current system time (Asia/Colombo UTC+5.30)
    const now = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const nextWeekStr = nextWeek.toISOString().split('T')[0];

    const weekend = new Date(now.getTime());
    const dayOfWeek = weekend.getUTCDay();
    const daysToAdd = dayOfWeek === 0 ? 7 : (7 - dayOfWeek);
    weekend.setUTCDate(weekend.getUTCDate() + daysToAdd);
    const weekendStr = weekend.toISOString().split('T')[0];

    let delivery_date: string | null = null;
    const isTomorrow = queryLower.includes('tomorrow') || queryLower.includes('heta') || queryLower.includes('nalaki');
    const isNextWeek = queryLower.includes('next week') || queryLower.includes('laba week') || queryLower.includes('adutha varam');
    const isWeekend = queryLower.includes('weekend') || queryLower.includes('santhiya');

    if (isTomorrow) {
      delivery_date = tomorrowStr;
    } else if (isNextWeek) {
      delivery_date = nextWeekStr;
    } else if (isWeekend) {
      delivery_date = weekendStr;
    }

    // Inherit date from user history if none in current query
    if (!delivery_date && history && history.length > 0) {
      for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].sender !== 'user') continue;
        const prevText = history[i].text.toLowerCase();
        if (prevText.includes('tomorrow') || prevText.includes('heta') || prevText.includes('nalaki')) {
          delivery_date = tomorrowStr;
          break;
        } else if (prevText.includes('next week') || prevText.includes('laba week') || prevText.includes('adutha varam')) {
          delivery_date = nextWeekStr;
          break;
        } else if (prevText.includes('weekend') || prevText.includes('santhiya')) {
          delivery_date = weekendStr;
          break;
        }
      }
    }

    const recipient_relation = queryLower.includes('amma') ? 'mother' : queryLower.includes('maching') ? 'friend' : null;
    
    // Determine is_self_shopping
    const hasGiftingKeywords = queryLower.includes('gift') || queryLower.includes('surprise') || queryLower.includes('send to') || queryLower.includes('yawanna') || queryLower.includes('anupunga') || queryLower.includes('gift hamper');
    const is_self_shopping = (recipient_relation || hasGiftingKeywords) ? false : true;

    // Try to extract phone number (e.g. 0786674557 or +94771234567)
    const phoneMatch = query.match(/(?:phone|mobile|tel|contact|no)\s*(?:no|number|eka)?\s*(?:is|:)?\s*(\+?\d[\d\s-]{8,12}\d)/i);
    const recipient_phone = phoneMatch ? phoneMatch[1].replace(/[\s-]/g, '') : null;

    // Try to extract name (e.g. mage nama Hamsey)
    const nameMatch = query.match(/(?:name|nama|nma|sender)\s*(?:eka|is)?\s*([a-zA-Z]{2,15})/i);
    const extractedName = nameMatch ? nameMatch[1].trim() : null;

    const recipient_name = is_self_shopping ? extractedName : null;
    const sender_name = extractedName;

    // Generate a simple rule-based hamper title
    let hamper_title = 'Bespoke Hamper Bundle';
    if (is_self_shopping) {
      if (items.includes('cake')) hamper_title = 'My Birthday Cake Delight';
      else if (items.includes('roses') || items.includes('flowers')) hamper_title = 'My Fresh Floral Collection';
      else hamper_title = 'Everyday Staples Cart';
    } else {
      const relationLabel = recipient_relation ? (recipient_relation.charAt(0).toUpperCase() + recipient_relation.slice(1)) : 'Special Someone';
      if (items.includes('cake') && (items.includes('roses') || items.includes('flowers'))) {
        hamper_title = `${relationLabel}'s Celebration Hamper`;
      } else if (items.includes('cake')) {
        hamper_title = `${relationLabel}'s Cake Surprise`;
      } else if (items.includes('roses') || items.includes('flowers')) {
        hamper_title = `${relationLabel}'s Floral Surprise`;
      } else {
        hamper_title = `Special Gift for ${relationLabel}`;
      }
    }

    // Track order number extraction (e.g. VPAY827982BA)
    const trackMatch = query.match(/\b(VPAY[A-Z0-9]{6,12})\b/i);
    let track_order_number = trackMatch ? trackMatch[1].toUpperCase() : null;

    // Inherit track_order_number from history if not present in current query
    if (!track_order_number && history && history.length > 0) {
      for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].sender !== 'user') continue;
        const prevText = history[i].text.toUpperCase();
        const prevTrackMatch = prevText.match(/\b(VPAY[A-Z0-9]{6,12})\b/);
        if (prevTrackMatch) {
          track_order_number = prevTrackMatch[1];
          break;
        }
      }
    }

    return normalizeIntent({
      items,
      target_city,
      delivery_date,
      max_budget,
      gift_message: null,
      recipient_relation,
      recipient_name,
      recipient_phone,
      delivery_address: null,
      sender_name,
      is_self_shopping,
      hamper_title,
      track_order_number,
    });
  }

  /**
   * Resolves a colloquial city name to a canonical Kapruka city using 'kapruka_list_delivery_cities'.
   */
  public async resolveCanonicalCity(cityName: string): Promise<string> {
    let cleanedName = cityName.trim();
    
    // Normalize "Colombo X" or "colombo X" to "Colombo 0X"
    const colomboZoneMatch = cleanedName.match(/^colombo\s*0?(\d+)$/i);
    if (colomboZoneMatch) {
      const zoneNum = Number(colomboZoneMatch[1]);
      cleanedName = `Colombo ${zoneNum < 10 ? '0' + zoneNum : zoneNum}`;
    }

    try {
      console.log(`Resolving canonical city name for: "${cleanedName}"`);
      const results = await mcpClient.listDeliveryCities(cleanedName, 5);

      if (results && results.cities && Array.isArray(results.cities) && results.cities.length > 0) {
        const canonical = results.cities[0].name;
        console.log(`Resolved: "${cleanedName}" -> "${canonical}"`);
        return canonical;
      }

      return cleanedName;
    } catch (error) {
      console.error(`Error resolving city "${cleanedName}":`, error);
      return cleanedName;
    }
  }

  /**
   * Generates a warm, human-like chat reply using Gemini based on compiled bundle outcomes.
   */
  public async generateChatReply(
    query: string,
    intent: ParsedIntent,
    bundle: any,
    history?: any[],
    cart?: any[],
    tracking?: any
  ): Promise<string> {
    if (this.genAIInstances.length > 0) {
      try {
        return await this.executeWithRotation(async (genAI, modelName) => {
          const requestOptions: any = { timeout: 8000 };
          if (process.env.GEMINI_BASE_URL) {
            requestOptions.baseUrl = process.env.GEMINI_BASE_URL;
          }

          const model = genAI.getGenerativeModel({ model: modelName }, requestOptions);
          
          let historyPrompt = '';
          if (history && history.length > 0) {
            historyPrompt = '\nRecent Conversation History:\n' +
              history.map((m: any) => `${m.sender === 'user' ? 'User' : 'Assistant'}: ${m.text}`).join('\n') + '\n';
          }

          const prompt = `
            You are Kalpa Kapruka, a warm, premium, culturally grounded personal shopping assistant and AI gifting/commerce concierge in Sri Lanka.
            Your personality is helpful, witty, warm, highly engaging, and opinionated. Speak naturally like a human assistant texting a friend, not like a chatbot.
            Read the user's situation and offer a personal opinion or a bit of local advice/flavour when appropriate (e.g., if they are buying flowers after a breakup, suggest hand-delivery over a courier as a sincere gesture; if they are shopping for groceries, fashion, or daily essentials for themselves, offer practical recommendations).
            You support BOTH everyday self-shopping (buying groceries, electronics, home goods, or fashion for themselves) and gifting (sending surprises to others). Treat self-shopping as a main default mode unless they explicitly mention sending a gift.
            Your goal is to guide the customer confidently from "I'm not sure" to "add to cart" by suggesting products enthusiastically and asking helpful discovery questions.
            
            User message: "${query}"
            ${historyPrompt}
            Under the hood, we ran searches and logistics verification. Here are the results:
            - Items compiled in the hamper: ${JSON.stringify(bundle.items.map((i: any) => ({ name: i.name, price: i.price, category: i.category })))}
            - Current Items in user's UI Shopping Cart: ${JSON.stringify((cart || []).map((i: any) => ({ name: i.name, price: i.price, quantity: i.quantity })))}
            - Target City: ${bundle.city || intent.target_city || 'Not specified'}
            - Delivery Date: ${bundle.delivery_date || intent.delivery_date || 'Not specified'}
            - Deliverability: ${bundle.is_deliverable ? 'Available' : 'Unavailable'}
            - Perishable Warning: ${bundle.perishable_warning ? 'Yes' : 'No'}
            - Budget Limit: ${intent.max_budget ? intent.max_budget + ' LKR' : 'None'}
            - Budget Exceeded: ${bundle.budget_exceeded ? 'Yes' : 'No'}
            - Recipient Relation: ${intent.recipient_relation || 'Not specified'}
            - Recipient Name: ${intent.recipient_name || 'Not specified'}
            - Recipient Phone: ${intent.recipient_phone || 'Not specified'}
            - Delivery Address: ${intent.delivery_address || 'Not specified'}
            - Sender Name: ${intent.sender_name || 'Not specified'}
            - Is Self-Shopping Mode: ${intent.is_self_shopping ? 'Yes' : 'No'}
            - Order Tracking Info: ${tracking ? JSON.stringify(tracking) : 'None'}
            
            CRITICAL INFO COLLECTION RULES (when items are in the compiled hamper or the user's UI Shopping Cart):
            1. If the hamper/cart is NOT empty (meaning items are present in either the compiled hamper list or the user's UI Shopping Cart), your primary goal is to collect any missing delivery and checkout information.
            2. Check which of the following are missing ("Not specified") and ask for them politely, conversationally, and one at a time (or together if natural) in the USER's EXACT talking language and script (Tamil script, Sinhala script, Singlish, Tanglish, or English):
               - Recipient Name & Phone number (e.g. if Is Self-Shopping Mode is No, ask who is receiving the gift and their contact phone number. If Is Self-Shopping Mode is Yes, ask for their own name and phone number).
               - Delivery Address: If only the Delivery City is specified (e.g. "Kandy" or "Colombo 03") but the Delivery Address is "Not specified", you MUST explicitly ask for the full street address (e.g. house number and street).
               - Delivery City (if not specified).
               - Delivery Date (if not specified).
               - Sender's Name: (if Is Self-Shopping Mode is No, ask for the sender's name for the gift card. If Is Self-Shopping Mode is Yes, you do not need to ask for a sender name).
            3. Do not ask for details that are already specified (not set to "Not specified"). Only ask for the missing ones.
            4. Make your questions feel warm, human, and local (e.g. using Singlish/Tanglish phrasing if the user is using it).
 
            Guidelines for your response:
            1. Speak naturally like a human shopping concierge. Avoid templates. Respond in the EXACT same language and script that the user addressed you in:
               - If the user wrote in Tamil script, reply in warm, helpful Tamil script.
               - If the user wrote in Sinhala script, reply in warm, helpful Sinhala script.
               - If the user wrote in Singlish (English letters but Sinhala words), reply in friendly, warm Singlish.
               - If the user wrote in Tanglish (English letters but Tamil words), reply in friendly, warm Tanglish.
               - If the user wrote in English, reply in premium, warm English.
            2. Introduce compiled products enthusiastically (e.g., "I've picked out a gorgeous, rich Double Chocolate Fudge Gateau—perfect for a birthday surprise!").
            3. Guide them actively: if they haven't specified details (like city, delivery date, or who the gift is for), ask a friendly discovery question (e.g., "Galle walatada heta yawanna one?" or "Are we surprising your mother or a close friend?").
            4. If a budget constraint was exceeded, mention it politely and suggest a lighter/better-fitting alternative confidently.
            5. CRITICAL: Do NOT say that Kapruka does not offer fresh cakes, roses, or flowers for delivery. Kapruka is Sri Lanka's largest store and offers them all. If nothing is in the hamper, explain that they are out of stock or exceeded the budget limit, and suggest looking for something else.
            6. CRITICAL: Do NOT leak any internal developer function names, system tool names, or code terms (such as 'kapruka_create_order', 'kapruka_search_products', 'mcpClient', 'intent', etc.). The customer must never see developer/technical jargon.
            7. Write a short, engaging response (2-4 sentences). End with a warm hook to keep them chatting or prompt them to add items to their cart/hamper.
            8. If Order Tracking Info is present (not 'None'), formulate a warm, helpful summary of the order status, recipient name, delivery date, and latest timeline stage. Address them in their script, and explain that the live tracking details have been loaded on their dashboard.
          `;
 
          const result = await model.generateContent(prompt);
          return result.response.text().trim();
        });
      } catch (err) {
        console.error('All Gemini clients failed for generating chat reply:', err);
      }
    }
    
    // Detect query language for fallback response (including history context for continuity)
    const sinhalaRegex = /[\u0D80-\u0DFF]/;
    const tamilRegex = /[\u0B80-\u0BFF]/;
    
    // Check current query
    let isSinhala = sinhalaRegex.test(query);
    let isTamil = tamilRegex.test(query);
    const textLower = query.toLowerCase();
    
    const tanglishKeywords = ['enaku', 'unaku', 'venum', 'anupunga', 'kudunga', 'iruka', 'eppo', 'nalaki', 'panna', 'pannunga', 'anupa', 'vanakkam', 'epdi', 'epadi', 'tanglish'];
    const singlishKeywords = ['mata', 'one', 'ewanna', 'danna', 'hampa', 'yawanna', 'puluwanda', 'heta', 'walata', 'hari', 'mama', 'oyage', 'meka', 'mge', 'karanna', 'kohomada', 'oyata', 'halo', 'niyamai', 'thamai', 'nama', 'ela', 'oya', 'epaa', 'ganna', 'puluwan', 'nane', 'krla', 'balamu', 'ehenan', 'wade', 'denna', 'hoda', 'nadda', 'machan', 'maching', 'wisthara', 'saha', 'shehani', 'nisith', 'singlish'];
 
    let isTanglish = tanglishKeywords.some(kw => textLower.includes(kw));
    let isSinglish = singlishKeywords.some(kw => textLower.includes(kw));
 
    // Scan history if current query does not explicitly set language
    if (!isSinhala && !isTamil && !isTanglish && !isSinglish && history && history.length > 0) {
      for (const msg of [...history].reverse()) {
        if (msg.sender === 'user') {
          const prevText = msg.text.toLowerCase();
          if (sinhalaRegex.test(prevText)) {
            isSinhala = true;
            break;
          }
          if (tamilRegex.test(prevText)) {
            isTamil = true;
            break;
          }
          if (tanglishKeywords.some(kw => prevText.includes(kw))) {
            isTanglish = true;
            break;
          }
          if (singlishKeywords.some(kw => prevText.includes(kw))) {
            isSinglish = true;
            break;
          }
        }
      }
    }
 
    if (tracking) {
      const orderId = tracking.order_id;
      const status = tracking.status || 'Processing';
      const delDate = tracking.delivery_date || 'soon';
      
      if (isTamil) {
        return `உங்கள் ஆர்டர் ${orderId} தற்போது "${status}" நிலையில் உள்ளது. விநியோக தேதி: ${delDate}. மேலதிக விபரங்கள் இடது பக்கத்தில் காட்டப்பட்டுள்ளன! 😊`;
      } else if (isSinhala) {
        return `ඔබගේ ඇණවුම ${orderId} මේ වන විට "${status}" තත්වයේ පවතී. බෙදාහැරීමේ දිනය: ${delDate}. වැඩි විස්තර වම් පසින් බලාගත හැක! 😊`;
      } else if (isTanglish) {
        return `Unga order ${orderId} ippo "${status}" status la iruku. Delivery date: ${delDate}. Details left side la check pannunga! 😊`;
      } else if (isSinglish) {
        return `Oyage order ${orderId} eka ippo "${status}" status eke thiyenne. Delivery date eka: ${delDate}. Details left side panel eken balanna puluwani machan! 😊`;
      } else {
        return `Your order ${orderId} is currently in "${status}" status. Scheduled delivery: ${delDate}. You can see the full tracking timeline on the left panel! 😊`;
      }
    }

    // Detect if it is a general social greeting
    const greetings = ['hello', 'hi', 'hey', 'vanakkam', 'ayubowan', 'kohomada', 'epdi', 'epadi', 'how are you', 'halo', 'hola'];
    const isGreeting = greetings.some(g => {
      const escaped = g.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'i');
      return regex.test(query);
    });

    let reply = '';
    let langKey: 'english' | 'sinhala' | 'tamil' | 'singlish' | 'tanglish' = 'english';
    if (isTamil) langKey = 'tamil';
    else if (isSinhala) langKey = 'sinhala';
    else if (isTanglish) langKey = 'tanglish';
    else if (isSinglish) langKey = 'singlish';

    const missingPrompt = getRuleBasedMissingDetailsPrompt(intent, cart, bundle, langKey);

    if (isTamil) {
      if (isGreeting) {
        if (missingPrompt) {
          reply = `வணக்கம்! நான் உங்களுக்கு எவ்வாறு உதவ முடியும்? உங்கள் கூடையில் பொருட்கள் உள்ளன. ${missingPrompt}`;
        } else {
          reply = `வணக்கம்! நான் உங்களுக்கு இன்று எவ்வாறு உதவ முடியும்? உங்களுக்கு புதிய பூக்கள், கேக், சாக்லேட் அல்லது பரிசு கூடை ஏதேனும் தேவையா? 😊`;
        }
      } else if (bundle.budget_exceeded) {
        reply = `சரி! உங்கள் கோரிக்கையை நான் சரிபார்த்தேன். இருப்பினும், தேர்ந்தெடுக்கப்பட்ட பொருட்களின் மொத்த விலை (ரூ. ${bundle.total.toLocaleString()} LKR) உங்கள் பட்ஜெட்டைக் காட்டிலும் அதிகமாக உள்ளது. மலிவான பொருட்கள் ஏதேனும் தேவையா என்று எனக்குக் கூறவும்! 😕`;
      } else if (bundle.items.length > 0) {
        if (missingPrompt) {
          reply = `சரி! உங்கள் கோரிக்கையை நான் சரிபார்த்தேன். உங்கள் தேவைக்கேற்ப ${bundle.items.length} பொருட்களை நான் கூடையில் சேர்த்துள்ளேன். ${missingPrompt}`;
        } else {
          reply = `சரி! உங்கள் கோரிக்கையை நான் சரிபார்த்தேன். உங்கள் தேவைக்கேற்ப ${bundle.items.length} பொருட்களை நான் கூடையில் சேர்த்துள்ளேன், இதனை ${bundle.city || 'உங்கள் இடத்திற்கு'} விநியோகிக்க முடியும். இடது பக்க Curation Space இல் விவரங்களைச் சரிபார்த்து பணம் செலுத்தலாம்! 🎁`;
        }
      } else {
        if (missingPrompt) {
          reply = `சரி! உங்கள் விபரங்களை நான் புதுப்பித்துள்ளேன். ${missingPrompt}`;
        } else {
          reply = `சரி! உங்கள் கோரிக்கையை நான் சரிபார்த்தேன். தற்போது பொருத்தமான பொருட்கள் எதுவும் இல்லை. 😕 உங்களுக்கு கேக், ரோஜாக்கள் அல்லது வாழ்த்து அட்டைகள் ஏதேனும் தேவையா என்று எனக்குக் கூறவும்!`;
        }
      }
    } else if (isSinhala) {
      if (isGreeting) {
        if (missingPrompt) {
          reply = `හලෝ! මම ඔයාට අද උදව් කරන්නේ කොහොමද? ඔයාගේ හැම්පර් එකේ භාණ්ඩ තිබෙනවා. ${missingPrompt}`;
        } else {
          reply = `හලෝ! මම ඔයාට අද උදව් කරන්නේ කොහොමද? ඔයාට ලස්සන රෝස මල්, රසවත් කේක්, චොකලට් හෝ තෑගි හැම්පර් එකක් අවශ්‍යද? 😊`;
        }
      } else if (bundle.budget_exceeded) {
        reply = `හරි! මම ඔයාගේ ඉල්ලීම පරීක්ෂා කළා. නමුත් තෝරාගත් භාණ්ඩවල මුළු මිල (රු. ${bundle.total.toLocaleString()} LKR) ඔයාගේ budget එකට වඩා වැඩියි. කරුණාකර වෙනත් අඩු මිල භාණ්ඩයක් තෝරාගන්න හෝ budget එක වැඩි කරන්න! 😕`;
      } else if (bundle.items.length > 0) {
        if (missingPrompt) {
          reply = `හරි! මම ඔයාගේ ඉල්ලීම පරීක්ෂා කළා. ඔයාගේ අවශ්‍යතාවයට ගැළපෙන භාණ්ඩ ${bundle.items.length} ක් මම හැම්පර් එකට එකතු කළා. ${missingPrompt}`;
        } else {
          reply = `හරි! මම ඔයාගේ ඉල්ලීම පරීක්ෂා කළා. ඔයාගේ අවශ්‍යතාවයට ගැළපෙන භාණ්ඩ ${bundle.items.length} ක් මම හැම්පර් එකට එකතු කළා, එය ${bundle.city || 'ඔයාගේ නගරයට'} ලබා දිය හැකියි. වම් පස ඇති Curation Space එකෙන් විස්තර පරීක්ෂා කර checkout කරන්න පුළුවන්! 🎁`;
        }
      } else {
        if (missingPrompt) {
          reply = `හරි! මම ඔයාගේ විස්තර update කළා. ${missingPrompt}`;
        } else {
          reply = `හරි! මම ඔයාගේ ඉල්ලීම පරීක්ෂා කළා. මට මේ වෙලාවේ ගැළපෙන භාණ්ඩ සොයාගැනීමට නොහැකි වුණා. 😕 ඔයාට කේක්, රෝස මල් හෝ සුබපැතුම් පත් අවශ්‍යද කියා මට කියන්න!`;
        }
      }
    } else if (isTanglish) {
      if (isGreeting) {
        if (missingPrompt) {
          reply = `Vanakkam! Naan ungaluku eppadi help panna mudiyum? Unga hamper la items iruku. ${missingPrompt}`;
        } else {
          reply = `Vanakkam! Naan ungaluku eppadi help panna mudiyum? Ungaluku cake, roses, chocolates, illa hamper edhavadhu pakadhumo? 😊`;
        }
      } else if (bundle.budget_exceeded) {
        reply = `Vanakkam! Ungaloda request ah check pannen. Aana neenga select panna items total price (Rs. ${bundle.total.toLocaleString()} LKR) ungaloda budget ah vida adhigama iruku. Cheaper option edhavadhu pakalama, illa budget ah adhigam panalama? 😕`;
      } else if (bundle.items.length > 0) {
        if (missingPrompt) {
          reply = `Vanakkam! Ungaloda request ku matching ah ${bundle.items.length} items hamper la add panni iruken. ${missingPrompt}`;
        } else {
          reply = `Vanakkam! Ungaloda request ku matching ah ${bundle.items.length} items hamper la add panni iruken, idhai ${bundle.city || 'ungaloda destination'} ku deliver panna mudiyum. Left side Curation Space la details check panni checkout pannunga! 🎁`;
        }
      } else {
        if (missingPrompt) {
          reply = `Hari! Naan unga details ah update pannen. ${missingPrompt}`;
        } else {
          reply = `Vanakkam! Ungaloda request ah check pannen. Enaku matching items stock la kandupidika mudiyala. 😕 Ungaluku cakes, roses, illa greeting cards edhavadhu venuma nu sollunga!`;
        }
      }
    } else if (isSinglish) {
      if (isGreeting) {
        if (missingPrompt) {
          reply = `Hello! Mama oyata kohomada help karanna one? Oyage hamper eke items thiyenawa. ${missingPrompt}`;
        } else {
          reply = `Hello! Mama oyata kohomada help karanna one? Oyatath cake ekak, roses, chocolates nathnam hamper ekak balannada one? 😊`;
        }
      } else if (bundle.budget_exceeded) {
        reply = `Hari! Mama oyage request eka check kala. But selected items wala total price (Rs. ${bundle.total.toLocaleString()} LKR) oyage budget ekata wada wadi. Dynamic items check karala budget eka wadi karanna puluwanda, natham card wage adu price item ekak balamuda? 😕`;
      } else if (bundle.items.length > 0) {
        if (missingPrompt) {
          reply = `Hari! Mama oyage request eka check kala. I've put together a hamper with ${bundle.items.length} item(s) matching your request. ${missingPrompt}`;
        } else {
          reply = `Hari! Mama oyage request eka check kala. I've put together a hamper with ${bundle.items.length} item(s) matching your request, deliverable to ${bundle.city || 'your destination'}. Left side layout eken details check karala checkout karanna puluwani! 🎁`;
        }
      } else {
        if (missingPrompt) {
          reply = `Hari! Mama oyage details update kala. ${missingPrompt}`;
        } else {
          reply = `Hari! Mama oyage request eka check kala. Mata matching items stock eke hoyaganna bari unaa. 😕 Let me know if you would like me to search for cakes, roses, or custom greeting cards!`;
        }
      }
    } else {
      if (isGreeting) {
        if (missingPrompt) {
          reply = `Hello! How can I help you today? I see you have items in your cart. ${missingPrompt}`;
        } else {
          reply = `Hello! How can I help you today? Are you looking for some fresh flowers, cakes, chocolates, or a custom gift hamper? 😊`;
        }
      } else if (bundle.budget_exceeded) {
        reply = `Hari! I've checked your request. However, the total price of Rs. ${bundle.total.toLocaleString()} LKR exceeds your budget limit of Rs. ${intent.max_budget?.toLocaleString()} LKR. Let me know if we should check cheaper options (like cards or chocolates) or if you would like to increase the budget limit! 😕`;
      } else if (bundle.items.length > 0) {
        if (missingPrompt) {
          reply = `Hari! I've checked your request. I have successfully compiled a hamper containing ${bundle.items.length} item(s) matching your request. ${missingPrompt}`;
        } else {
          reply = `Hari! I've checked your request. I have successfully compiled a hamper containing ${bundle.items.length} item(s) matching your request, deliverable to ${bundle.city || 'your destination'}. You can review the details on the left Curation Space and proceed to checkout! 🎁`;
        }
      } else {
        if (missingPrompt) {
          reply = `Hari! I've updated your checkout details. ${missingPrompt}`;
        } else {
          reply = `Hari! I've checked your request. I couldn't find matching items in stock right now. Let me know if you would like me to search for roses, cakes, or custom greeting cards!`;
        }
      }
    }
    return reply;
  }
}

export function getRuleBasedMissingDetailsPrompt(
  intent: ParsedIntent,
  cart: any[] = [],
  bundle: any,
  lang: 'english' | 'sinhala' | 'tamil' | 'singlish' | 'tanglish'
): string | null {
  const hasItems = (cart && cart.length > 0) || (bundle && bundle.items && bundle.items.length > 0);
  if (!hasItems) return null;

  const isSelf = !!intent.is_self_shopping;

  const city = intent.target_city || bundle.city;
  const date = intent.delivery_date || bundle.delivery_date;
  const address = intent.delivery_address;
  const recipientName = intent.recipient_name;
  const recipientPhone = intent.recipient_phone;
  const senderName = intent.sender_name;

  const isCityMissing = !city;
  const isDateMissing = !date;
  const isAddressMissing = !address;
  const isRecipientMissing = !recipientName || !recipientPhone;
  const isSenderMissing = !isSelf && !senderName;

  if (isCityMissing) {
    switch (lang) {
      case 'sinhala': return 'භාණ්ඩය බෙදාහැරිය යුතු නගරය කුමක්ද? (උදා: Colombo 03, Kandy, Galle)';
      case 'tamil': return 'பொருட்களை எந்த நகரத்திற்கு வினியோகிக்க வேண்டும்? (உதாரணம்: Colombo 03, Kandy, Galle)';
      case 'singlish': return 'Delivery city eka mokakda machan? (e.g. Colombo 03, Kandy, Galle)';
      case 'tanglish': return 'Delivery city enna nu solla mudiyuma? (e.g. Colombo 03, Kandy, Galle)';
      default: return 'Could you please tell me which city we are delivering to? (e.g. Colombo 03, Kandy, Galle)';
    }
  }

  if (isAddressMissing) {
    switch (lang) {
      case 'sinhala': 
        return `නගරය ${city} ලෙස ලැබී ඇත, නමුත් සම්පූර්ණ බෙදාහැරීමේ ලිපිනය (නිවාස අංකය සහ වීදිය) පවසන්න පුළුවන්ද?`;
      case 'tamil': 
        return `நகரம் ${city} என்று குறிப்பிடப்பட்டுள்ளது, ஆனால் முழு வினியோக முகவரி (வீட்டு எண் மற்றும் தெரு) என்ன?`;
      case 'singlish': 
        return `City eka ${city} kiyala labuna, eth full delivery address eka (house number & street) kiyන්න puluwanda?`;
      case 'tanglish': 
        return `City ${city} nu vandhuchu, aana full delivery address (house number & street) enna nu solla mudiyuma?`;
      default: 
        return `I see you're delivering to ${city}. Could you please provide the full delivery address (including house/apartment number and street name)?`;
    }
  }

  if (isRecipientMissing) {
    if (isSelf) {
      switch (lang) {
        case 'sinhala': return 'ඔබගේ නම සහ දුරකථන අංකය පවසන්න පුළුවන්ද?';
        case 'tamil': return 'விநியோகத்திற்காக உங்கள் பெயர் மற்றும் தொலைபேசி எண்ணைக் கூற முடியுமா?';
        case 'singlish': return 'Oyage nama saha contact phone number eka kiyන්න puluwanda?';
        case 'tanglish': return 'Delivery kaaga unga name and phone number solla mudiyuma?';
        default: return 'Could you please share your name and contact phone number for the delivery?';
      }
    } else {
      switch (lang) {
        case 'sinhala': return 'තෑග්ග ලබන අයගේ (recipient) නම සහ දුරකථන අංකය පවසන්න පුළුවන්ද?';
        case 'tamil': return 'பரிசைப் பெறுபவரின் பெயர் மற்றும் தொலைபேசி எண்ணைக் கூற முடியுமா?';
        case 'singlish': return 'Surprise eka labෙන kenaage (recipient) nama saha phone number eka kiyන්න puluwanda?';
        case 'tanglish': return 'Gift receive panra avanga name and phone number solla mudiyuma?';
        default: return 'Could you please share the recipient\'s name and contact phone number?';
      }
    }
  }

  if (isDateMissing) {
    switch (lang) {
      case 'sinhala': return 'භාණ්ඩය බෙදාහැරිය යුතු දිනය කුමක්ද? (උදා: හෙට, ලබන සතියේ)';
      case 'tamil': return 'விநியோகிக்க வேண்டிய தேதி என்ன? (உதாரணம்: நாளை, அடுத்த வாரம்)';
      case 'singlish': return 'Deliver karන්න ඕනෙ date eka mokakda? (e.g. tomorrow, next week)';
      case 'tanglish': return 'Deliver panna vendiya date enna? (e.g. tomorrow, next week)';
      default: return 'What date would you like this delivered? (e.g. tomorrow, next week)';
    }
  }

  if (isSenderMissing) {
    switch (lang) {
      case 'sinhala': return 'කාඩ්පත සඳහා ඔබගේ නම (යවන්නාගේ නම) පවසන්න පුළුවන්ද?';
      case 'tamil': return 'வாழ்த்து அட்டையில் சேர்க்க உங்கள் பெயர் (அனுப்புநரின் பெயர்) என்ன?';
      case 'singlish': return 'Oyage nama (sender\'s name) mokakda gift card ekata danna?';
      case 'tanglish': return 'Gift card la poda unga name (sender\'s name) enna?';
      default: return 'Could you please tell me your name (sender\'s name) for the card?';
    }
  }

  return null;
}

export const nlpService = new NlpService();
