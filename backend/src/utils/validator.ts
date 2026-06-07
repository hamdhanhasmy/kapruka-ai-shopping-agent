import { z } from 'zod';

// Schema for Product Search
export const SearchProductsSchema = z.object({
  q: z.string({ required_error: 'Query parameter "q" is required' }),
  category: z.string().optional(),
  min_price: z.number().optional(),
  max_price: z.number().optional(),
  in_stock_only: z.boolean().optional(),
  sort: z.string().optional(),
  limit: z.number().optional(),
  cursor: z.string().optional(),
  currency: z.string().optional(),
});

// Schema for Get Product Details
export const GetProductSchema = z.object({
  product_id: z.union([z.string(), z.number()], {
    required_error: 'Parameter "product_id" is required (string or number)',
  }),
  currency: z.string().optional(),
});

// Schema for List Categories
export const ListCategoriesSchema = z.object({
  depth: z.number().optional(),
});

// Schema for List Delivery Cities
export const ListDeliveryCitiesSchema = z.object({
  query: z.string({ required_error: 'Query parameter "query" is required' }),
  limit: z.number().optional(),
});

// Schema for Check Delivery Viability
export const CheckDeliverySchema = z.object({
  city: z.string({ required_error: 'City name is required' }),
  delivery_date: z.string({ required_error: 'Delivery date is required' }).regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Delivery date must be in YYYY-MM-DD format',
  }),
  product_id: z.union([z.string(), z.number()], {
    required_error: 'Parameter "product_id" is required (string or number)',
  }),
});

// Schema for Cart Item inside Order
const CartItemSchema = z.object({
  product_id: z.union([z.string(), z.number()]),
  quantity: z.number().int().positive(),
});

// Schema for Create Order (Aligned with Kapruka server)
export const CreateOrderSchema = z.object({
  cart: z.array(CartItemSchema).nonempty({ message: 'Cart must contain at least one item' }),
  recipient: z.object({
    name: z.string({ required_error: 'Recipient name is required' }),
    phone: z.string({ required_error: 'Recipient phone is required' }),
  }),
  delivery: z.object({
    city: z.string({ required_error: 'Delivery city is required' }),
    address: z.string({ required_error: 'Delivery address is required' }),
    date: z.string({ required_error: 'Delivery date is required' }).regex(/^\d{4}-\d{2}-\d{2}$/, {
      message: 'Delivery date must be in YYYY-MM-DD format',
    }),
    delivery_charge: z.number().optional(),
  }),
  sender: z.object({
    name: z.string({ required_error: 'Sender name is required' }),
  }),
  gift_message: z.string().optional(),
  currency: z.string().optional(),
});

// Schema for Track Order
export const TrackOrderSchema = z.object({
  order_number: z.string({ required_error: 'Order number is required' }),
});
