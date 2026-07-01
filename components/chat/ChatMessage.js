'use client';

export function ChatMessage({ message }) {
  const isUser = message.role === 'user';
  const isError = message.role === 'error';

  if (isError) {
    return (
      <div className="flex justify-center mb-4">
        <div className="max-w-[90%] px-3 py-2 rounded bg-red-900/30 border border-red-600 text-red-200 text-sm font-mono">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex gap-3 mb-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm font-mono ${
          isUser
            ? 'bg-indigo-600 text-white rounded-br-none'
            : 'bg-gray-800 text-gray-100 rounded-bl-none border border-gray-700'
        }`}
      >
        <div className="whitespace-pre-wrap break-words">{message.content}</div>
      </div>
    </div>
  );
}
