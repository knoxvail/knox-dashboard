'use client';

import { useRef, useEffect } from 'react';
import { useState } from 'react';
import { useChat } from '@/lib/chat/ChatContext';
import { ChatMessage } from './ChatMessage';

export function ChatSidebar() {
  const { messages, loading, error, sendMessage, clearChat } = useChat();
  const [input, setInput] = useState('');
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

  return (
    <div className="w-80 bg-gray-900 border-l border-gray-800 shadow-xl flex flex-col">
            {/* Header */}
            <div className="flex-shrink-0 px-4 py-4 border-b border-gray-800">
              <h2 className="text-lg font-bold text-white font-mono">AI Analyst</h2>
            </div>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
              {messages.length === 0 ? (
                <div className="text-center text-gray-500 text-sm mt-8">
                  <p className="mb-4">Ask questions about your portfolio</p>
                  <p className="text-xs text-gray-600">Market insights • Deal analysis • Prioritization</p>
                </div>
              ) : (
                <>
                  {messages.map((msg) => (
                    <ChatMessage key={msg.id} message={msg} />
                  ))}
                  {loading && (
                    <div className="flex justify-start mb-4">
                      <div className="bg-gray-800 text-gray-100 rounded-lg rounded-bl-none px-3 py-2">
                        <div className="flex gap-2 items-center">
                          <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
                          <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-100" />
                          <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-200" />
                        </div>
                      </div>
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
                <div className="flex-shrink-0 px-4 py-3 border-t border-gray-800">
                  <div className="text-xs text-gray-500 mb-2">Suggestions:</div>
                  <div className="space-y-2">
                    {messages[messages.length - 1].suggestions.map((suggestion, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSuggestion(suggestion)}
                        className="w-full text-left text-xs bg-gray-800 hover:bg-gray-700 text-gray-100 px-3 py-2 rounded border border-gray-700 hover:border-gray-600 transition-colors font-mono"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}

            {/* Input area */}
            <div className="flex-shrink-0 px-4 py-4 border-t border-gray-800">
              <form onSubmit={handleSend} className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask me anything..."
                  disabled={loading}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-600 disabled:opacity-50 font-mono"
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-700 text-white rounded px-3 py-2 transition-colors disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5.951-1.429 5.951 1.429a1 1 0 001.169-1.409l-7-14z" />
                  </svg>
                </button>
              </form>

              {/* Clear button */}
              {messages.length > 0 && (
                <button
                  onClick={clearChat}
                  className="mt-2 w-full text-xs text-gray-500 hover:text-gray-400 transition-colors"
                >
                  Clear chat
                </button>
              )}
            </div>
          </div>
  );
}
