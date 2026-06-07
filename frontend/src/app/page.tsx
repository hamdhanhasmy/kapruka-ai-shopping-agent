'use client';

import React, { useState } from 'react';
import GiftBoxBuilder from '../components/GiftBoxBuilder';
import ProductCard, { Product } from '../components/ProductCard';
import LogisticsPanel from '../components/LogisticsPanel';
import ChatInterface, { Message } from '../components/ChatInterface';
import CountdownCard from '../components/CountdownCard';
import { Package, Search, Sparkles, Filter, CreditCard } from 'lucide-react';
import { sendMessageToConcierge, createCheckoutOrder } from '../utils/api';

export default function DashboardPage() {
  // Pre-loaded catalog products for manual browsing
  const mockProducts: Product[] = [
    {
      id: 'KAP-1001',
      name: 'Boutique Fresh Red Roses Bouquet (12 Stems)',
      price: 4500,
      image: 'https://images.unsplash.com/photo-1561181286-d3fee7d55364?w=500&auto=format&fit=crop&q=60',
      category: 'Flowers',
      in_stock: true,
      url: 'https://www.kapruka.com/buyonline/red-roses-bouquet',
    },
    {
      id: 'KAP-1002',
      name: 'Double Chocolate Fudge Gateau Drip Cake',
      price: 6800,
      image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=500&auto=format&fit=crop&q=60',
      category: 'Cakes',
      in_stock: true,
      url: 'https://www.kapruka.com/buyonline/chocolate-fudge-cake',
    },
    {
      id: 'KAP-1003',
      name: 'Luxury Gold-Embossed Birthday Greetings Card',
      price: 850,
      image: 'https://images.unsplash.com/photo-1513201099705-a9746e1e201f?w=500&auto=format&fit=crop&q=60',
      category: 'Cards',
      in_stock: true,
      url: 'https://www.kapruka.com/buyonline/greeting-card',
    },
    {
      id: 'KAP-1004',
      name: 'Assorted Gourmet Belgian Chocolate Box',
      price: 3200,
      image: 'https://images.unsplash.com/photo-1549007994-cb92ca87df46?w=500&auto=format&fit=crop&q=60',
      category: 'Chocolates',
      in_stock: true,
      url: 'https://www.kapruka.com/buyonline/gourmet-chocolates',
    },
    {
      id: 'KAP-1005',
      name: 'Premium Teddy Bear (Brown, Medium)',
      price: 5200,
      image: 'https://images.unsplash.com/photo-1559251606-c623743a6d76?w=500&auto=format&fit=crop&q=60',
      category: 'Toys',
      in_stock: true,
      url: 'https://www.kapruka.com/buyonline/brown-teddy-bear',
    },
    {
      id: 'KAP-1006',
      name: 'Elegant White Lilies & Eucalyptus Vase',
      price: 5800,
      image: 'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?w=500&auto=format&fit=crop&q=60',
      category: 'Flowers',
      in_stock: true,
      url: 'https://www.kapruka.com/buyonline/white-lilies-vase',
    },
    {
      id: 'KAP-1007',
      name: 'Classic Victoria Strawberry Sponge Cake',
      price: 6200,
      image: 'https://images.unsplash.com/photo-1535141192574-5d4897c13636?w=500&auto=format&fit=crop&q=60',
      category: 'Cakes',
      in_stock: true,
      url: 'https://www.kapruka.com/buyonline/strawberry-cake',
    },
    {
      id: 'KAP-1008',
      name: 'Handcrafted Floral Anniversary Greeting Card',
      price: 950,
      image: 'https://images.unsplash.com/photo-1509281373149-e957c6296406?w=500&auto=format&fit=crop&q=60',
      category: 'Cards',
      in_stock: true,
      url: 'https://www.kapruka.com/buyonline/floral-card',
    },
    {
      id: 'KAP-1009',
      name: 'Artisanal Dark Chocolate Truffles (Pack of 16)',
      price: 4100,
      image: 'https://images.unsplash.com/photo-1481391302567-4a6957d6d7c1?w=500&auto=format&fit=crop&q=60',
      category: 'Chocolates',
      in_stock: true,
      url: 'https://www.kapruka.com/buyonline/dark-truffles',
    },
    {
      id: 'KAP-1010',
      name: 'Cute Fluffy White Bunny Plush Toy',
      price: 3800,
      image: 'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=500&auto=format&fit=crop&q=60',
      category: 'Toys',
      in_stock: false,
      url: 'https://www.kapruka.com/buyonline/bunny-plush',
    },
    {
      id: 'KAP-1011',
      name: 'Royal Afternoon Tea Premium Hamper',
      price: 12500,
      image: 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?w=500&auto=format&fit=crop&q=60',
      category: 'Hampers',
      in_stock: true,
      url: 'https://www.kapruka.com/buyonline/tea-hamper',
    },
    {
      id: 'KAP-1012',
      name: 'Deluxe Fruit & Nuts Celebration Basket',
      price: 9800,
      image: 'https://images.unsplash.com/photo-1610832958506-ee5633613df2?w=500&auto=format&fit=crop&q=60',
      category: 'Hampers',
      in_stock: true,
      url: 'https://www.kapruka.com/buyonline/fruit-nuts-basket',
    },
  ];

  // States
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'assistant',
      text: `Ayubowan! I am KaprukaAI, your premium personal shopper and intelligent gifting concierge. 🤖✨

Kawda surprise karanna one, budget eka, and delivery city eka mata kiyanna. Mama matching items bundle karala, delivery verify karala, secure 60-minute guest checkout link eka ready karannam.

I easily understand English, casual everyday Singlish, and Tanglish text.

Where are we sending love today?
(e.g., 'Galle walata fresh flowers and a fruit basket yawanna puluwanda heta?')`,
      timestamp: new Date(),
    },
  ]);
  const [cart, setCart] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentCity, setCurrentCity] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');
  const [isDeliverable, setIsDeliverable] = useState(true);
  const [perishableWarning, setPerishableWarning] = useState(false);
  const [perishableItems, setPerishableItems] = useState<string[]>([]);
  const [checkoutData, setCheckoutData] = useState<any>(null);
  const [userLanguage, setUserLanguage] = useState<'english' | 'sinhala' | 'tamil' | 'singlish' | 'tanglish'>('english');

  // Catalog filtering states and categories
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [catalogSearch, setCatalogSearch] = useState<string>('');

  const categories = ['All', 'Flowers', 'Cakes', 'Cards', 'Chocolates', 'Toys', 'Hampers'];

  const filteredProducts = mockProducts.filter((product) => {
    const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
    const matchesSearch = product.name.toLowerCase().includes(catalogSearch.toLowerCase()) || 
                          (product.category && product.category.toLowerCase().includes(catalogSearch.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  // Dynamic Guest Shipping Details
  const [recipientName, setRecipientName] = useState<string>('Jane Doe');
  const [recipientPhone, setRecipientPhone] = useState<string>('+94771234567');
  const [deliveryAddress, setDeliveryAddress] = useState<string>('123 Galle Road');
  const [senderName, setSenderName] = useState<string>('');

  // Cart operations
  const handleAddToHamper = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) => (item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
      }
      return [...prev, { id: product.id, name: product.name, price: product.price, quantity: 1, image: product.image }];
    });

    let addedMsg = `I have added "${product.name}" to your active hamper. 🎁 Let me know if you want to add more items, or tell me when you're ready to checkout!`;
    if (userLanguage === 'sinhala') {
      addedMsg = `මම "${product.name}" ඔයාගේ හැම්පර් එකට එකතු කළා. 🎁 තවත් භාණ්ඩ එකතු කිරීමට අවශ්‍යද නැතහොත් checkout කිරීමට සූදානම්ද කියා මට කියන්න!`;
    } else if (userLanguage === 'tamil') {
      addedMsg = `நான் "${product.name}" ஐ உங்கள் கூடையில் சேர்த்துள்ளேன். 🎁 மேலும் பொருட்களைச் சேர்க்க வேண்டுமா அல்லது பணம் செலுத்தத் தயாரா என்று எனக்குக் கூறவும்!`;
    } else if (userLanguage === 'singlish') {
      addedMsg = `Mama "${product.name}" active hamper ekata add kalaa. 🎁 Let me know if you want to add more items, or tell me when you're ready to checkout!`;
    } else if (userLanguage === 'tanglish') {
      addedMsg = `Naan "${product.name}" active hamper la add panni iruken. 🎁 Neriya items add panna venuma, illa checkout panna ready ah nu sollunga!`;
    }

    setMessages((prev) => [
      ...prev,
      {
        id: Math.random().toString(),
        sender: 'assistant',
        text: addedMsg,
        timestamp: new Date(),
      },
    ]);
  };

  const handleRemoveItem = (id: string | number) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearCart = () => {
    setCart([]);
    setCheckoutData(null);
  };

  // Trigger Checkout creation
  const handleCheckout = async () => {
    if (cart.length === 0) return;

    setIsLoading(true);
    try {
      const payload = {
        cart: cart.map((item) => ({ product_id: item.id, quantity: item.quantity })),
        recipient: {
          name: recipientName || 'Jane Doe',
          phone: recipientPhone || '+94771234567',
        },
        delivery: {
          city: currentCity || 'Colombo 03',
          address: deliveryAddress || '123 Galle Road',
          date: currentDate || '2026-06-12',
        },
        sender: {
          name: senderName || 'Guest Sender',
        },
      };


      const result = await createCheckoutOrder(payload);
      setCheckoutData(result);

      let successMsg = `Hari! I have successfully generated your secure guest click-to-pay checkout link. 🌟 Your products and delivery rates are locked for 60 minutes. Please click the "Pay with Guest Checkout" card in the Curation Space on the left to complete your payment securely. Let me know if you need anything else! 😊`;
      if (userLanguage === 'sinhala') {
        successMsg = `හරි! මම ඔයාගේ secure guest checkout link එක සාර්ථකව සකස් කළා. 🌟 ඔයා තෝරාගත් භාණ්ඩ සහ මිල ගණන් විනාඩි 60ක් සඳහා වලංගු වේ. ගෙවීම් කටයුතු නිම කිරීමට වම් පස ඇති "Pay with Guest Checkout" කාඩ් එක ක්ලික් කරන්න. 😊`;
      } else if (userLanguage === 'tamil') {
        successMsg = `சரி! உங்கள் பாதுகாப்பான கெஸ்ட் செக்அவுட் இணைப்பை நான் வெற்றிகரமாக உருவாக்கியுள்ளேன். 🌟 உங்கள் பொருட்களின் விவரங்கள் மற்றும் கட்டணங்கள் 60 நிமிடங்களுக்குப் பூட்டப்பட்டுள்ளன. பணத்தைச் செலுத்த இடதுபுறம் உள்ள "Pay with Guest Checkout" கார்டைக் கிளிக் செய்யவும். 😊`;
      } else if (userLanguage === 'singlish') {
        successMsg = `Hari! Mama oyage secure guest checkout link eka ready kala. 🌟 Your items and delivery rates are locked for 60 minutes. Please click the "Pay with Guest Checkout" card in the Curation Space on the left to complete your payment securely. Let me know if you need anything else! 😊`;
      } else if (userLanguage === 'tanglish') {
        successMsg = `Hari! Naan ungaloda secure guest checkout link ready panni iruken. 🌟 Items and delivery rates 60 minutes ku block panni iruku. Left side la iruka "Pay with Guest Checkout" card click panni payment mudiyunga. Sollunga edhavadhu venuma nu! 😊`;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          sender: 'assistant',
          text: successMsg,
          timestamp: new Date(),
        },
      ]);
    } catch (err: any) {
      console.error(err);
      
      let errorMsg = `Podi prashnayak! I couldn't generate the checkout link: ${err.message || 'Please check your details and try again.'} 😕`;
      if (userLanguage === 'sinhala') {
        errorMsg = `පොඩි ප්‍රශ්නයක්! මට checkout link එක සකස් කිරීමට නොහැකි වුණා: ${err.message || 'කරුණාකර විස්තර පරීක්ෂා කර නැවත උත්සාහ කරන්න.'} 😕`;
      } else if (userLanguage === 'tamil') {
        errorMsg = `சிறு பிரச்சனை! என்னால் செக்அவுட் இணைப்பை உருவாக்க முடியவில்லை: ${err.message || 'விவரங்களைச் சரிபார்த்து மீண்டும் முயற்சிக்கவும்.'} 😕`;
      } else if (userLanguage === 'tanglish') {
        errorMsg = `Chinna prachanai! Ennala checkout link ready panna mudiyala: ${err.message || 'Details check panni thirumba try pannunga.'} 😕`;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          sender: 'assistant',
          text: errorMsg,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Messaging operations
  const handleSendMessage = async (text: string) => {
    const userMsg: Message = {
      id: Math.random().toString(),
      sender: 'user',
      text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      // Detect user language
      const sinhalaRegex = /[\u0D80-\u0DFF]/;
      const tamilRegex = /[\u0B80-\u0BFF]/;
      const textLower = text.toLowerCase();
      let detectedLang: 'english' | 'sinhala' | 'tamil' | 'singlish' | 'tanglish' = 'english';
      
      if (tamilRegex.test(text)) {
        detectedLang = 'tamil';
      } else if (sinhalaRegex.test(text)) {
        detectedLang = 'sinhala';
      } else if (
        ['enaku', 'unaku', 'venum', 'anupunga', 'kudunga', 'iruka', 'eppo', 'nalaki', 'panna', 'pannunga', 'anupa', 'tanglish'].some((kw) => textLower.includes(kw))
      ) {
        detectedLang = 'tanglish';
      } else if (
        ['mata', 'one', 'ewanna', 'danna', 'hampa', 'yawanna', 'puluwanda', 'heta', 'walata', 'hari', 'mama', 'oyage', 'meka', 'mge', 'karanna'].some((kw) => textLower.includes(kw))
      ) {
        detectedLang = 'singlish';
      }
      setUserLanguage(detectedLang);

      // Check if user is asking for checkout directly
      if (textLower.includes('checkout') || textLower.includes('pay') || textLower.includes('purchase')) {
        if (cart.length === 0) {
          let emptyCartMsg = `Your hamper is empty. 😕 Please add some items from the catalog or ask me to search for them first! 😊`;
          if (detectedLang === 'sinhala') {
            emptyCartMsg = `ඔයාගේ හැම්පර් එක හිස්. 😕 කරුණාකර කැටලොග් එකෙන් භාණ්ඩ එකතු කරන්න නැතහොත් සෙවීමට මට කියන්න! 😊`;
          } else if (detectedLang === 'tamil') {
            emptyCartMsg = `உங்கள் கூடை காலியாக உள்ளது. 😕 பட்டியலிலிருந்து சில பொருட்களைச் சேர்க்கவும் அல்லது முதலில் அவற்றைத் தேட எனக்குக் கூறவும்! 😊`;
          } else if (detectedLang === 'singlish') {
            emptyCartMsg = `Oyage hamper eka empty. 😕 Please add some items from the catalog or ask me to search for them first! 😊`;
          } else if (detectedLang === 'tanglish') {
            emptyCartMsg = `Ungaloda hamper empty ah iruku. 😕 Catalog la irundhu items add pannunga illa enaku search panna sollunga! 😊`;
          }

          setMessages((prev) => [
            ...prev,
            {
              id: Math.random().toString(),
              sender: 'assistant',
              text: emptyCartMsg,
              timestamp: new Date(),
            },
          ]);
          setIsLoading(false);
          return;
        }
        await handleCheckout();
        return;
      }

      // Check if user is confirming/asking to add the recommended items from the last assistant message
      const lastAssistantMsg = [...messages].reverse().find((m) => m.sender === 'assistant');
      const hasRecommendations = lastAssistantMsg && lastAssistantMsg.recommendations && lastAssistantMsg.recommendations.length > 0;
      const isNegation = /\b(?:don't|dont|not|epa|epaa)\b/i.test(text);
      
      const isAddIntent = (
        /\b(?:add|danna|dannda|dapan|damu|ganna|insert|accept)\b/i.test(text) ||
        (/\bhari\b/i.test(text) && /\b(?:hamper|cart|add)\b/i.test(text)) ||
        (/\bmeka\b/i.test(text) && /\b(?:hamper|cart|add)\b/i.test(text))
      );

      if (isAddIntent && hasRecommendations && !isNegation) {
        const itemsToAdd = lastAssistantMsg.recommendations!;
        setCart((prev) => {
          let updated = [...prev];
          itemsToAdd.forEach((prod: any) => {
            const existing = updated.find((item) => item.id === (prod.id || prod.product_id));
            if (existing) {
              updated = updated.map((item) =>
                item.id === (prod.id || prod.product_id) ? { ...item, quantity: item.quantity + 1 } : item
              );
            } else {
              updated.push({
                id: prod.id || prod.product_id,
                name: prod.name,
                price: Number(prod.price),
                quantity: 1,
                image: prod.image,
              });
            }
          });
          return updated;
        });

        const addedNames = itemsToAdd.map((i: any) => `"${i.name}"`).join(', ');
        
        let successAddReply = `I have added ${addedNames} to your active hamper. 🎁 Let me know if you want to add more items, or check out when you are ready!`;
        if (detectedLang === 'sinhala') {
          successAddReply = `හරි! මම ${addedNames} ඔයාගේ හැම්පර් එකට එකතු කළා. 🎁 තවත් භාණ්ඩ එකතු කිරීමට අවශ්‍යද නැතහොත් checkout කිරීමට සූදානම්ද කියා මට කියන්න!`;
        } else if (detectedLang === 'tamil') {
          successAddReply = `சரி! நான் ${addedNames} ஐ உங்கள் கூடையில் சேர்த்துள்ளேன். 🎁 மேலும் பொருட்களைச் சேர்க்க வேண்டுமா அல்லது பணம் செலுத்தத் தயாரா என்று எனக்குக் கூறவும்!`;
        } else if (detectedLang === 'singlish') {
          successAddReply = `Hari! Mama ${addedNames} active hamper ekata add kalaa. 🎁 Let me know if you want to add more items, or check out when you are ready!`;
        } else if (detectedLang === 'tanglish') {
          successAddReply = `Hari! Naan ${addedNames} active hamper la add panni iruken. 🎁 Neriya items add panna venuma, illa ready aagumbodu checkout pannunga!`;
        }

        setMessages((prev) => [
          ...prev,
          {
            id: Math.random().toString(),
            sender: 'assistant',
            text: successAddReply,
            timestamp: new Date(),
          },
        ]);
        setIsLoading(false);
        return;
      }

      // Call API chat orchestration endpoint with conversation history
      const historyPayload = messages.map((m) => ({
        sender: m.sender,
        text: m.text,
      }));
      const result = await sendMessageToConcierge(text, historyPayload);
      const { intent, bundle } = result;

      if (bundle.city) setCurrentCity(bundle.city);
      if (bundle.delivery_date) setCurrentDate(bundle.delivery_date);
      setIsDeliverable(bundle.is_deliverable);
      setPerishableWarning(bundle.perishable_warning);
      setPerishableItems(bundle.perishable_items);

      // Pre-fill shipping/contact details parsed by Gemini
      if (intent.recipient_name) setRecipientName(intent.recipient_name);
      if (intent.recipient_phone) setRecipientPhone(intent.recipient_phone);
      if (intent.delivery_address) setDeliveryAddress(intent.delivery_address);
      if (intent.sender_name) setSenderName(intent.sender_name);

      // Display the warm, conversational response generated by Gemini
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          sender: 'assistant',
          text: result.reply,
          timestamp: new Date(),
          recommendations: bundle.items,
        },
      ]);

    } catch (err: any) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          sender: 'assistant',
          text: `I encountered an error connecting to the orchestrator: ${err.message || 'Check backend configuration.'}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="h-screen overflow-hidden bg-luxury-ivory text-iris-black font-sans flex flex-col">
      {/* Top Brand Banner */}
      <header className="bg-alabaster-card border-b border-muted-stone py-3 px-6 flex items-center justify-between shadow-xs flex-shrink-0">
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight text-kapruka-purple flex items-center gap-2">
            <span className="italic">KAPRUKA</span>
            <span className="font-sans text-xs uppercase tracking-widest font-extrabold bg-kapruka-gold text-kapruka-purple py-0.5 px-2.5 rounded-full">
              Orchestrator
            </span>
          </h1>
        </div>
        <div className="flex items-center gap-4 text-xs font-semibold text-gray-500">
          <span>Server Status: <span className="text-green-600 font-bold">● Connected</span></span>
          <span className="border-l border-muted-stone pl-4">60 req/min cap</span>
        </div>
      </header>

      {/* Main split-pane canvas layout */}
      <div className="flex-grow flex flex-col lg:flex-row overflow-hidden">
        
        {/* Column A: Curation Space (Left 60%) */}
        <section className="w-full lg:w-3/5 h-full overflow-y-auto p-6 flex flex-col justify-between">
          <div>
            {/* Countdown widget when checkoutUrl is available */}
            {checkoutData && (
              <CountdownCard
                checkoutUrl={checkoutData.checkout_url}
                expiresAt={checkoutData.expires_at}
                orderId={checkoutData.order_id}
                amount={checkoutData.amount}
              />
            )}

            {/* Dynamic Gift Box Builder */}
            <GiftBoxBuilder
              items={cart}
              onRemoveItem={handleRemoveItem}
              onClear={handleClearCart}
            />

            {cart.length > 0 && !checkoutData && (
              <div className="mb-6 flex justify-end">
                <button
                  onClick={handleCheckout}
                  className="bg-kapruka-purple hover:bg-kapruka-gold hover:text-kapruka-purple text-white transition-all duration-300 font-bold py-3 px-6 rounded-full flex items-center gap-2 text-xs shadow-md"
                >
                  <CreditCard className="w-4 h-4" /> Generate Guest Checkout Link
                </button>
              </div>
            )}

            {/* Logistics Status Checker */}
            <LogisticsPanel
              city={currentCity}
              deliveryDate={currentDate}
              deliveryCharge={350}
              isDeliverable={isDeliverable}
              perishableWarning={perishableWarning}
              perishableItems={perishableItems}
              recipientName={recipientName}
              setRecipientName={setRecipientName}
              recipientPhone={recipientPhone}
              setRecipientPhone={setRecipientPhone}
              deliveryAddress={deliveryAddress}
              setDeliveryAddress={setDeliveryAddress}
              senderName={senderName}
              setSenderName={setSenderName}
            />

            {/* Catalog Grid Header */}
            <div className="flex flex-col gap-4 mb-6 mt-8 border-b border-muted-stone pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h3 className="font-serif text-2xl font-bold text-kapruka-purple">
                  Aesthetic Gift Catalog
                </h3>
                
                {/* Search Input */}
                <div className="relative w-full sm:w-64">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                    <Search className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    placeholder="Search catalog..."
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-xs rounded-full border border-muted-stone bg-alabaster-card focus:outline-none focus:ring-1 focus:ring-kapruka-purple focus:border-kapruka-purple transition-all placeholder:text-gray-400 text-iris-black font-sans"
                  />
                </div>
              </div>

              {/* Category Filter Pills */}
              <div className="flex flex-wrap gap-2 overflow-x-auto pb-1 scrollbar-thin">
                {categories.map((category) => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`text-xs font-bold px-4 py-2 rounded-full border transition-all duration-300 ${
                      selectedCategory === category
                        ? 'bg-kapruka-purple border-kapruka-purple text-white shadow-sm'
                        : 'bg-alabaster-card border-muted-stone text-gray-600 hover:border-kapruka-purple/40 hover:text-kapruka-purple'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>

            {/* Product Catalog Grid */}
            {filteredProducts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAddToHamper={handleAddToHamper}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 border border-dashed border-muted-stone rounded-lg bg-alabaster-card/50">
                <p className="text-sm text-gray-500 font-medium font-sans">No products found matching your criteria.</p>
                <button 
                  onClick={() => { setSelectedCategory('All'); setCatalogSearch(''); }}
                  className="mt-3 text-xs font-bold text-kapruka-purple hover:underline"
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>

          <footer className="mt-12 pt-6 border-t border-muted-stone text-[10px] text-gray-400 font-semibold tracking-wide flex justify-between">
            <span>© 2026 KAPRUKA COMMERCE AI. ALL RIGHTS RESERVED.</span>
            <span>POWERED BY KAPRUKA CONCIERGE GATEWAY</span>
          </footer>
        </section>

        {/* Column B: Concierge Terminal (Right 40%) */}
        <section className="w-full lg:w-2/5 h-full flex flex-col flex-shrink-0">
          <ChatInterface
            messages={messages}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            onAddToHamper={handleAddToHamper}
          />
        </section>

      </div>
    </main>
  );
}
