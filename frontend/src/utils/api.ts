const NEXT_PUBLIC_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';
const API_BASE_URL = `${NEXT_PUBLIC_API_BASE_URL}/api/mcp`;

export interface ChatResponse {
  intent: {
    items: string[];
    target_city: string | null;
    delivery_date: string | null;
    max_budget: number | null;
    gift_message: string | null;
    recipient_relation: string | null;
  };
  bundle: {
    items: Array<{
      id: string | number;
      name: string;
      price: number;
      image?: string;
      category: string;
      perishable: boolean;
      url?: string;
    }>;
    subtotal: number;
    delivery_charge: number;
    total: number;
    city: string | null;
    delivery_date: string | null;
    is_deliverable: boolean;
    perishable_warning: boolean;
    perishable_items: string[];
    budget_exceeded: boolean;
  };
  reply: string;
}


export interface CreateOrderResponse {
  order_id: string;
  checkout_url: string;
  expires_at: string; // ISO string
  amount: number;
  currency: string;
}

export interface ChatHistoryItem {
  sender: 'user' | 'assistant';
  text: string;
}

export async function sendMessageToConcierge(text: string, history: ChatHistoryItem[] = []): Promise<ChatResponse> {
  const response = await fetch(`${API_BASE_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text, history }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `HTTP error! status: ${response.status}`);
  }

  const json = await response.json();
  return json.data;
}

export async function createCheckoutOrder(payload: {
  cart: Array<{ product_id: string | number; quantity: number }>;
  recipient: { name: string; phone: string; address: string; email?: string };
  delivery: { city: string; delivery_date: string; delivery_charge?: number };
  sender: { name: string; phone: string; email: string };
  gift_message?: string;
  currency?: string;
}): Promise<CreateOrderResponse> {
  const response = await fetch(`${API_BASE_URL}/create-order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `HTTP error! status: ${response.status}`);
  }

  const json = await response.json();
  return json.data;
}

export async function checkDeliveryViability(city: string, deliveryDate: string, productId: string | number) {
  const response = await fetch(`${API_BASE_URL}/check-delivery`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ city, delivery_date: deliveryDate, product_id: productId }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `HTTP error! status: ${response.status}`);
  }

  const json = await response.json();
  return json.data;
}

export async function searchCatalog(query: string) {
  const response = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(query)}`);

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `HTTP error! status: ${response.status}`);
  }

  const json = await response.json();
  return json.data;
}
