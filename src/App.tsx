import ChatInterface from "./components/ChatInterface.tsx";

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 md:p-8 selection:bg-indigo-500/30 selection:text-indigo-200" id="app-root-container">
      {/* Decorative gradient glowing spots (subtle, clean, elegant) */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full filter blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full filter blur-[120px] pointer-events-none" />
      
      <main className="w-full flex justify-center z-10" id="main-content">
        <ChatInterface />
      </main>
    </div>
  );
}
