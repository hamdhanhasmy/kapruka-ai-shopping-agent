'use client';

import React from 'react';
import { Gift, PackageOpen, Trash2 } from 'lucide-react';

interface CartItem {
  id: string | number;
  name: string;
  price: number;
  quantity: number;
  image?: string;
}

interface GiftBoxBuilderProps {
  items: CartItem[];
  onRemoveItem: (id: string | number) => void;
  onClear: () => void;
}

export default function GiftBoxBuilder({ items, onRemoveItem, onClear }: GiftBoxBuilderProps) {
  const total = items.reduce((acc, item) => acc + item.price * item.quantity, 0);

  return (
    <div className="border border-muted-stone bg-alabaster-card p-6 rounded-lg mb-6 shadow-sm">
      <div className="flex items-center justify-between border-b border-muted-stone pb-4 mb-4">
        <div className="flex items-center gap-3">
          <Gift className="text-kapruka-purple w-6 h-6" />
          <h2 className="font-serif text-2xl font-bold text-kapruka-purple tracking-tight">
            Curated Hamper Builder
          </h2>
        </div>
        {items.length > 0 && (
          <button
            onClick={onClear}
            className="text-xs text-red-600 hover:underline flex items-center gap-1 font-semibold"
          >
            <Trash2 className="w-3.5 h-3.5" /> Reset Hamper
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center text-gray-500 border-2 border-dashed border-muted-stone rounded-md bg-luxury-ivory/50">
          <PackageOpen className="w-10 h-10 text-muted-stone mb-2" />
          <p className="font-sans text-sm font-medium">Your active gift box is empty.</p>
          <p className="text-xs text-gray-400 mt-1">Tell the concierge to search or add items to curate your gift.</p>
        </div>
      ) : (
        <div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="relative group bg-luxury-ivory p-3 border border-muted-stone rounded-md flex flex-col justify-between hover:shadow-md transition-all duration-200"
              >
                {/* Remove item button */}
                <button
                  onClick={() => onRemoveItem(item.id)}
                  className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 shadow-sm"
                  title="Remove from hamper"
                >
                  <Trash2 className="w-3 h-3" />
                </button>

                <div className="w-full h-16 bg-white rounded overflow-hidden mb-2 relative">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted-stone/20 text-kapruka-purple/55 font-bold text-xs">
                      Kapruka Gift
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-iris-black truncate" title={item.name}>
                    {item.name}
                  </h4>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-gray-500 font-medium">Qty: {item.quantity}</span>
                    <span className="text-xs font-bold text-kapruka-purple">
                      Rs. {(item.price * item.quantity).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center bg-luxury-ivory p-4 border border-muted-stone rounded-md">
            <div>
              <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Estimated Total</span>
              <p className="text-xl font-bold text-kapruka-purple font-serif">Rs. {total.toLocaleString()} LKR</p>
            </div>
            <div className="bg-kapruka-purple text-white py-1.5 px-3 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-kapruka-gold animate-pulse"></span>
              {items.length} {items.length === 1 ? 'Item' : 'Items'} Ready
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
