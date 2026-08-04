'use client';

import React, { useState, useRef, useEffect } from 'react';

type Message = {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
};

export default function DashboardPage() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const chatAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleDrawer = () => setIsDrawerOpen((prev) => !prev);

  useEffect(() => {
    if (chatAreaRef.current) {
      chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessageText(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSendMessage = async () => {
    if ((!messageText.trim() && !selectedFile) || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: selectedFile ? `Attached: ${selectedFile.name} | ${messageText}` : messageText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);

    // Reset inputs
    setMessageText('');
    setSelectedFile(null);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setIsLoading(true);

    try {
      const formData = new FormData();

      formData.append('user_id', 'user_123');
      formData.append('message', userMessage.text);

      if (selectedFile) {
        formData.append('file', selectedFile);
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BFF_URL}/chat`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: data.response || data[1] || 'I received your message, but I could not parse the response.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: 'Sorry, I encountered an error while processing your request.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="font-sans text-sm overflow-hidden h-screen flex flex-col md:flex-row bg-[#0b1326] text-[#dae2fd]">
      <div
        id="drawer-overlay"
        onClick={toggleDrawer}
        className={`fixed inset-0 bg-black/60 z-40 lg:hidden transition-opacity duration-300 ${
          isDrawerOpen ? 'opacity-100 block' : 'opacity-0 hidden'
        }`}
      />

      <aside
        id="mobile-drawer"
        className={`fixed inset-y-0 left-0 z-50 w-[280px] lg:translate-x-0 lg:static flex flex-col transition-transform duration-300 ease-in-out bg-[#131b2e] border-r border-[#5c3f40] p-4 gap-4 ${
          isDrawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <span className="text-2xl font-bold text-[#ffb3b6]">Vermilion</span>
          <button
            className="lg:hidden text-[#e5bdbe] hover:text-[#dae2fd]"
            onClick={toggleDrawer}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <button className="w-full flex items-center justify-center gap-2 bg-[#e11d48] text-[#fffaf9] rounded-lg font-bold py-3 px-4 transition-all duration-200 hover:brightness-110 active:scale-95">
          <span className="material-symbols-outlined">add</span>
          <span className="font-mono text-xs">New Chat</span>
        </button>
      </aside>

      <main className="flex-1 flex flex-col h-full bg-[#0b1326] relative overflow-hidden">
        <header className="flex justify-between items-center px-4 h-16 w-full border-b border-[#5c3f40] bg-[#0b1326] lg:bg-[#0b1326]/80 lg:backdrop-blur-md z-30">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-2 -ml-2 text-[#e5bdbe] hover:bg-[#2d3449] rounded-full transition-colors"
              onClick={toggleDrawer}
            >
              <span className="material-symbols-outlined">menu</span>
            </button>
            <h1 className="text-2xl font-bold text-[#dae2fd]">Vermilion</h1>
          </div>
        </header>

        <div
          ref={chatAreaRef}
          className="flex-1 overflow-y-auto p-4 pt-8 pb-32 scrollbar-thin scrollbar-thumb-[#5c3f40] scrollbar-track-transparent"
          id="chat-area"
        >
          <div className="max-w-[800px] mx-auto space-y-8">
            {messages.map((message) => (
              <div key={message.id} className={`flex flex-col gap-2 group ${message.sender === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[85%] px-5 py-4 rounded-2xl ${message.sender === 'user' ? 'bg-[#e11d48] text-[#fffaf9] rounded-tr-none' : 'bg-[#171f33] text-[#dae2fd] rounded-tl-none border border-[#5c3f40]'}`}>
                  <p className="text-sm">{message.text}</p>
                </div>
                <span className="font-mono text-xs text-[#e5bdbe] opacity-0 group-hover:opacity-100 transition-opacity">
                  {message.timestamp}
                </span>
              </div>
            ))}

            {isLoading && (
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-[#2d3449] flex items-center justify-center border border-[#5c3f40] flex-shrink-0">
                  <span
                    className="material-symbols-outlined text-[#ffb3b6]/50"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    auto_awesome
                  </span>
                </div>
                <div className="bg-[#171f33] px-4 py-3 rounded-2xl rounded-tl-none border border-[#5c3f40] flex gap-1.5 items-center h-10 self-center">
                  <span className="w-1.5 h-1.5 bg-[#5c3f40] rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 bg-[#5c3f40] rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 bg-[#5c3f40] rounded-full animate-bounce" />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-[#0b1326] via-[#0b1326] to-transparent pointer-events-none">
          <div className="max-w-[800px] mx-auto pointer-events-auto bg-[#222a3d] border border-[#5c3f40] rounded-[24px] p-2 shadow-xl backdrop-blur-md">

            {selectedFile && (
              <div className="flex flex-wrap gap-2 mb-2 px-2 pt-1">
                <div className="flex items-center gap-2 bg-[#2d3449] border border-[#5c3f40] px-3 py-1.5 rounded-full">
                  <span className="material-symbols-outlined text-[#ffb3b6] text-[18px]">
                    description
                  </span>
                  <span className="font-mono text-xs text-[#dae2fd] truncate max-w-[120px]">
                    {selectedFile.name}
                  </span>
                  <button
                    onClick={() => setSelectedFile(null)}
                    className="text-[#e5bdbe] hover:text-[#ffb4ab] transition-colors flex items-center"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-end gap-2 p-1">
              <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
              <button
                className="p-3 text-[#e5bdbe] hover:bg-[#2d3449] rounded-full transition-colors flex-shrink-0"
                title="Attach Files"
                onClick={() => fileInputRef.current?.click()}
              >
                <span className="material-symbols-outlined">attach_file</span>
              </button>
              <textarea
                ref={textareaRef}
                value={messageText}
                onChange={handleTextareaInput}
                onKeyDown={handleKeyDown}
                className="flex-1 bg-transparent border-none focus:outline-none focus:ring-0 text-[#dae2fd] placeholder-[#e5bdbe]/60 py-3 px-1 text-sm resize-none max-h-48 scrollbar-thin scrollbar-thumb-[#5c3f40]"
                placeholder="Ask a question about your documents..."
                rows={1}
              />
              <button
                className="p-3 bg-[#ffb3b6] text-[#68001a] rounded-full hover:brightness-110 active:scale-90 transition-all flex-shrink-0 shadow-lg"
                title="Send message"
                onClick={handleSendMessage}
                disabled={isLoading}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  send
                </span>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}