'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, Sparkles, User, Bot, Plus } from 'lucide-react';

export interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  recommendations?: any[];
}

interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: (text: string) => void;
  isLoading: boolean;
  onAddToHamper: (product: any) => void;
}

export default function ChatInterface({ messages, onSendMessage, isLoading, onAddToHamper }: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input.trim());
    setInput('');
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className="flex flex-col h-full bg-luxury-ivory text-iris-black border-l border-muted-stone">
      {/* Header Info */}
      <div className="bg-kapruka-purple text-white p-4 flex items-center justify-between shadow-sm border-b border-muted-stone">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-kapruka-gold flex items-center justify-center text-kapruka-purple font-extrabold text-sm">
            K
          </div>
          <div>
            <h2 className="font-serif font-bold text-sm tracking-wide">Kapruka Shopping Agent</h2>
            <p className="text-[10px] text-gray-300 font-semibold tracking-wider flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
              ONLINE
            </p>
          </div>
        </div>
        <Sparkles className="w-4 h-4 text-kapruka-gold" />
      </div>

      {/* Message Feed */}
      <div className="flex-grow overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex items-start gap-3 max-w-[85%] ${
              message.sender === 'user' ? 'ml-auto flex-row-reverse' : ''
            }`}
          >
            {/* Avatar */}
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs flex-shrink-0 shadow-sm ${
                message.sender === 'user'
                  ? 'bg-kapruka-purple text-white'
                  : 'bg-white border border-muted-stone text-kapruka-purple'
              }`}
            >
              {message.sender === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
            </div>

            {/* Bubble Container */}
            <div className="flex flex-col gap-2 w-full">
              <div
                className={`p-3 rounded-lg text-sm shadow-sm ${
                  message.sender === 'user'
                    ? 'bg-kapruka-purple text-white rounded-tr-none font-medium'
                    : 'bg-white border border-muted-stone text-iris-black rounded-tl-none font-medium leading-relaxed'
                }`}
              >
                <p className="whitespace-pre-line">{message.text}</p>
                <span
                  className={`text-[8px] mt-1 block text-right font-medium ${
                    message.sender === 'user' ? 'text-purple-200' : 'text-gray-400'
                  }`}
                >
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {/* Recommendations list */}
              {message.sender === 'assistant' && message.recommendations && message.recommendations.length > 0 && (
                <div className="mt-1 space-y-1.5 w-full max-w-sm">
                  <p className="text-[10px] uppercase tracking-wider font-extrabold text-kapruka-purple flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-kapruka-gold" /> Recommended Gifting Items:
                  </p>
                  <div className="flex flex-col gap-2 bg-alabaster-card p-2 rounded-lg border border-muted-stone shadow-xs">
                    {message.recommendations.map((prod: any) => (
                      <div key={prod.id || prod.product_id} className="flex items-center gap-2 justify-between border-b border-muted-stone/40 last:border-b-0 pb-1.5 last:pb-0 pt-1.5 first:pt-0">
                        <div className="flex items-center gap-2 min-w-0">
                          {prod.image && (
                            <img src={prod.image} alt={prod.name} className="w-8 h-8 rounded object-cover flex-shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold text-iris-black truncate leading-tight">{prod.name}</p>
                            <p className="text-[9px] font-semibold text-kapruka-purple mt-0.5">Rs. {Number(prod.price).toLocaleString()} LKR</p>
                          </div>
                        </div>
                        <button
                          onClick={() => onAddToHamper({
                            id: prod.id || prod.product_id,
                            name: prod.name,
                            price: Number(prod.price),
                            image: prod.image,
                            category: prod.category || 'Gift',
                            in_stock: true,
                          })}
                          className="flex items-center gap-1 text-[9px] font-bold bg-kapruka-purple hover:bg-kapruka-gold hover:text-kapruka-purple text-white transition-all duration-300 py-1 px-2.5 rounded-full flex-shrink-0 shadow-xs"
                        >
                          <Plus className="w-2.5 h-2.5" /> Add
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Loading Spinner */}
        {isLoading && (
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 bg-white/40 border border-muted-stone/60 px-3 py-2 rounded-full w-max">
            <span className="w-1.5 h-1.5 rounded-full bg-kapruka-purple animate-ping"></span>
            Curating gift catalog, validating logistics...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Dock */}
      <div className="p-4 border-t border-muted-stone bg-white/80 backdrop-blur-sm">
        <form onSubmit={handleSubmit} className="flex gap-2 items-center">
          {/* Active Input Dock with voice mic trigger */}
          <button
            type="button"
            className="p-3 bg-luxury-ivory hover:bg-muted-stone/50 border border-muted-stone rounded-full transition-colors duration-200 text-kapruka-purple"
            title="Voice Command (Mic Trigger)"
            onClick={() => alert('Speech parsing active: Speak now...')}
          >
            <Mic className="w-4 h-4" />
          </button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type 'Cake for Colombo 3' or speak..."
            className="flex-grow p-3 bg-luxury-ivory border border-muted-stone rounded-full text-xs font-semibold text-iris-black placeholder-gray-400 focus:outline-none focus:border-kapruka-purple/50 focus:ring-1 focus:ring-kapruka-purple/30 transition-all duration-200"
            disabled={isLoading}
          />

          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="p-3 bg-kapruka-purple hover:bg-kapruka-gold hover:text-kapruka-purple disabled:bg-gray-100 disabled:text-gray-400 text-white rounded-full transition-all duration-300 shadow-sm"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        <p className="text-[9px] text-gray-400 mt-2 text-center font-medium">
          Powered by Kapruka MCP Gateway • Lock Rates for 60 Minutes
        </p>
      </div>
    </div>
  );
}
