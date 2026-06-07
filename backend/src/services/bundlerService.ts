import { mcpClient } from './mcpClient.js';
import { ParsedIntent } from './nlpService.js';

export interface HamperItem {
  id: string | number;
  name: string;
  price: number;
  image?: string;
  category: string;
  perishable: boolean;
  url?: string;
}

export interface BundleResult {
  items: HamperItem[];
  subtotal: number;
  delivery_charge: number;
  total: number;
  city: string | null;
  delivery_date: string | null;
  is_deliverable: boolean;
  perishable_warning: boolean;
  perishable_items: string[];
  budget_exceeded: boolean;
}

export class BundlerService {
  /**
   * Compiles an optimized bundle of products matching the user's intent.
   * Runs parallel searches, runs preemptive logistics checks, and filters by budget.
   */
  public async compileBundle(intent: ParsedIntent): Promise<BundleResult> {
    const { items: keywords, target_city, delivery_date, max_budget } = intent;

    console.log(`Compiling bundle for keywords: [${keywords.join(', ')}], City: ${target_city}, Date: ${delivery_date}, Budget: ${max_budget}`);

    // 1. Parallel search for each keyword type
    const searchPromises = keywords.map(async (kw) => {
      try {
        let cleanKw = kw.trim().toLowerCase();
        if (cleanKw === 'cakes') cleanKw = 'cake';
        else if (cleanKw === 'roses') cleanKw = 'rose';
        else if (cleanKw === 'flowers') cleanKw = 'flower';
        else if (cleanKw === 'cards') cleanKw = 'card';
        else if (cleanKw === 'chocolates') cleanKw = 'chocolate';
        else if (cleanKw === 'sweets') cleanKw = 'sweet';
        else if (cleanKw === 'toys') cleanKw = 'toy';

        const result = await mcpClient.searchProducts({ q: cleanKw, limit: 5 });
        return {
          keyword: kw,
          products: result?.products || result?.data?.products || [],
        };
      } catch (err) {
        console.error(`Search failed for keyword "${kw}":`, err);
        return { keyword: kw, products: [] };
      }
    });

    const searchResults = await Promise.all(searchPromises);

    // 2. Filter products and verify delivery logistics viability
    const candidatesPerCategory: Record<string, any[]> = {};
    let hasPerishableWarning = false;
    const perishableItemsList: string[] = [];
    let estimatedDeliveryCharge = 350; // default flat rate in LKR
    let targetCityCanonical = target_city;

    // Resolve canonical city first if specified
    if (target_city) {
      try {
        // Simple mock resolver or call API
        const citiesList = await mcpClient.listDeliveryCities(target_city, 1);
        if (citiesList?.cities?.length > 0) {
          targetCityCanonical = citiesList.cities[0].name;
        }
      } catch (err) {
        console.error('Failed to resolve city canonical name, using original:', err);
      }
    }

    for (const categoryResult of searchResults) {
      const { keyword, products } = categoryResult;
      const verifiedProducts: any[] = [];

      for (const prod of products) {
        let deliverable = true;
        let perishable = false;

        // Pre-emptive delivery check
        if (targetCityCanonical && delivery_date) {
          try {
            const check = await mcpClient.checkDelivery(targetCityCanonical, delivery_date, prod.product_id || prod.id);
            deliverable = check?.deliverable ?? check?.data?.deliverable ?? true;
            perishable = check?.perishable_warning ?? check?.data?.perishable_warning ?? false;
            
            if (check?.delivery_charge || check?.data?.delivery_charge) {
              estimatedDeliveryCharge = check.delivery_charge || check.data.delivery_charge;
            }
          } catch (err) {
            console.error(`Logistics check failed for product ${prod.id || prod.product_id}:`, err);
            // Fallback: assume deliverable but check if cake/flower for warning
            const nameLower = (prod.name || '').toLowerCase();
            perishable = nameLower.includes('cake') || nameLower.includes('flower') || nameLower.includes('rose');
          }
        } else {
          // If no city, guess perishable warning
          const nameLower = (prod.name || '').toLowerCase();
          perishable = nameLower.includes('cake') || nameLower.includes('flower') || nameLower.includes('rose');
        }

        if (deliverable) {
          verifiedProducts.push({
            id: prod.id || prod.product_id,
            name: prod.name,
            price: Number(prod.price),
            image: prod.image || prod.image_url || (prod.images && prod.images[0]),
            category: keyword,
            perishable,
            url: prod.url || prod.product_url,
          });
        }
      }

      if (verifiedProducts.length > 0) {
        candidatesPerCategory[keyword] = verifiedProducts.sort((a, b) => a.price - b.price); // sort cheap to expensive
      }
    }

    // 3. Assemble and Optimize Bundle
    const selectedItems: HamperItem[] = [];
    let subtotal = 0;

    // Pick the best product per category.
    // If a budget is specified, try to find a combination that stays under the budget limit.
    for (const kw of keywords) {
      const list = candidatesPerCategory[kw];
      if (!list || list.length === 0) continue;

      // Start by choosing the cheapest candidate in this category to stay safe
      let selected = list[0];

      // If we have headroom under the max_budget, we can upgrade to a nicer item
      if (max_budget) {
        const currentTotal = subtotal + list[0].price;
        const budgetRemaining = max_budget - currentTotal;
        
        // Find the best quality product that we can afford with the remaining budget
        const affordable = list.filter((p) => p.price <= (list[0].price + budgetRemaining));
        if (affordable.length > 0) {
          selected = affordable[affordable.length - 1]; // Pick the premium affordable item
        }
      }

      selectedItems.push(selected);
      subtotal += selected.price;

      if (selected.perishable) {
        hasPerishableWarning = true;
        perishableItemsList.push(selected.name);
      }
    }

    const total = subtotal + estimatedDeliveryCharge;
    const budgetExceeded = max_budget ? total > max_budget : false;

    return {
      items: selectedItems,
      subtotal,
      delivery_charge: estimatedDeliveryCharge,
      total,
      city: targetCityCanonical,
      delivery_date: delivery_date,
      is_deliverable: selectedItems.length > 0,
      perishable_warning: hasPerishableWarning,
      perishable_items: perishableItemsList,
      budget_exceeded: budgetExceeded,
    };
  }
}

export const bundlerService = new BundlerService();
