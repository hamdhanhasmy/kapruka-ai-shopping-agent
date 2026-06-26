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

    const modelsToTry = ['gemini-flash-latest', 'gemini-2.5-flash'];
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
               
              CRITICAL RULES for Self-Shopping mode (is_self_shopping is true):
              - If they mention their own name (e.g. "mage nama Hamsey"), set BOTH "recipient_name" and "sender_name" to that name.
              - If they mention their own phone number (e.g. "phone no eka 0786674557"), set "recipient_phone" to that phone number so the contact phone number input gets updated correctly.
             
             ${historyPrompt}
             User Query: "${query}"

             Return ONLY a JSON block with these keys: items (array), target_city (string or null), delivery_date (string or null), max_budget (number or null), gift_message (string or null), recipient_relation (string or null), recipient_name (string or null), recipient_phone (string or null), delivery_address (string or null), sender_name (string or null), is_self_shopping (boolean).
           `;

          const result = await model.generateContent(prompt);
          const text = result.response.text();
          return JSON.parse(text) as ParsedIntent;
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

    return {
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
    };
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
    history?: any[]
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
            - Target City: ${bundle.city || 'Not specified'}
            - Delivery Date: ${bundle.delivery_date || 'Not specified'}
            - Deliverability: ${bundle.is_deliverable ? 'Available' : 'Unavailable'}
            - Perishable Warning: ${bundle.perishable_warning ? 'Yes' : 'No'}
            - Budget Limit: ${intent.max_budget ? intent.max_budget + ' LKR' : 'None'}
            - Budget Exceeded: ${bundle.budget_exceeded ? 'Yes' : 'No'}
            - Recipient: ${intent.recipient_relation || 'Not specified'}
            
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
          `;

          const result = await model.generateContent(prompt);
          return result.response.text().trim();
        });
      } catch (err) {
        console.error('All Gemini clients failed for generating chat reply:', err);
      }
    }
    
    // Detect query language for fallback response
    const sinhalaRegex = /[\u0D80-\u0DFF]/;
    const tamilRegex = /[\u0B80-\u0BFF]/;
    const isSinhala = sinhalaRegex.test(query);
    const isTamil = tamilRegex.test(query);
    const textLower = query.toLowerCase();
    const isTanglish = ['enaku', 'unaku', 'venum', 'anupunga', 'kudunga', 'iruka', 'eppo', 'nalaki', 'panna', 'pannunga', 'anupa', 'vanakkam', 'epdi', 'epadi'].some(kw => textLower.includes(kw));
    const isSinglish = ['mata', 'one', 'ewanna', 'danna', 'hampa', 'yawanna', 'puluwanda', 'heta', 'walata', 'hari', 'mama', 'oyage', 'meka', 'mge', 'karanna', 'kohomada', 'oyata', 'halo'].some(kw => textLower.includes(kw));

    // Detect if it is a general social greeting
    const greetings = ['hello', 'hi', 'hey', 'vanakkam', 'ayubowan', 'kohomada', 'epdi', 'epadi', 'how are you', 'halo', 'hola'];
    const isGreeting = greetings.some(g => {
      const escaped = g.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'i');
      return regex.test(query);
    });

    let reply = '';
    if (isTamil) {
      if (isGreeting) {
        reply = `வணக்கம்! நான் உங்களுக்கு இன்று எவ்வாறு உதவ முடியும்? உங்களுக்கு புதிய பூக்கள், கேக், சாக்லேட் அல்லது பரிசு கூடை ஏதேனும் தேவையா? 😊`;
      } else if (bundle.budget_exceeded) {
        reply = `சரி! உங்கள் கோரிக்கையை நான் சரிபார்த்தேன். இருப்பினும், தேர்ந்தெடுக்கப்பட்ட பொருட்களின் மொத்த விலை (ரூ. ${bundle.total.toLocaleString()} LKR) உங்கள் பட்ஜெட்டைக் காட்டிலும் அதிகமாக உள்ளது. மலிவான பொருட்கள் ஏதேனும் தேவையா என்று எனக்குக் கூறவும்! 😕`;
      } else if (bundle.items.length > 0) {
        reply = `சரி! உங்கள் கோரிக்கையை நான் சரிபார்த்தேன். உங்கள் தேவைக்கேற்ப ${bundle.items.length} பொருட்களை நான் கூடையில் சேர்த்துள்ளேன், இதனை ${bundle.city || 'உங்கள் இடத்திற்கு'} விநியோகிக்க முடியும். இடது பக்க Curation Space இல் விவரங்களைச் சரிபார்த்து பணம் செலுத்தலாம்! 🎁`;
      } else {
        reply = `சரி! உங்கள் கோரிக்கையை நான் சரிபார்த்தேன். தற்போது பொருத்தமான பொருட்கள் எதுவும் இல்லை. 😕 உங்களுக்கு கேக், ரோஜாக்கள் அல்லது வாழ்த்து அட்டைகள் ஏதேனும் தேவையா என்று எனக்குக் கூறவும்!`;
      }
    } else if (isSinhala) {
      if (isGreeting) {
        reply = `හලෝ! මම ඔයාට අද උදව් කරන්නේ කොහොමද? ඔයාට ලස්සන රෝස මල්, රසවත් කේක්, චොකලට් හෝ තෑගි හැම්පර් එකක් අවශ්‍යද? 😊`;
      } else if (bundle.budget_exceeded) {
        reply = `හරි! මම ඔයාගේ ඉල්ලීම පරීක්ෂා කළා. නමුත් තෝරාගත් භාණ්ඩවල මුළු මිල (රු. ${bundle.total.toLocaleString()} LKR) ඔයාගේ budget එකට වඩා වැඩියි. කරුණාකර වෙනත් අඩු මිල භාණ්ඩයක් තෝරාගන්න හෝ budget එක වැඩි කරන්න! 😕`;
      } else if (bundle.items.length > 0) {
        reply = `හරි! මම ඔයාගේ ඉල්ලීම පරීක්ෂා කළා. ඔයාගේ අවශ්‍යතාවයට ගැළපෙන භාණ්ඩ ${bundle.items.length} ක් මම හැම්පර් එකට එකතු කළා, එය ${bundle.city || 'ඔයාගේ නගරයට'} ලබා දිය හැකියි. වම් පස ඇති Curation Space එකෙන් විස්තර පරීක්ෂා කර checkout කරන්න පුළුවන්! 🎁`;
      } else {
        reply = `හරි! මම ඔයාගේ ඉල්ලීම පරීක්ෂා කළා. මට මේ වෙලාවේ ගැළපෙන භාණ්ඩ සොයාගැනීමට නොහැකි වුණා. 😕 ඔයාට කේක්, රෝස මල් හෝ සුබපැතුම් පත් අවශ්‍යද කියා මට කියන්න!`;
      }
    } else if (isTanglish) {
      if (isGreeting) {
        reply = `Vanakkam! Naan ungaluku eppadi help panna mudiyum? Ungaluku cake, roses, chocolates, illa hamper edhavadhu pakadhumo? 😊`;
      } else if (bundle.budget_exceeded) {
        reply = `Vanakkam! Ungaloda request ah check pannen. Aana neenga select panna items total price (Rs. ${bundle.total.toLocaleString()} LKR) ungaloda budget ah vida adhigama iruku. Cheaper option edhavadhu pakalama, illa budget ah adhigam panalama? 😕`;
      } else if (bundle.items.length > 0) {
        reply = `Vanakkam! Ungaloda request ah check pannen. Ungaloda request ku matching ah ${bundle.items.length} items hamper la add panni iruken, idhai ${bundle.city || 'ungaloda destination'} ku deliver panna mudiyum. Left side Curation Space la details check panni checkout pannunga! 🎁`;
      } else {
        reply = `Vanakkam! Ungaloda request ah check pannen. Enaku matching items stock la kandupidika mudiyala. 😕 Ungaluku cakes, roses, illa greeting cards edhavadhu venuma nu sollunga!`;
      }
    } else if (isSinglish) {
      if (isGreeting) {
        reply = `Hello! Mama oyata kohomada help karanna one? Oyatath cake ekak, roses, chocolates nathnam hamper ekak balannada one? 😊`;
      } else if (bundle.budget_exceeded) {
        reply = `Hari! Mama oyage request eka check kala. But selected items wala total price (Rs. ${bundle.total.toLocaleString()} LKR) oyage budget ekata wada wadi. Dynamic items check karala budget eka wadi karanna puluwanda, natham card wage adu price item ekak balamuda? 😕`;
      } else if (bundle.items.length > 0) {
        reply = `Hari! Mama oyage request eka check kala. I've put together a hamper with ${bundle.items.length} item(s) matching your request, deliverable to ${bundle.city || 'your destination'}. Left side layout eken details check karala checkout karanna puluwani! 🎁`;
      } else {
        reply = `Hari! Mama oyage request eka check kala. Mata matching items stock eke hoyaganna bari unaa. 😕 Let me know if you would like me to search for cakes, roses, or custom greeting cards!`;
      }
    } else {
      if (isGreeting) {
        reply = `Hello! How can I help you today? Are you looking for some fresh flowers, cakes, chocolates, or a custom gift hamper? 😊`;
      } else if (bundle.budget_exceeded) {
        reply = `Hari! I've checked your request. However, the total price of Rs. ${bundle.total.toLocaleString()} LKR exceeds your budget limit of Rs. ${intent.max_budget?.toLocaleString()} LKR. Let me know if we should check cheaper options (like cards or chocolates) or if you would like to increase the budget limit! 😕`;
      } else if (bundle.items.length > 0) {
        reply = `Hari! I've checked your request. I have successfully compiled a hamper containing ${bundle.items.length} item(s) matching your request, deliverable to ${bundle.city || 'your destination'}. You can review the details on the left Curation Space and proceed to checkout! 🎁`;
      } else {
        reply = `Hari! I've checked your request. I couldn't find matching items in stock right now. Let me know if you would like me to search for roses, cakes, or custom greeting cards!`;
      }
    }
    return reply;
  }
}


export const nlpService = new NlpService();
