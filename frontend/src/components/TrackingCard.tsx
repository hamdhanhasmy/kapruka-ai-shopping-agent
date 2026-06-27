'use client';

import React from 'react';
import { 
  CheckCircle2, 
  Clock, 
  Truck, 
  PackageCheck, 
  X, 
  Calendar, 
  MapPin, 
  User, 
  FileText 
} from 'lucide-react';

interface TrackingStep {
  date: string;
  description: string;
}

interface TrackingCardProps {
  trackingData: {
    order_id: string;
    status: string;
    ordered_date: string | null;
    delivery_date: string | null;
    recipient_name: string | null;
    delivery_address: string | null;
    notes: string | null;
    steps: TrackingStep[];
    raw_markdown: string;
  };
  onClose: () => void;
}

export default function TrackingCard({ trackingData, onClose }: TrackingCardProps) {
  const {
    order_id,
    status,
    ordered_date,
    delivery_date,
    recipient_name,
    delivery_address,
    notes,
    steps = []
  } = trackingData;

  const statusLower = status.toLowerCase();
  
  // Logic to determine active stages
  const isConfirmed = true;
  
  const isPrepared = 
    statusLower === 'delivered' || 
    statusLower === 'out for delivery' || 
    statusLower === 'shipped' ||
    steps.some(s => {
      const desc = s.description.toLowerCase();
      return desc.includes('prepared') || desc.includes('preparing done') || desc.includes('ready');
    });

  const isDispatched = 
    statusLower === 'delivered' || 
    statusLower === 'out for delivery' ||
    statusLower === 'shipped' ||
    steps.some(s => {
      const desc = s.description.toLowerCase();
      return desc.includes('out for delivery') || desc.includes('shipped') || desc.includes('dispatched');
    });

  const isDelivered = statusLower === 'delivered';

  return (
    <div className="border border-muted-stone bg-alabaster-card p-6 rounded-lg shadow-sm mb-6 relative">
      {/* Dismiss Button */}
      <button 
        onClick={onClose}
        className="absolute top-4 right-4 text-gray-400 hover:text-kapruka-purple transition-all"
        title="Close tracking details"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Header */}
      <div className="mb-6">
        <span className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wider block">
          Order Tracking
        </span>
        <h3 className="font-serif text-xl font-bold text-kapruka-purple flex items-center gap-2 mt-0.5">
          Order #{order_id}
          <span className={`font-sans text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
            isDelivered 
              ? 'bg-green-100 text-green-700' 
              : statusLower.includes('out') 
                ? 'bg-blue-100 text-blue-700' 
                : 'bg-kapruka-gold/20 text-kapruka-purple'
          }`}>
            {status}
          </span>
        </h3>
      </div>

      {/* Stepper Progress Bar */}
      <div className="mb-8 px-2">
        <div className="flex items-center justify-between relative">
          {/* Progress Connecting Lines */}
          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 bg-muted-stone/20 -z-1" />
          <div 
            className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-kapruka-purple transition-all duration-500 -z-1" 
            style={{ 
              width: isDelivered 
                ? '100%' 
                : isDispatched 
                  ? '66%' 
                  : isPrepared 
                    ? '33%' 
                    : '0%' 
            }}
          />

          {/* Step 1: Confirmed */}
          <div className="flex flex-col items-center bg-alabaster-card px-2 relative z-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
              isConfirmed 
                ? 'border-kapruka-purple bg-kapruka-purple text-white' 
                : 'border-muted-stone/40 bg-white text-gray-400'
            }`}>
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <span className="text-[9px] uppercase tracking-wider font-extrabold mt-1 text-gray-600">Confirmed</span>
          </div>

          {/* Step 2: Prepared */}
          <div className="flex flex-col items-center bg-alabaster-card px-2 relative z-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
              isPrepared 
                ? 'border-kapruka-purple bg-kapruka-purple text-white' 
                : 'border-muted-stone/40 bg-white text-gray-400'
            }`}>
              <Clock className="w-4 h-4" />
            </div>
            <span className="text-[9px] uppercase tracking-wider font-extrabold mt-1 text-gray-600">Preparing</span>
          </div>

          {/* Step 3: Out for Delivery */}
          <div className="flex flex-col items-center bg-alabaster-card px-2 relative z-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
              isDispatched 
                ? 'border-kapruka-purple bg-kapruka-purple text-white' 
                : 'border-muted-stone/40 bg-white text-gray-400'
            }`}>
              <Truck className="w-4 h-4" />
            </div>
            <span className="text-[9px] uppercase tracking-wider font-extrabold mt-1 text-gray-600">Dispatched</span>
          </div>

          {/* Step 4: Delivered */}
          <div className="flex flex-col items-center bg-alabaster-card px-2 relative z-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
              isDelivered 
                ? 'border-kapruka-purple bg-kapruka-purple text-white' 
                : 'border-muted-stone/40 bg-white text-gray-400'
            }`}>
              <PackageCheck className="w-4 h-4" />
            </div>
            <span className="text-[9px] uppercase tracking-wider font-extrabold mt-1 text-gray-600">Delivered</span>
          </div>
        </div>
      </div>

      {/* Grid: Details & Timeline */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-muted-stone/45">
        {/* Recipient / Shipping Info */}
        <div className="space-y-4">
          <h4 className="font-serif text-sm font-bold text-kapruka-purple uppercase tracking-wider">
            Logistics Information
          </h4>
          
          <div className="space-y-2.5 text-xs text-iris-black">
            {ordered_date && (
              <div className="flex items-start gap-2">
                <Calendar className="w-4 h-4 text-gray-400 mt-0.5" />
                <div>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">Date Ordered</span>
                  <span className="font-semibold">{ordered_date}</span>
                </div>
              </div>
            )}

            {delivery_date && (
              <div className="flex items-start gap-2">
                <Calendar className="w-4 h-4 text-gray-400 mt-0.5" />
                <div>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">Delivery Date</span>
                  <span className="font-semibold">{delivery_date}</span>
                </div>
              </div>
            )}

            {recipient_name && (
              <div className="flex items-start gap-2">
                <User className="w-4 h-4 text-gray-400 mt-0.5" />
                <div>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">Delivering To</span>
                  <span className="font-semibold uppercase">{recipient_name}</span>
                </div>
              </div>
            )}

            {delivery_address && (
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                <div>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">Shipping Address</span>
                  <span className="text-gray-600 block">{delivery_address}</span>
                </div>
              </div>
            )}

            {notes && (
              <div className="flex items-start gap-2 bg-kapruka-gold/10 p-2.5 rounded border border-kapruka-gold/20">
                <FileText className="w-4 h-4 text-kapruka-purple mt-0.5" />
                <div>
                  <span className="text-[10px] text-kapruka-purple uppercase tracking-wider block font-extrabold">Delivery Notes</span>
                  <span className="italic font-medium text-kapruka-purple/90">{notes}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Timeline Log */}
        <div>
          <h4 className="font-serif text-sm font-bold text-kapruka-purple uppercase tracking-wider mb-4">
            Status Logs
          </h4>
          
          <div className="relative pl-4 space-y-4 text-xs font-sans">
            {/* Vertical timeline connector */}
            <div className="absolute left-[3px] top-1 bottom-1 w-0.5 bg-muted-stone/20" />
            
            {steps.map((step, idx) => (
              <div key={idx} className="relative">
                {/* Timeline node */}
                <div className={`absolute -left-[16px] top-1.5 w-2 h-2 rounded-full border ${
                  idx === 0 
                    ? 'bg-kapruka-purple border-kapruka-purple scale-125' 
                    : 'bg-white border-muted-stone'
                }`} />
                <div>
                  <span className="text-[9px] text-gray-400 font-bold tracking-wider block uppercase">{step.date}</span>
                  <span className={`font-semibold block ${idx === 0 ? 'text-kapruka-purple' : 'text-gray-600'}`}>
                    {step.description}
                  </span>
                </div>
              </div>
            ))}

            {steps.length === 0 && (
              <p className="text-gray-400 italic">No logs available for this order yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
