import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const MCP_ENDPOINT = process.env.KAPRUKA_MCP_ENDPOINT || 'https://mcp.kapruka.com/mcp';

export class KaprukaMcpClient {
  private sessionId: string | null = null;
  private messageId = 0;

  constructor() {
    // Session is established lazily on first request
  }

  private async fetchWithTimeout(url: string, options: any, timeoutMs = 8000): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(id);
      return response;
    } catch (err) {
      clearTimeout(id);
      throw err;
    }
  }

  /**
   * Performs the Streamable HTTP handshake to initialize the session and extract the session ID.
   */
  private async establishSession(): Promise<string> {
    if (this.sessionId) return this.sessionId;

    console.log(`[MCP] Initializing session with Streamable HTTP at ${MCP_ENDPOINT}...`);

    try {
      // 1. Send initialize request
      const initRes = await this.fetchWithTimeout(MCP_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: ++this.messageId,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {},
            },
            clientInfo: {
              name: 'kapruka-orchestrator-client',
              version: '1.0.0',
            },
          },
        }),
      }, 8000);

      if (!initRes.ok) {
        const bodyText = await initRes.text();
        throw new Error(`Initialize handshake failed: HTTP ${initRes.status} - ${bodyText}`);
      }

      const sessionId = initRes.headers.get('mcp-session-id');
      if (!sessionId) {
        throw new Error('Server initialized successfully but failed to return "mcp-session-id" in headers');
      }

      this.sessionId = sessionId;
      console.log(`[MCP] Session established successfully. ID: ${this.sessionId}`);

      // 2. Send initialized notification (required by MCP protocol)
      await this.fetchWithTimeout(MCP_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
          'mcp-session-id': this.sessionId,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'notifications/initialized',
        }),
      }, 5000);

      return this.sessionId;
    } catch (err) {
      console.error('[MCP] Failed to establish session:', err);
      this.sessionId = null;
      throw err;
    }
  }

  /**
   * Helper to parse the event-stream wrapped response body from Streamable HTTP POSTs.
   */
  private parseStreamResponse(responseText: string): any {
    const lines = responseText.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('data:')) {
        const dataVal = trimmed.replace('data:', '').trim();
        return JSON.parse(dataVal);
      }
    }
    return JSON.parse(responseText);
  }

  /**
   * Invokes a tool on the Kapruka server. Automatically wraps arguments inside a 'params' block.
   */
  public async callTool(toolName: string, args: Record<string, any>): Promise<string> {
    const sessionId = await this.establishSession();

    // Wrap the tool arguments inside a "params" key as required by the Kapruka Python Pydantic schema
    const payload = {
      jsonrpc: '2.0',
      id: ++this.messageId,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: {
          params: args,
        },
      },
    };

    try {
      const response = await this.fetchWithTimeout(MCP_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
          'mcp-session-id': sessionId,
        },
        body: JSON.stringify(payload),
      }, 6000);

      if (!response.ok) {
        const bodyText = await response.text();
        throw new Error(`Tool ${toolName} call failed: HTTP ${response.status} - ${bodyText}`);
      }

      const rawText = await response.text();

      // Write raw debug logs locally
      try {
        fs.writeFileSync('d:\\kapruka-ai\\mcp-debug-log.json', JSON.stringify({
          tool: toolName,
          arguments: args,
          rawResponse: rawText
        }, null, 2));
      } catch {}

      const json = this.parseStreamResponse(rawText);

      if (json.error) {
        throw new Error(`MCP Server Error: [${json.error.code}] ${json.error.message}`);
      }

      const content = json.result?.content;
      if (!content || !Array.isArray(content) || content.length === 0) {
        throw new Error(`Empty content returned by tool ${toolName}`);
      }

      return content[0].text || '';
    } catch (err) {
      console.error(`[MCP] Error invoking tool ${toolName}:`, err);
      // Reset session ID to force a fresh connection on retry
      this.sessionId = null;
      throw err;
    }
  }

  /* =========================================
     MARKDOWN TO STRUCTURED DATA PARSERS
     ========================================= */

  /**
   * Parses the search results markdown table/list into structured JSON products.
   */
  private parseProducts(markdown: string): any[] {
    const products: any[] = [];
    const lines = markdown.split('\n');
    let current: any = null;

    for (const line of lines) {
      const trimmed = line.trim();

      // 1. Matches product header: **1. Product Name** or **2. Chocolate Cake**
      const nameMatch = trimmed.match(/^\*\*\d+\.\s*(.*?)\*\*$/);
      if (nameMatch) {
        if (current) products.push(current);
        current = {
          id: '',
          name: nameMatch[1].trim(),
          price: 0,
          in_stock: true,
          url: '',
          category: 'Gift',
          image: '',
        };
        continue;
      }

      if (current) {
        // 2. Matches ID, price, and stock info line:
        // ID: `FLOWERS00T2075` · LKR 5,210 · In stock (low) · ships...
        if (trimmed.startsWith('ID:')) {
          const idMatch = trimmed.match(/ID:\s*`(.*?)`/);
          if (idMatch) current.id = idMatch[1].trim();

          const priceMatch = trimmed.match(/\b(?:LKR|Rs\.?|USD)[^\d]*([\d,]+)/i);
          if (priceMatch) {
            current.price = Number(priceMatch[1].replace(/,/g, ''));
          }

          const stockLower = trimmed.toLowerCase();
          current.in_stock = !stockLower.includes('out of stock') && !stockLower.includes('unavailable');
          continue;
        }

        // 3. Matches product links: [View product](https://...)
        if (trimmed.startsWith('[View product]')) {
          const urlMatch = trimmed.match(/\[View product\]\((.*?)\)/);
          if (urlMatch) current.url = urlMatch[1].trim();
        }
      }
    }

    if (current) products.push(current);
    
    // Auto-inject generic high-res catalog images based on keywords to match UI aesthetics
    return products.map((p) => {
      const nameLower = p.name.toLowerCase();
      let image = 'https://images.unsplash.com/photo-1549007994-cb92ca87df46?w=500&auto=format&fit=crop&q=60'; // generic chocolate

      if (nameLower.includes('rose') || nameLower.includes('flower')) {
        image = 'https://images.unsplash.com/photo-1561181286-d3fee7d55364?w=500&auto=format&fit=crop&q=60';
        p.category = 'Flowers';
      } else if (nameLower.includes('cake') || nameLower.includes('gateau')) {
        image = 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=500&auto=format&fit=crop&q=60';
        p.category = 'Cakes';
      } else if (nameLower.includes('card')) {
        image = 'https://images.unsplash.com/photo-1513201099705-a9746e1e201f?w=500&auto=format&fit=crop&q=60';
        p.category = 'Cards';
      } else if (nameLower.includes('teddy') || nameLower.includes('bear') || nameLower.includes('toy')) {
        image = 'https://images.unsplash.com/photo-1559251606-c623743a6d76?w=500&auto=format&fit=crop&q=60';
        p.category = 'Toys';
      }

      return { ...p, image };
    });
  }

  /**
   * Parses the delivery cities list markdown bullet points.
   */
  private parseCities(markdown: string): any[] {
    const cities: any[] = [];
    const lines = markdown.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      const match = trimmed.match(/^-\s*\*\*(.*?)\*\*/);
      if (match) {
        cities.push({
          name: match[1].trim(),
        });
      }
    }
    return cities;
  }

  private parseDeliveryViability(markdown: string): any {
    const textLower = markdown.toLowerCase();
    
    // Evaluate deliverability by looking at the status header/lines to prevent false positives from disclaimers at the bottom
    const headerText = markdown.split('\n').slice(0, 3).join('\n').toLowerCase();
    let deliverable = true;
    if (
      headerText.includes('not available') ||
      headerText.includes('not deliverable') ||
      headerText.includes('unavailable') ||
      headerText.includes('cannot')
    ) {
      deliverable = false;
    } else if (headerText.includes('available')) {
      deliverable = true;
    } else {
      deliverable = !headerText.includes('fail') && !headerText.includes('error');
    }
    
    let delivery_charge = 350; // default flat LKR rate
    const chargeMatch = markdown.match(/\b(?:LKR|Rs\.?)[^\d]*([\d,]+)/i);
    if (chargeMatch) {
      delivery_charge = Number(chargeMatch[1].replace(/,/g, ''));
    }

    const perishable_warning = textLower.includes('perishable') || textLower.includes('sensitive') || textLower.includes('warning');

    return {
      deliverable,
      delivery_charge,
      perishable_warning,
    };
  }


  /**
   * Parses the checkout URL creation text.
   */
  private parseCheckoutDetails(markdown: string): any {
    const textLower = markdown.toLowerCase();
    
    // Check if the response contains an error message
    if (textLower.includes('error') || textLower.includes('fail')) {
      throw new Error(markdown.replace(/##/g, '').replace(/\*/g, '').trim());
    }

    // Extract url links
    const urlMatch = markdown.match(/https?:\/\/[^\s)\]]+/);
    if (!urlMatch) {
      throw new Error('Could not find secure checkout link in response');
    }
    const checkout_url = urlMatch[0];

    const idMatch = markdown.match(/(?:Order ID|ID):\s*`?([A-Z0-9-]+)`?/i);
    const order_id = idMatch ? idMatch[1] : `KAP-${Math.floor(100000 + Math.random() * 900000)}`;

    let amount = 0;
    const amountMatch = markdown.match(/\b(?:LKR|Rs\.?)[^\d]*([\d,]+)/i);
    if (amountMatch) {
      amount = Number(amountMatch[1].replace(/,/g, ''));
    }

    const expires_at = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    return {
      order_id,
      checkout_url,
      amount,
      expires_at,
    };
  }


  /* =========================================
     TOOL MAPPINGS
     ========================================= */

  public async searchProducts(args: {
    q: string;
    category?: string;
    min_price?: number;
    max_price?: number;
    in_stock_only?: boolean;
    sort?: string;
    limit?: number;
    cursor?: string;
    currency?: string;
  }) {
    const raw = await this.callTool('kapruka_search_products', args);
    const products = this.parseProducts(raw);
    return { products };
  }

  public async getProduct(productId: string | number, currency?: string) {
    const raw = await this.callTool('kapruka_get_product', { product_id: productId, currency });
    
    // Parse single product price and fields
    const nameMatch = raw.match(/\*\*(.*?)\*\*/);
    const priceMatch = raw.match(/\b(?:LKR|Rs\.?|USD)[^\d]*([\d,]+)/i);
    
    return {
      product_id: productId,
      name: nameMatch ? nameMatch[1] : 'Product details',
      price: priceMatch ? Number(priceMatch[1].replace(/,/g, '')) : 0,
      currency: currency || 'LKR',
      in_stock: !raw.toLowerCase().includes('out of stock'),
    };
  }

  public async listCategories(depth?: number) {
    const raw = await this.callTool('kapruka_list_categories', { depth });
    return { categories: raw };
  }

  public async listDeliveryCities(query: string, limit?: number) {
    const raw = await this.callTool('kapruka_list_delivery_cities', { query, limit });
    const cities = this.parseCities(raw);
    return { cities };
  }

  public async checkDelivery(city: string, deliveryDate: string, productId: string | number) {
    const raw = await this.callTool('kapruka_check_delivery', {
      city,
      delivery_date: deliveryDate,
      product_id: productId,
    });
    return this.parseDeliveryViability(raw);
  }

  public async createOrder(args: any) {
    const raw = await this.callTool('kapruka_create_order', args);
    return this.parseCheckoutDetails(raw);
  }

  public async trackOrder(orderNumber: string) {
    const raw = await this.callTool('kapruka_track_order', { order_number: orderNumber });
    return this.parseTrackingDetails(raw, orderNumber);
  }

  private parseTrackingDetails(markdown: string, orderNumber: string) {
    let status = 'Processing';
    
    // Parse header: ## Order `VPAY827982BA` — Delivered
    const headerMatch = markdown.match(/##\s*Order\s*`?([A-Z0-9-]+)`?\s*—\s*(.*)/i);
    if (headerMatch) {
      status = headerMatch[2].trim();
    }

    // Parse metadata
    let orderedDate = null;
    let deliveryDate = null;
    const orderedMatch = markdown.match(/Ordered\s*\|\s*(.*?)\s*\|/i);
    if (orderedMatch) orderedDate = orderedMatch[1].trim();
    const deliveryDateMatch = markdown.match(/Delivery date\s*\|\s*(.*?)\s*\|/i);
    if (deliveryDateMatch) deliveryDate = deliveryDateMatch[1].trim();

    // Parse recipient & address
    let recipientName = null;
    let deliveryAddress = null;
    const deliveringToMatch = markdown.match(/\*\*Delivering to\*\*\s*\n((?:-\s*.*\n?)+)/i);
    if (deliveringToMatch) {
      const bullets = deliveringToMatch[1]
        .split('\n')
        .map(line => line.replace(/^-\s*/, '').trim())
        .filter(Boolean);
      if (bullets.length > 0) {
        recipientName = bullets[0];
        deliveryAddress = bullets.slice(1).join(', ').replace(/<br\s*\/?>?/gi, '').trim();
      }
    }

    // Parse Notes
    let notes = null;
    const notesMatch = markdown.match(/\*\*Notes:\*\*\s*(.*)/i);
    if (notesMatch) notes = notesMatch[1].trim();

    // Parse progress steps
    const steps: Array<{ date: string; description: string }> = [];
    const progressBlock = markdown.match(/\*\*Progress\*\*([\s\S]*?)(?:_live|$)/i);
    if (progressBlock) {
      const stepLines = progressBlock[1].split('\n');
      for (const line of stepLines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('-')) {
          // JUN 23, 2026 4:40 PM — Order Confirmed and Awaiting preparation
          const match = trimmed.substring(1).match(/^(.*?)\s+(?:—|-)\s+(.*)$/);
          if (match) {
            steps.push({
              date: match[1].trim(),
              description: match[2].trim()
            });
          }
        }
      }
    }

    return {
      order_id: orderNumber,
      status,
      ordered_date: orderedDate,
      delivery_date: deliveryDate,
      recipient_name: recipientName,
      delivery_address: deliveryAddress,
      notes,
      steps,
      raw_markdown: markdown
    };
  }
}

export const mcpClient = new KaprukaMcpClient();
