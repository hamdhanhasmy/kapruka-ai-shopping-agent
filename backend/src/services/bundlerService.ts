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
  public async compileBundle(intent: ParsedIntent, cartItems: any[] = []): Promise<BundleResult> {
    const { items: keywords, target_city, delivery_date, max_budget } = intent;

    console.log(`Compiling bundle for keywords: [${keywords.join(', ')}], City: ${target_city}, Date: ${delivery_date}, Budget: ${max_budget}`);
    console.log(`Current cart items:`, JSON.stringify(cartItems));

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

        const result = await mcpClient.searchProducts({ q: cleanKw, limit: 12 });
        return {
          keyword: kw,
          products: result?.products || [],
        };
      } catch (err) {
        console.error(`Search failed for keyword "${kw}":`, err);
        return { keyword: kw, products: [] };
      }
    });

    const searchResults = await Promise.all(searchPromises);

    // 2. Filter products and verify delivery logistics viability
    const newCandidatesPerCategory: Record<string, any[]> = {};
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

    interface ProductToCheck {
      prod: any;
      keyword: string;
      isCartItem: boolean;
    }
    const allCandidates: ProductToCheck[] = [];
    for (const categoryResult of searchResults) {
      const { keyword, products } = categoryResult;
      for (const prod of products) {
        allCandidates.push({ prod, keyword, isCartItem: false });
      }
    }

    // Also check delivery for items currently in the cart
    for (const cartItem of cartItems) {
      allCandidates.push({
        prod: {
          id: cartItem.id || cartItem.product_id,
          product_id: cartItem.id || cartItem.product_id,
          name: cartItem.name,
          price: cartItem.price,
          image: cartItem.image,
          url: cartItem.url
        },
        keyword: '__cart__',
        isCartItem: true
      });
    }

    const checkPromises = allCandidates.map(async ({ prod, keyword, isCartItem }) => {
      let deliverable = true;
      let perishable = false;
      let deliveryCharge = null;

      // Category filter validation:
      // Prevent cross-category matches from search queries (e.g. cakes showing up in flower search)
      const nameLower = (prod.name || '').toLowerCase();
      const idUpper = (prod.id || prod.product_id || '').toUpperCase();
      const cleanKw = keyword.trim().toLowerCase();

      let isMatch = true;
      if (!isCartItem) {
        const isFlowerKeyword = cleanKw.includes('flower') || cleanKw.includes('rose') || cleanKw.includes('bouquet');
        const isCakeKeyword = cleanKw.includes('cake') || cleanKw.includes('gateau');
        const isCardKeyword = cleanKw.includes('card');

        if (isFlowerKeyword) {
          // Exclude cakes, greeting cards, clothes, etc. from flower results
          if (nameLower.includes('cake') || nameLower.includes('gateau') || idUpper.startsWith('CAKE')) {
            isMatch = false;
          }
          if (nameLower.includes('card') || idUpper.startsWith('GREE') || idUpper.startsWith('CUSTOMGIFT')) {
            isMatch = false;
          }
          if (nameLower.includes('dress') || nameLower.includes('kurta') || nameLower.includes('shoes') || nameLower.includes('sandals')) {
            isMatch = false;
          }
          if (
            nameLower.includes('clip') ||
            nameLower.includes('band') ||
            nameLower.includes('headband') ||
            nameLower.includes('perfume') ||
            nameLower.includes('spray') ||
            nameLower.includes('lotion') ||
            nameLower.includes('cream') ||
            nameLower.includes('soap') ||
            nameLower.includes('gel') ||
            nameLower.includes('wash') ||
            nameLower.includes('freshener') ||
            nameLower.includes('cleaner') ||
            nameLower.includes('polish') ||
            nameLower.includes('candle') ||
            nameLower.includes('puzzle') ||
            nameLower.includes('toy') ||
            nameLower.includes('plant')
          ) {
            isMatch = false;
          }
        } else if (isCakeKeyword) {
          // Exclude bouquets, plants, greeting cards from cake results
          if (nameLower.includes('bouquet') || nameLower.includes('rose') || idUpper.startsWith('FLOWERS')) {
            isMatch = false;
          }
          if (nameLower.includes('card') || idUpper.startsWith('GREE') || idUpper.startsWith('CUSTOMGIFT')) {
            isMatch = false;
          }
        } else if (isCardKeyword) {
          // Must contain card or be GREE/CUSTOMGIFT
          if (!nameLower.includes('card') && !idUpper.startsWith('GREE') && !idUpper.startsWith('CUSTOMGIFT')) {
            isMatch = false;
          }
        }
      }

      if (!isMatch) {
        return {
          prod,
          keyword,
          isCartItem,
          deliverable: false,
          perishable: false,
          deliveryCharge: null
        };
      }

      if (targetCityCanonical && delivery_date) {
        try {
          const check = await mcpClient.checkDelivery(targetCityCanonical, delivery_date, prod.product_id || prod.id);
          deliverable = check?.deliverable ?? check?.data?.deliverable ?? true;
          perishable = check?.perishable_warning ?? check?.data?.perishable_warning ?? false;
          if (check?.delivery_charge || check?.data?.delivery_charge) {
            deliveryCharge = check.delivery_charge || check.data.delivery_charge;
          }
        } catch (err: any) {
          console.error(`Logistics check failed for product ${prod.id || prod.product_id}:`, err);
          const nameLower = (prod.name || '').toLowerCase();
          perishable = nameLower.includes('cake') || nameLower.includes('flower') || nameLower.includes('rose');
        }
      } else {
        const nameLower = (prod.name || '').toLowerCase();
        perishable = nameLower.includes('cake') || nameLower.includes('flower') || nameLower.includes('rose');
      }

      return {
        prod,
        keyword,
        isCartItem,
        deliverable,
        perishable,
        deliveryCharge
      };
    });

    const checkResults = await Promise.all(checkPromises);

    let overallDeliverable = true;

    for (const res of checkResults) {
      if (res.isCartItem) {
        if (!res.deliverable) {
          overallDeliverable = false;
        }
        if (res.deliveryCharge) {
          estimatedDeliveryCharge = Math.max(estimatedDeliveryCharge, res.deliveryCharge);
        }
        if (res.perishable) {
          hasPerishableWarning = true;
          if (!perishableItemsList.includes(res.prod.name)) {
            perishableItemsList.push(res.prod.name);
          }
        }
      } else {
        if (!res.deliverable) continue;

        if (res.deliveryCharge) {
          estimatedDeliveryCharge = Math.max(estimatedDeliveryCharge, res.deliveryCharge);
        }

        if (!newCandidatesPerCategory[res.keyword]) {
          newCandidatesPerCategory[res.keyword] = [];
        }

        newCandidatesPerCategory[res.keyword].push({
          id: res.prod.id || res.prod.product_id,
          name: res.prod.name,
          price: Number(res.prod.price),
          image: res.prod.image || res.prod.image_url || (res.prod.images && res.prod.images[0]),
          category: res.keyword,
          perishable: res.perishable,
          url: res.prod.url || res.prod.product_url,
        });
      }
    }

    for (const kw in newCandidatesPerCategory) {
      newCandidatesPerCategory[kw].sort((a, b) => a.price - b.price);
    }

    // 3. Assemble and Optimize Bundle
    const selectedItems: HamperItem[] = [];
    let subtotal = 0;

    // Pick the best product per category.
    for (const kw of keywords) {
      const list = newCandidatesPerCategory[kw];
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
        if (!perishableItemsList.includes(selected.name)) {
          perishableItemsList.push(selected.name);
        }
      }
    }

    const total = subtotal + estimatedDeliveryCharge;
    const budgetExceeded = max_budget ? total > max_budget : false;

    // The bundle/delivery is deliverable if:
    // - All requested keywords returned selected products (meaning they are in stock and deliverable)
    // - All existing cart items are deliverable (overallDeliverable is true)
    // - There is at least one item being purchased (in cart or new recommendations)
    const isDeliverable = (keywords.length === 0 || selectedItems.length === keywords.length) && 
                          overallDeliverable && 
                          (selectedItems.length > 0 || cartItems.length > 0);

    return {
      items: selectedItems,
      subtotal,
      delivery_charge: estimatedDeliveryCharge,
      total,
      city: targetCityCanonical,
      delivery_date: delivery_date,
      is_deliverable: isDeliverable,
      perishable_warning: hasPerishableWarning,
      perishable_items: perishableItemsList,
      budget_exceeded: budgetExceeded,
    };
  }
}

export const bundlerService = new BundlerService();
