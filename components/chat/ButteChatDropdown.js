'use client';

import { useRef, useEffect, useState } from 'react';
import { useChat } from '@/lib/chat/ChatContext';
import { ChatMessage } from './ChatMessage';
import { createMarket, createAsset, createComp, createMarketWithResearch } from '@/lib/api/crestApi';
import { captureScreenshot } from '@/lib/utils/screenshot';

export function ButteChatDropdown() {
  const { messages, loading, sendMessage, clearChat } = useChat();
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(null); // null | 'market' | 'asset' | 'comp'
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [formData, setFormData] = useState({});
  const [markets, setMarkets] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [marketName, setMarketName] = useState(''); // For simple market name input
  const [takingScreenshot, setTakingScreenshot] = useState(false);
  const messagesEndRef = useRef(null);
  const dropdownRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (!isPinned && dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    if (isOpen && !isPinned) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, isPinned]);

  // Fetch markets and assets when forms are opened
  useEffect(() => {
    if (showCreateForm === 'asset' || showCreateForm === 'comp') {
      const fetchData = async () => {
        setLoadingData(true);
        try {
          // Fetch from Supabase via client-side call
          // For now, we'll use a simple fetch to get the data
          const response = await fetch('/api/portfolio/data');
          if (response.ok) {
            const { markets: fetchedMarkets, assets: fetchedAssets } = await response.json();
            setMarkets(fetchedMarkets || []);
            setAssets(fetchedAssets || []);
          }
        } catch (error) {
          console.error('Failed to fetch portfolio data:', error);
        } finally {
          setLoadingData(false);
        }
      };
      fetchData();
    }
  }, [showCreateForm]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userInput = input;
    setInput('');

    try {
      await sendMessage(userInput);
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const handleScreenshot = async () => {
    setTakingScreenshot(true);
    try {
      const screenshot = await captureScreenshot();
      const message = 'Analyze this screenshot of my portfolio and give me insights.';

      // Send message with screenshot to chat API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          screenshot,
        }),
      });

      if (!response.ok) throw new Error('Chat failed');

      const data = await response.json();

      // Add screenshot message to chat
      const { messages: existingMessages } = messages.length > 0 ?
        { messages } : { messages: [] };

      // Use sendMessage to add the response
      await sendMessage(message);
    } catch (err) {
      console.error('Screenshot failed:', err);
      alert('Failed to capture screenshot');
    } finally {
      setTakingScreenshot(false);
    }
  };

  const handleSuggestion = async (suggestion) => {
    try {
      await sendMessage(suggestion);
    } catch (err) {
      console.error('Failed to send suggestion:', err);
    }
  };

  const handleFormInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value === '' ? null : (name.includes('price') || name.includes('units') || name.includes('cap') || name.includes('noi') || name === 'score' ? parseFloat(value) : value),
    }));
  };

  const handleCreateMarketWithResearch = async (e) => {
    e.preventDefault();
    if (!marketName.trim()) return;

    setIsCreating(true);
    setCreateError('');

    try {
      const result = await createMarketWithResearch(marketName);
      setMarketName('');
      setShowCreateForm(null);

      // Send a message about the created market
      await sendMessage(`I just researched and created the ${result.research.name} market. ${result.research.notes} Can you help me analyze this market?`);
    } catch (error) {
      setCreateError(error.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateMarket = async (e) => {
    e.preventDefault();
    setIsCreating(true);
    setCreateError('');

    try {
      const data = {
        name: formData.name,
        address: formData.address || null,
        status: formData.status || 'scouting',
        asset_class: formData.asset_class || null,
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
        score: formData.score ? parseFloat(formData.score) : null,
        notes: formData.notes || null,
      };

      await createMarket(data);
      setFormData({});
      setShowCreateForm(null);
      await sendMessage(`I just created a new market: ${formData.name}. Can you help me analyze it?`);
    } catch (error) {
      setCreateError(error.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateAsset = async (e) => {
    e.preventDefault();
    setIsCreating(true);
    setCreateError('');

    try {
      if (!formData.market_id) {
        throw new Error('Market selection is required');
      }

      const data = {
        market_id: formData.market_id,
        name: formData.name,
        status: formData.status || 'scouting',
        asset_class: formData.asset_class || null,
        units: formData.units ? parseInt(formData.units) : null,
        purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : null,
        cap_rate: formData.cap_rate ? parseFloat(formData.cap_rate) : null,
        noi: formData.noi ? parseFloat(formData.noi) : null,
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
        score: formData.score ? parseFloat(formData.score) : null,
        notes: formData.notes || null,
      };

      await createAsset(data);
      setFormData({});
      setShowCreateForm(null);
      await sendMessage(`I just created a new asset: ${formData.name}. Can you help me analyze it?`);
    } catch (error) {
      setCreateError(error.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateComp = async (e) => {
    e.preventDefault();
    setIsCreating(true);
    setCreateError('');

    try {
      if (!formData.asset_id) {
        throw new Error('Asset selection is required');
      }

      const data = {
        asset_id: formData.asset_id,
        comp_name: formData.comp_name,
        price: formData.price ? parseFloat(formData.price) : null,
        price_per_unit: formData.price_per_unit ? parseFloat(formData.price_per_unit) : null,
        cap_rate: formData.cap_rate ? parseFloat(formData.cap_rate) : null,
        market: formData.market || null,
        sale_date: formData.sale_date || null,
      };

      await createComp(data);
      setFormData({});
      setShowCreateForm(null);
      await sendMessage(`I just added a comp: ${formData.comp_name}. Can you use this to analyze the asset?`);
    } catch (error) {
      setCreateError(error.message);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div ref={dropdownRef} className="relative">
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-mono font-bold transition-colors"
        title="Butte AI Assistant"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
        Butte
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-gray-900 border border-gray-800 rounded-lg shadow-2xl flex flex-col z-50 h-96">
          {/* Header */}
          <div className="flex-shrink-0 px-4 py-3 border-b border-gray-800 flex justify-between items-center">
            <h3 className="text-sm font-bold text-white font-mono">Butte</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setIsPinned(!isPinned)}
                className="text-gray-400 hover:text-white transition-colors"
                title={isPinned ? 'Unpin' : 'Pin'}
              >
                {isPinned ? '📌' : '📍'}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
            {messages.length === 0 ? (
              <div className="text-xs text-gray-500 text-center py-4">
                Ask about your portfolio
              </div>
            ) : (
              <>
                {messages.map((msg) => (
                  <div key={msg.id} className="text-xs">
                    <ChatMessage message={msg} />
                  </div>
                ))}
                {loading && (
                  <div className="flex gap-1 items-center justify-start px-2">
                    <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" />
                    <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce delay-100" />
                    <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce delay-200" />
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Suggestions */}
          {messages.length > 0 &&
            !loading &&
            messages[messages.length - 1]?.suggestions?.length > 0 && (
              <div className="flex-shrink-0 px-3 py-2 border-t border-gray-800">
                <div className="text-xs text-gray-500 mb-2">Suggestions:</div>
                <div className="space-y-1">
                  {messages[messages.length - 1].suggestions.slice(0, 2).map((suggestion, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSuggestion(suggestion)}
                      className="w-full text-left text-xs bg-gray-800 hover:bg-gray-700 text-gray-100 px-2 py-1 rounded border border-gray-700 hover:border-gray-600 transition-colors font-mono"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

          {/* Create Form or Input */}
          {showCreateForm === 'market' ? (
            // Simple Claude-powered market creation
            <form onSubmit={handleCreateMarketWithResearch} className="flex-shrink-0 px-3 py-3 border-t border-gray-800">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-xs font-bold text-white">Research Market</h4>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(null);
                    setMarketName('');
                    setCreateError('');
                  }}
                  className="text-gray-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              </div>

              {createError && (
                <div className="mb-2 text-xs text-red-400 bg-red-900 bg-opacity-30 p-1.5 rounded border border-red-700">
                  {createError}
                </div>
              )}

              <div className="space-y-1.5">
                <input
                  type="text"
                  placeholder="Market name (e.g., Tulsa, Denver, Austin)"
                  value={marketName}
                  onChange={(e) => setMarketName(e.target.value)}
                  disabled={isCreating}
                  autoFocus
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-600 disabled:opacity-50"
                />
                <p className="text-xs text-gray-500">Claude will research the market based on your asset types and create smart defaults.</p>
              </div>

              <button
                type="submit"
                disabled={isCreating || !marketName.trim()}
                className="mt-2 w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-700 text-white rounded px-2 py-1.5 text-xs transition-colors disabled:cursor-not-allowed font-mono"
              >
                {isCreating ? 'Researching...' : 'Research & Create'}
              </button>
            </form>
          ) : showCreateForm ? (
            <form
              onSubmit={
                showCreateForm === 'asset' ? handleCreateAsset :
                handleCreateComp
              }
              className="flex-shrink-0 px-3 py-3 border-t border-gray-800"
            >
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-xs font-bold text-white capitalize">
                  Create {showCreateForm}
                </h4>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(null);
                    setFormData({});
                    setCreateError('');
                  }}
                  className="text-gray-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              </div>

              {createError && (
                <div className="mb-2 text-xs text-red-400 bg-red-900 bg-opacity-30 p-1.5 rounded border border-red-700">
                  {createError}
                </div>
              )}

              <div className="space-y-1.5">
                {showCreateForm === 'asset' && (
                  <>
                    <input
                      type="text"
                      name="name"
                      placeholder="Asset name *"
                      value={formData.name || ''}
                      onChange={handleFormInputChange}
                      required
                      className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-600"
                    />
                    <select
                      name="market_id"
                      value={formData.market_id || ''}
                      onChange={handleFormInputChange}
                      required
                      disabled={loadingData}
                      className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-600 disabled:opacity-50"
                    >
                      <option value="">
                        {loadingData ? 'Loading markets...' : 'Select market *'}
                      </option>
                      {markets.map((market) => (
                        <option key={market.id} value={market.id}>
                          {market.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      name="units"
                      placeholder="Units (optional)"
                      value={formData.units || ''}
                      onChange={handleFormInputChange}
                      className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-600"
                    />
                    <input
                      type="number"
                      name="purchase_price"
                      placeholder="Purchase price (optional)"
                      value={formData.purchase_price || ''}
                      onChange={handleFormInputChange}
                      step="0.01"
                      className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-600"
                    />
                    <input
                      type="number"
                      name="cap_rate"
                      placeholder="Cap rate (optional)"
                      value={formData.cap_rate || ''}
                      onChange={handleFormInputChange}
                      step="0.01"
                      className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-600"
                    />
                  </>
                )}

                {showCreateForm === 'asset' && (
                  <>
                    <input
                      type="text"
                      name="name"
                      placeholder="Asset name *"
                      value={formData.name || ''}
                      onChange={handleFormInputChange}
                      required
                      className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-600"
                    />
                    <select
                      name="market_id"
                      value={formData.market_id || ''}
                      onChange={handleFormInputChange}
                      required
                      disabled={loadingData}
                      className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-600 disabled:opacity-50"
                    >
                      <option value="">
                        {loadingData ? 'Loading markets...' : 'Select market *'}
                      </option>
                      {markets.map((market) => (
                        <option key={market.id} value={market.id}>
                          {market.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      name="units"
                      placeholder="Units (optional)"
                      value={formData.units || ''}
                      onChange={handleFormInputChange}
                      className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-600"
                    />
                    <input
                      type="number"
                      name="purchase_price"
                      placeholder="Purchase price (optional)"
                      value={formData.purchase_price || ''}
                      onChange={handleFormInputChange}
                      step="0.01"
                      className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-600"
                    />
                    <input
                      type="number"
                      name="cap_rate"
                      placeholder="Cap rate (optional)"
                      value={formData.cap_rate || ''}
                      onChange={handleFormInputChange}
                      step="0.01"
                      className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-600"
                    />
                  </>
                )}

                {showCreateForm === 'comp' && (
                  <>
                    <input
                      type="text"
                      name="comp_name"
                      placeholder="Comp name *"
                      value={formData.comp_name || ''}
                      onChange={handleFormInputChange}
                      required
                      className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-600"
                    />
                    <select
                      name="asset_id"
                      value={formData.asset_id || ''}
                      onChange={handleFormInputChange}
                      required
                      disabled={loadingData}
                      className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-600 disabled:opacity-50"
                    >
                      <option value="">
                        {loadingData ? 'Loading assets...' : 'Select asset *'}
                      </option>
                      {assets.map((asset) => (
                        <option key={asset.id} value={asset.id}>
                          {asset.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      name="price"
                      placeholder="Sale price (optional)"
                      value={formData.price || ''}
                      onChange={handleFormInputChange}
                      step="0.01"
                      className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-600"
                    />
                    <input
                      type="date"
                      name="sale_date"
                      value={formData.sale_date || ''}
                      onChange={handleFormInputChange}
                      className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-600"
                    />
                  </>
                )}
              </div>

              <button
                type="submit"
                disabled={isCreating}
                className="mt-2 w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-700 text-white rounded px-2 py-1.5 text-xs transition-colors disabled:cursor-not-allowed font-mono"
              >
                {isCreating ? 'Creating...' : 'Create'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSend} className="flex-shrink-0 px-3 py-3 border-t border-gray-800">
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask..."
                  disabled={loading}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-600 disabled:opacity-50 font-mono"
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-700 text-white rounded px-2 py-1.5 text-xs transition-colors disabled:cursor-not-allowed"
                >
                  ↑
                </button>
              </div>

              {/* Quick action buttons */}
              <div className="flex gap-1 text-xs">
                <button
                  type="button"
                  onClick={handleScreenshot}
                  disabled={takingScreenshot || loading}
                  title="Send screenshot to Claude for analysis"
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white px-2 py-1 rounded border border-gray-700 hover:border-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {takingScreenshot ? '📸 Capturing...' : '📸 Screenshot'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm('market');
                    setMarketName('');
                  }}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white px-2 py-1 rounded border border-gray-700 hover:border-gray-600 transition-colors"
                >
                  📍 Research Market
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm('asset')}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white px-2 py-1 rounded border border-gray-700 hover:border-gray-600 transition-colors"
                >
                  + Asset
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm('comp')}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white px-2 py-1 rounded border border-gray-700 hover:border-gray-600 transition-colors"
                >
                  + Comp
                </button>
              </div>

              {/* Clear button */}
              {messages.length > 0 && (
                <button
                  onClick={clearChat}
                  className="mt-2 text-xs text-gray-500 hover:text-gray-400 transition-colors"
                >
                  Clear
                </button>
              )}
            </form>
          )}
        </div>
      )}
    </div>
  );
}
