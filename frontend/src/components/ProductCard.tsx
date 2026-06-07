'use client';

import React from 'react';
import { ExternalLink, Plus } from 'lucide-react';

export interface Product {
  id: string | number;
  name: string;
  price: number;
  image?: string;
  category?: string;
  in_stock: boolean;
  url?: string;
}

interface ProductCardProps {
  product: Product;
  onAddToHamper: (product: Product) => void;
}

export default function ProductCard({ product, onAddToHamper }: ProductCardProps) {
  return (
    <div className="group border border-muted-stone bg-alabaster-card rounded-lg overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow duration-200">
      {/* Product Image Wrapper */}
      <div className="w-full h-48 bg-white relative border-b border-muted-stone flex items-center justify-center p-4">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-luxury-ivory text-gray-400">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-stone">No Image</span>
          </div>
        )}
        {!product.in_stock && (
          <div className="absolute top-2 right-2 bg-red-600 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded shadow-sm">
            Out of Stock
          </div>
        )}
        {product.category && (
          <div className="absolute top-2 left-2 bg-kapruka-purple/10 text-kapruka-purple text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">
            {product.category}
          </div>
        )}
      </div>

      {/* Product Information */}
      <div className="p-4 flex flex-col flex-grow justify-between">
        <div>
          <h3 className="font-serif text-lg font-bold text-iris-black line-clamp-2 min-h-[3rem] mb-2 leading-tight">
            {product.name}
          </h3>
          <div className="flex items-baseline gap-1.5 mb-4">
            <span className="text-xl font-extrabold text-kapruka-purple font-serif">
              Rs. {product.price.toLocaleString()}
            </span>
            <span className="text-[10px] text-gray-500 font-semibold uppercase">LKR</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Add to Hamper button */}
          <button
            onClick={() => onAddToHamper(product)}
            disabled={!product.in_stock}
            className="flex-grow bg-kapruka-purple hover:bg-kapruka-gold hover:text-kapruka-purple text-white disabled:bg-gray-200 disabled:text-gray-400 font-sans text-xs font-bold py-2.5 px-4 rounded-full flex items-center justify-center gap-1.5 transition-colors duration-300 shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add to Hamper
          </button>

          {/* Secure Fallback Link to original Kapruka portal */}
          {product.url && (
            <a
              href={product.url}
              target="_blank"
              rel="noopener noreferrer"
              className="border border-muted-stone hover:bg-luxury-ivory text-iris-black p-2.5 rounded-full transition-colors duration-300"
              title="View on Kapruka"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
