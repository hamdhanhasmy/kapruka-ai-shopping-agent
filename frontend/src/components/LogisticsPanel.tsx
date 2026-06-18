'use client';

import React from 'react';
import { MapPin, AlertTriangle, Calendar, CheckCircle2, Thermometer, User, Phone, Home } from 'lucide-react';

interface LogisticsPanelProps {
  city?: string;
  deliveryDate?: string;
  deliveryCharge?: number;
  isDeliverable: boolean;
  perishableWarning: boolean;
  perishableItems: string[];
  recipientName: string;
  setRecipientName: (val: string) => void;
  recipientPhone: string;
  setRecipientPhone: (val: string) => void;
  deliveryAddress: string;
  setDeliveryAddress: (val: string) => void;
  senderName: string;
  setSenderName: (val: string) => void;
  isSelfShopping: boolean;
  setIsSelfShopping: (val: boolean) => void;
}

export default function LogisticsPanel({
  city,
  deliveryDate,
  deliveryCharge,
  isDeliverable,
  perishableWarning,
  perishableItems = [],
  recipientName,
  setRecipientName,
  recipientPhone,
  setRecipientPhone,
  deliveryAddress,
  setDeliveryAddress,
  senderName,
  setSenderName,
  isSelfShopping,
  setIsSelfShopping,
}: LogisticsPanelProps) {
  if (!city) {
    return (
      <div className="border border-muted-stone bg-alabaster-card p-5 rounded-lg mb-6 shadow-sm">
        <h3 className="font-serif text-lg font-bold text-kapruka-purple mb-2">Logistics & Delivery</h3>
        <div className="flex items-center gap-2 text-gray-500 text-xs font-semibold uppercase tracking-wider">
          <MapPin className="w-4 h-4 text-muted-stone animate-bounce" />
          No delivery parameters set yet.
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Specify a location (e.g. Colombo 03) and date in your conversation to run a logistics check.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-muted-stone bg-alabaster-card p-5 rounded-lg mb-6 shadow-sm">
      <div className="flex items-center justify-between border-b border-muted-stone pb-3 mb-4">
        <h3 className="font-serif text-lg font-bold text-kapruka-purple">Logistics & Delivery</h3>
        {isDeliverable ? (
          <span className="flex items-center gap-1 text-xs font-bold text-green-700 bg-green-50 py-1 px-2.5 rounded-full border border-green-200">
            <CheckCircle2 className="w-3.5 h-3.5" /> Deliverable
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs font-bold text-red-700 bg-red-50 py-1 px-2.5 rounded-full border border-red-200">
            <AlertTriangle className="w-3.5 h-3.5" /> Unavailable
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
        {/* Destination Location */}
        <div className="flex items-start gap-2.5 bg-luxury-ivory p-3 rounded-md border border-muted-stone/60">
          <MapPin className="w-4 h-4 text-kapruka-purple mt-0.5" />
          <div>
            <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide block">Delivery City</span>
            <span className="font-bold text-iris-black">{city}</span>
          </div>
        </div>

        {/* Target Delivery Date */}
        {deliveryDate && (
          <div className="flex items-start gap-2.5 bg-luxury-ivory p-3 rounded-md border border-muted-stone/60">
            <Calendar className="w-4 h-4 text-kapruka-purple mt-0.5" />
            <div>
              <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide block">Delivery Date</span>
              <span className="font-bold text-iris-black">{deliveryDate}</span>
            </div>
          </div>
        )}
      </div>

      {/* Shipping Contact Form Panel */}
      <div className="mt-4 border-t border-muted-stone/80 pt-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
          <h4 className="text-xs font-serif font-bold uppercase tracking-wider text-kapruka-purple flex items-center gap-1.5">
            Shipping & Contact Details
          </h4>
          <div className="flex items-center gap-2">
            <input
              id="selfShoppingCheckbox"
              type="checkbox"
              checked={isSelfShopping}
              onChange={(e) => {
                const checked = e.target.checked;
                setIsSelfShopping(checked);
                if (checked) {
                  setSenderName(recipientName || 'Guest Customer');
                }
              }}
              className="w-3.5 h-3.5 text-kapruka-purple border-muted-stone rounded focus:ring-kapruka-purple"
            />
            <label htmlFor="selfShoppingCheckbox" className="text-[10px] font-bold text-gray-500 uppercase tracking-wider cursor-pointer select-none">
              Ordering for myself (Self-Shopping Mode)
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block mb-1">Contact Name</label>
            <input
              type="text"
              value={recipientName}
              onChange={(e) => {
                const val = e.target.value;
                setRecipientName(val);
                if (isSelfShopping) {
                  setSenderName(val);
                }
              }}
              className="w-full p-2 bg-luxury-ivory border border-muted-stone/80 rounded text-xs font-semibold text-iris-black focus:outline-none focus:border-kapruka-purple/50 transition-colors duration-200"
              placeholder="e.g. Jane Doe"
            />
          </div>
          <div>
            <label className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block mb-1">Contact Phone Number</label>
            <input
              type="text"
              value={recipientPhone}
              onChange={(e) => setRecipientPhone(e.target.value)}
              className="w-full p-2 bg-luxury-ivory border border-muted-stone/80 rounded text-xs font-semibold text-iris-black focus:outline-none focus:border-kapruka-purple/50 transition-colors duration-200"
              placeholder="e.g. +94771234567"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block mb-1">Shipping Address</label>
            <input
              type="text"
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              className="w-full p-2 bg-luxury-ivory border border-muted-stone/80 rounded text-xs font-semibold text-iris-black focus:outline-none focus:border-kapruka-purple/50 transition-colors duration-200"
              placeholder="e.g. 12/A Temple Road, Kandy"
            />
          </div>
          {!isSelfShopping && (
            <div>
              <label className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block mb-1">Sender Name (Gifting Mode)</label>
              <input
                type="text"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                className="w-full p-2 bg-luxury-ivory border border-muted-stone/80 rounded text-xs font-semibold text-iris-black focus:outline-none focus:border-kapruka-purple/50 transition-colors duration-200"
                placeholder="e.g. John Doe"
              />
            </div>
          )}
        </div>
      </div>

      {/* Perishable Warning Banner */}
      {perishableWarning && (
        <div className="flex gap-3 bg-amber-50 border border-amber-200 p-4 rounded-md my-4 text-amber-900">
          <Thermometer className="w-6 h-6 text-amber-600 flex-shrink-0 animate-pulse" />
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800">
              Perishable Cargo Warning
            </h4>
            <p className="text-xs mt-1 font-medium leading-relaxed">
              Your gift hamper contains sensitive products (e.g.,{' '}
              <span className="font-bold text-amber-950">
                {perishableItems.length > 0 ? perishableItems.join(', ') : 'fresh cakes/flowers'}
              </span>
              ) that require rapid delivery. Ensure a correct date and direct delivery location.
            </p>
          </div>
        </div>
      )}

      {/* Rates details */}
      {isDeliverable && deliveryCharge !== undefined && (
        <div className="flex justify-between items-center bg-gray-50 border border-muted-stone p-3 rounded-md text-xs font-semibold text-iris-black mt-4">
          <span className="text-gray-500">Delivery Charge</span>
          <span className="text-sm font-bold text-kapruka-purple">
            Rs. {deliveryCharge.toLocaleString()} LKR
          </span>
        </div>
      )}
    </div>
  );
}
