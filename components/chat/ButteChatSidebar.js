'use client';

import { useRef, useEffect, useState } from 'react';
import { useChat } from '@/lib/chat/ChatContext';
import { ChatMessage } from './ChatMessage';

export function ButteChatSidebar() {
  const { messages, loading, sendMessage, clearChat } = useChat();
  const [input, setInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

  const handleSuggestion = async (suggestion) => {
    try {
      await sendMessage(suggestion);
    } catch (err) {
      console.error('Failed to send suggestion:', err);
    }
  };

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="w-full mx-4 mb-4 px-4 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-mono text-sm font-bold transition-colors"
      >
        Butte AI
      </button>
    );
  }

  return (
    <div className="border-t border-gray-800 px-4 py-4 flex flex-col h-96 bg-gray-900/50">
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-bold text-white font-mono">Butte</h3>
        <button
          onClick={() => setIsExpanded(false)}
          className="text-gray-400 hover:text-white transition-colors text-xs"
        >
          ✕
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto mb-3 space-y-2">
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
              <div className="flex gap-1 items-center justify-start px-2 py-1">
                <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" />
                <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce delay-100" />
                <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce delay-200" />
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="flex gap-1">
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
      </form>

      {/* Clear button */}
      {messages.length > 0 && (
        <button
          onClick={clearChat}
          className="mt-2 text-xs text-gray-500 hover:text-gray-400 transition-colors"
        >
          Clear
        </button>
      )}
    </div>
  );
}
