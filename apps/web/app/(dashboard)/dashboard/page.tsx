'use client';

import React, { useState, useRef, useEffect } from 'react';

export default function DashboardPage() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [messageText, setMessageText] = useState('');
  const chatAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const toggleDrawer = () => setIsDrawerOpen((prev) => !prev);

  // Auto-scroll para o final do chat
  useEffect(() => {
    if (chatAreaRef.current) {
      chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
    }
  }, []);

  // Auto-resize do Textarea
  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessageText(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Lógica para enviar mensagem
    }
  };

  return (
    <div className="font-sans text-sm overflow-hidden h-screen flex flex-col md:flex-row bg-[#0b1326] text-[#dae2fd]">
      {/* Overlay para Mobile */}
      <div
        id="drawer-overlay"
        onClick={toggleDrawer}
        className={`fixed inset-0 bg-black/60 z-40 lg:hidden transition-opacity duration-300 ${
          isDrawerOpen ? 'opacity-100 block' : 'opacity-0 hidden'
        }`}
      />

      {/* Sidebar / Navigation Drawer */}
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

        <div className="mt-6 flex-1 flex flex-col gap-4 overflow-y-auto scrollbar-thin scrollbar-thumb-[#5c3f40] scrollbar-track-transparent">
          <div>
            <h3 className="text-[#e5bdbe] font-mono text-xs uppercase tracking-wider mb-3 px-2">
              Attached Files
            </h3>
            <div className="space-y-2">
              {/* Arquivo 1 */}
              <div className="group flex items-center justify-between p-3 rounded-lg bg-[#171f33] hover:bg-[#222a3d] border border-transparent hover:border-[#5c3f40] transition-all">
                <div className="flex items-center gap-3 overflow-hidden">
                  <span className="material-symbols-outlined text-[#b9c8de]">description</span>
                  <div className="flex flex-col overflow-hidden">
                    <span className="font-mono text-xs truncate text-[#dae2fd]">
                      annual_report.pdf
                    </span>
                    <span className="font-mono text-[10px] text-[#e5bdbe]">2.4 MB</span>
                  </div>
                </div>
                <button className="text-[#e5bdbe] hover:text-[#ffb4ab] transition-colors p-1 opacity-0 group-hover:opacity-100">
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              {/* Arquivo 2 */}
              <div className="group flex items-center justify-between p-3 rounded-lg bg-[#171f33] hover:bg-[#222a3d] border border-transparent hover:border-[#5c3f40] transition-all">
                <div className="flex items-center gap-3 overflow-hidden">
                  <span className="material-symbols-outlined text-[#74d8bd]">article</span>
                  <div className="flex flex-col overflow-hidden">
                    <span className="font-mono text-xs truncate text-[#dae2fd]">
                      financials.txt
                    </span>
                    <span className="font-mono text-[10px] text-[#e5bdbe]">12 KB</span>
                  </div>
                </div>
                <button className="text-[#e5bdbe] hover:text-[#ffb4ab] transition-colors p-1 opacity-0 group-hover:opacity-100">
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
            </div>
          </div>

          <div className="mt-auto">
            <nav className="space-y-1">
              <a
                className="flex items-center gap-3 p-3 rounded-lg bg-[#e11d48] text-[#fffaf9] font-bold"
                href="#"
              >
                <span className="material-symbols-outlined">chat</span>
                <span className="font-mono text-xs">Chat</span>
              </a>
              <a
                className="flex items-center gap-3 p-3 rounded-lg text-[#e5bdbe] hover:bg-[#2d3449] hover:text-[#dae2fd] transition-colors"
                href="#"
              >
                <span className="material-symbols-outlined">description</span>
                <span className="font-mono text-xs">Documents</span>
              </a>
              <a
                className="flex items-center gap-3 p-3 rounded-lg text-[#e5bdbe] hover:bg-[#2d3449] hover:text-[#dae2fd] transition-colors"
                href="#"
              >
                <span className="material-symbols-outlined">auto_awesome</span>
                <span className="font-mono text-xs">Templates</span>
              </a>
              <a
                className="flex items-center gap-3 p-3 rounded-lg text-[#e5bdbe] hover:bg-[#2d3449] hover:text-[#dae2fd] transition-colors"
                href="#"
              >
                <span className="material-symbols-outlined">inventory_2</span>
                <span className="font-mono text-xs">Archive</span>
              </a>
            </nav>
          </div>
        </div>
      </aside>

      {/* Área Principal */}
      <main className="flex-1 flex flex-col h-full bg-[#0b1326] relative overflow-hidden">
        {/* TopAppBar */}
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
          <div className="flex items-center gap-2">
            <button className="p-2 text-[#e5bdbe] hover:bg-[#2d3449] rounded-full transition-colors">
              <span className="material-symbols-outlined">search</span>
            </button>
            <button className="p-2 text-[#e5bdbe] hover:bg-[#2d3449] rounded-full transition-colors">
              <span className="material-symbols-outlined">settings</span>
            </button>
          </div>
        </header>

        {/* Chat Container */}
        <div
          ref={chatAreaRef}
          className="flex-1 overflow-y-auto p-4 pt-8 pb-32 scrollbar-thin scrollbar-thumb-[#5c3f40] scrollbar-track-transparent"
          id="chat-area"
        >
          <div className="max-w-[800px] mx-auto space-y-8">
            {/* Separador de Data */}
            <div className="flex justify-center">
              <span className="px-3 py-1 rounded-full bg-[#222a3d] text-[#e5bdbe] font-mono text-xs border border-[#5c3f40]">
                Today
              </span>
            </div>

            {/* Mensagem do Usuário */}
            <div className="flex flex-col items-end gap-2 group">
              <div className="max-w-[85%] bg-[#e11d48] text-[#fffaf9] px-5 py-4 rounded-2xl rounded-tr-none shadow-sm transition-transform active:scale-[0.98]">
                <p className="text-sm">
                  Can you summarize the key findings in the annual report PDF?
                </p>
              </div>
              <span className="font-mono text-xs text-[#e5bdbe] opacity-0 group-hover:opacity-100 transition-opacity">
                10:42 AM
              </span>
            </div>

            {/* Mensagem da IA */}
            <div className="flex flex-col items-start gap-2 group">
              <div className="flex items-start gap-4 max-w-full">
                <div className="w-10 h-10 rounded-xl bg-[#2d3449] flex items-center justify-center border border-[#5c3f40] flex-shrink-0">
                  <span
                    className="material-symbols-outlined text-[#ffb3b6]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    auto_awesome
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="max-w-full bg-[#171f33] text-[#dae2fd] px-5 py-4 rounded-2xl rounded-tl-none border border-[#5c3f40] shadow-sm transition-transform active:scale-[0.98]">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-mono text-xs text-[#ffb3b6] uppercase tracking-widest font-bold">
                        Vermilion IA
                      </span>
                      <span className="w-1 h-1 rounded-full bg-[#5c3f40]" />
                      <span className="font-mono text-xs text-[#e5bdbe]">1.2s</span>
                    </div>
                    <div className="space-y-4 text-sm leading-relaxed">
                      <p>
                        I've analyzed the document. Here are the key takeaways from the{' '}
                        <span className="px-1.5 py-0.5 rounded bg-[#222a3d] text-[#ffb3b6] border border-[#5c3f40] font-mono text-[13px]">
                          annual_report.pdf
                        </span>
                        :
                      </p>
                      <ul className="space-y-2 list-none border-l-2 border-[#ffb3b6]/30 pl-4">
                        <li className="flex gap-2">
                          <span className="text-[#ffb3b6]">•</span>
                          <span>
                            <strong>15% growth</strong> in Q3 revenue year-over-year.
                          </span>
                        </li>
                        <li className="flex gap-2">
                          <span className="text-[#ffb3b6]">•</span>
                          <span>
                            Expansion into <strong>three new territories</strong> (APAC focus).
                          </span>
                        </li>
                        <li className="flex gap-2">
                          <span className="text-[#ffb3b6]">•</span>
                          <span>
                            Reduced operational costs by <strong>8%</strong> through AI
                            automation.
                          </span>
                        </li>
                      </ul>
                      <p>
                        How would you like to proceed? I can create a visualization for these
                        metrics or compare them with last year's data.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 px-2">
                    <button className="flex items-center gap-1.5 text-[#e5bdbe] hover:text-[#ffb3b6] transition-colors font-mono text-xs">
                      <span className="material-symbols-outlined text-[18px]">thumb_up</span>
                    </button>
                    <button className="flex items-center gap-1.5 text-[#e5bdbe] hover:text-[#ffb3b6] transition-colors font-mono text-xs">
                      <span className="material-symbols-outlined text-[18px]">thumb_down</span>
                    </button>
                    <button className="flex items-center gap-1.5 text-[#e5bdbe] hover:text-[#ffb3b6] transition-colors font-mono text-xs">
                      <span className="material-symbols-outlined text-[18px]">content_copy</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Typing Indicator */}
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
          </div>
        </div>

        {/* Input Bar de Chat */}
        <div className="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-[#0b1326] via-[#0b1326] to-transparent pointer-events-none">
          <div className="max-w-[800px] mx-auto pointer-events-auto bg-[#222a3d] border border-[#5c3f40] rounded-[24px] p-2 shadow-xl backdrop-blur-md">
            {/* Anexos em Preview */}
            <div className="flex flex-wrap gap-2 mb-2 px-2 pt-1">
              <div className="flex items-center gap-2 bg-[#2d3449] border border-[#5c3f40] px-3 py-1.5 rounded-full">
                <span className="material-symbols-outlined text-[#ffb3b6] text-[18px]">
                  picture_as_pdf
                </span>
                <span className="font-mono text-xs text-[#dae2fd] truncate max-w-[120px]">
                  report.pdf
                </span>
                <button className="text-[#e5bdbe] hover:text-[#ffb4ab] transition-colors flex items-center">
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>
            </div>
            <div className="flex items-end gap-2 p-1">
              <button
                className="p-3 text-[#e5bdbe] hover:bg-[#2d3449] rounded-full transition-colors flex-shrink-0"
                title="Attach Files"
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
          <div className="text-center mt-3">
            <p className="font-mono text-[10px] text-[#ac8889] opacity-60 uppercase tracking-widest">
              Vermilion v4.0.1 • Context limit 128k
            </p>
          </div>
        </div>
      </main>

      {/* BottomNavBar (Apenas para telas Mobile) */}
      <nav className="lg:hidden fixed bottom-0 left-0 w-full flex justify-around items-center px-4 py-2 bg-[#0b1326] border-t border-[#5c3f40] shadow-lg z-40">
        <div className="flex flex-col items-center justify-center bg-[#e11d48] text-[#fffaf9] rounded-2xl p-2 h-12 w-12 transition-transform scale-95 active:scale-90">
          <span
            className="material-symbols-outlined"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            chat
          </span>
        </div>
        <div className="flex flex-col items-center justify-center text-[#e5bdbe] p-2 h-12 w-12 hover:bg-[#2d3449] rounded-2xl transition-transform active:scale-90">
          <span className="material-symbols-outlined">description</span>
        </div>
        <div className="flex flex-col items-center justify-center text-[#e5bdbe] p-2 h-12 w-12 hover:bg-[#2d3449] rounded-2xl transition-transform active:scale-90">
          <span className="material-symbols-outlined">auto_awesome</span>
        </div>
        <div className="flex flex-col items-center justify-center text-[#e5bdbe] p-2 h-12 w-12 hover:bg-[#2d3449] rounded-2xl transition-transform active:scale-90">
          <span className="material-symbols-outlined">person</span>
        </div>
      </nav>
    </div>
  );
}