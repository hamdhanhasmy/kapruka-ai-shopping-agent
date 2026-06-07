'use client';

import React, { useEffect, useState } from 'react';
import { CreditCard, Hourglass } from 'lucide-react';

interface CountdownCardProps {
  checkoutUrl: string;
  expiresAt: string; // ISO string representing expiry time
  orderId: string;
  amount: number;
}

export default function CountdownCard({ checkoutUrl, expiresAt, orderId, amount }: CountdownCardProps) {
  const [timeLeft, setTimeLeft] = useState<number>(3600); // 60 minutes in seconds default

  useEffect(() => {
    const calculateTimeLeft = () => {
      const expiry = new Date(expiresAt).getTime();
      const now = new Date().getTime();
      const difference = Math.max(0, Math.floor((expiry - now) / 1000));
      setTimeLeft(difference);
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [expiresAt]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const minutesRemaining = Math.floor(timeLeft / 60);
  const percentage = (timeLeft / 3600) * 100;

  // Circular progress SVG calculations
  const radius = 40;
  const stroke = 6;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="border border-muted-stone bg-alabaster-card p-6 rounded-lg shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 mb-6">
      <div className="flex items-center gap-4">
        {/* Circular Countdown Loader */}
        <div className="relative w-24 h-24 flex items-center justify-center flex-shrink-0">
          <svg className="w-full h-full transform -rotate-90">
            {/* Background Circle */}
            <circle
              className="text-muted-stone/20"
              strokeWidth={stroke}
              stroke="currentColor"
              fill="transparent"
              r={normalizedRadius}
              cx={radius + stroke}
              cy={radius + stroke}
            />
            {/* Progress Circle */}
            <circle
              className="text-kapruka-purple"
              strokeWidth={stroke}
              strokeDasharray={circumference + ' ' + circumference}
              style={{ strokeDashoffset }}
              strokeLinecap="round"
              stroke="currentColor"
              fill="transparent"
              r={normalizedRadius}
              cx={radius + stroke}
              cy={radius + stroke}
            />
          </svg>
          {/* Time text centered */}
          <div className="absolute flex flex-col items-center justify-center text-iris-black">
            <span className="font-mono text-sm font-bold">{formatTime(timeLeft)}</span>
            <span className="text-[8px] uppercase tracking-wider text-gray-500 font-bold">Left</span>
          </div>
        </div>

        <div>
          <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider block">
            Guest Order: {orderId}
          </span>
          <h3 className="font-serif text-xl font-bold text-kapruka-purple">
            Secure Payment Gateway
          </h3>
          <p className="text-xs text-gray-400 mt-1 max-w-[280px]">
            Your cart and shipping rate lock expires soon. Complete your order before the countdown hits 00:00.
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center md:items-end w-full md:w-auto gap-3">
        <div className="text-center md:text-right">
          <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block">Secure Checkout Price</span>
          <span className="text-2xl font-serif font-extrabold text-kapruka-purple">
            Rs. {amount.toLocaleString()} LKR
          </span>
        </div>

        {timeLeft > 0 ? (
          <a
            href={checkoutUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full md:w-auto bg-kapruka-purple text-white hover:bg-kapruka-gold hover:text-kapruka-purple transition-all duration-300 font-bold py-3.5 px-8 rounded-full flex items-center justify-center gap-2 shadow-md hover:shadow-lg text-sm"
          >
            <CreditCard className="w-4 h-4" /> Pay with Guest Checkout
          </a>
        ) : (
          <button
            disabled
            className="w-full md:w-auto bg-gray-200 text-gray-400 font-bold py-3.5 px-8 rounded-full flex items-center justify-center gap-2 text-sm cursor-not-allowed"
          >
            <Hourglass className="w-4 h-4" /> Checkout Token Expired
          </button>
        )}
      </div>
    </div>
  );
}
