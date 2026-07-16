import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Send, Bot, User, Trash2, Sparkles, AlertCircle, Loader2, 
  Mic, MicOff, Volume2, VolumeX, Brain, Search, Sun, Moon, 
  ChevronDown, ChevronUp, ExternalLink, Plus, X, Info
} from "lucide-react";
import { Message } from "../types.ts";

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      sender: "assistant",
      text: "Hello! I am your conversational agent powered by Google Gemini. I am equipped with live search capabilities, voice options, and persistent context memory. How can I assist you today?",
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Custom states for upgraded features
  const [useSearch, setUseSearch] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [isBrainOpen, setIsBrainOpen] = useState(false);
  const [newMemory, setNewMemory] = useState("");
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});

  // Local-Storage secure long-term memories list
  const [memories, setMemories] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("chatbot_ai_memories");
      return saved ? JSON.parse(saved) : [
        "I am interested in AI engineering and Streamlit web tools",
        "I prefer concise, accurate responses with inline explanations"
      ];
    } catch {
      return [];
    }
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Sync memories with local storage
  useEffect(() => {
    localStorage.setItem("chatbot_ai_memories", JSON.stringify(memories));
  }, [memories]);

  // Set up Speech Recognition on mount
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsListening(true);
        setVoiceError(null);
        // Cancel ongoing TTS
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInput(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Speech Recognition Error:", event);
        setIsListening(false);
        
        // "aborted" is fired when we manually call .stop() or .abort() - ignore it completely
        if (event.error === "aborted") {
          return;
        }

        let msg = `Speech recognition error: ${event.error || "unknown"}`;
        if (event.error === "not-allowed") {
          msg = "Microphone access is blocked or not permitted. Because this application is viewed in an iframe preview, please click the 'Open in New Tab' button in the top-right corner of the preview to grant microphone permissions and speak.";
        } else if (event.error === "no-speech") {
          msg = "No speech was detected. Please make sure your microphone is connected and try speaking clearly.";
        } else if (event.error === "audio-capture") {
          msg = "No microphone was found or audio capture failed. Please check your system audio input device.";
        } else if (event.error === "network") {
          msg = "Speech recognition network error. Please check your internet connection.";
        }
        setVoiceError(msg);

        // Auto-dismiss after 6 seconds
        setTimeout(() => {
          setVoiceError((prev) => (prev === msg ? null : prev));
        }, 6000);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  // Text to Speech audio generator
  const speakText = (text: string) => {
    if (!voiceEnabled || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();

    // Simplify text for speech
    const simplified = text
      .replace(/[*#`_\-]/g, "")
      .replace(/\[(.*?)\]\(.*?\)/g, "$1")
      .slice(0, 350); // Guard speaking length

    const utterance = new SpeechSynthesisUtterance(simplified);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  };

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in your current browser.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessageText = input;
    setInput("");
    setError(null);
    stopSpeaking();

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: userMessageText,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Map existing messages to history expected by backend
      const chatHistory = messages
        .filter((m) => m.id !== "welcome" && m.sender !== "system")
        .map((m) => ({
          role: m.sender,
          text: m.text,
        }));

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessageText,
          history: chatHistory,
          useSearch,
          memories,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to get response from server.");
      }

      const botMessage: Message = {
        id: `bot-${Date.now()}`,
        sender: "assistant",
        text: data.response,
        timestamp: Date.now(),
        modelUsed: data.modelUsed,
        sources: data.sources,
      };

      setMessages((prev) => [...prev, botMessage]);

      // Automatically speak the response if voice feedback is enabled
      if (voiceEnabled) {
        speakText(data.response);
      }
    } catch (err: any) {
      console.error("Chat Error:", err);
      setError(err.message || "Something went wrong. Please check your network or API settings.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: "welcome",
        sender: "assistant",
        text: "History cleared. What would you like to talk about now?",
        timestamp: Date.now(),
      },
    ]);
    setError(null);
    stopSpeaking();
  };

  const handleSuggestion = (suggestionText: string) => {
    setInput(suggestionText);
  };

  const handleAddMemory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemory.trim()) return;
    setMemories((prev) => [...prev, newMemory.trim()]);
    setNewMemory("");
  };

  const handleDeleteMemory = (index: number) => {
    setMemories((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleSources = (msgId: string) => {
    setExpandedSources((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const suggestions = [
    "What is artificial intelligence?",
    "Check online for latest news about space exploration",
    "Explain quantum computing simply",
    "Give me 3 tips for writing Python applications"
  ];

  return (
    <div 
      className={`w-full max-w-4xl mx-auto flex flex-col h-[82vh] rounded-2xl border transition-all duration-300 shadow-2xl relative overflow-hidden ${
        isDarkMode 
          ? "bg-slate-900/90 border-slate-700/80 text-slate-100 backdrop-blur-md" 
          : "bg-white/95 border-slate-200/90 text-slate-800 shadow-slate-200/60"
      }`} 
      id="chat-interface-wrapper"
    >
      {/* Header */}
      <div 
        className={`px-6 py-4 flex items-center justify-between border-b transition-all duration-300 ${
          isDarkMode 
            ? "bg-slate-800/60 border-slate-700/70" 
            : "bg-slate-50 border-slate-200"
        }`} 
        id="chat-header"
      >
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg border ${
            isDarkMode ? "bg-blue-500/15 border-blue-500/30 text-blue-400" : "bg-blue-500/10 border-blue-500/20 text-blue-600"
          }`}>
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-bold text-base md:text-lg flex items-center gap-1.5">
              Talk to Your Chatbot! <span className="animate-pulse">🤖</span>
            </h2>
            <p className={`text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"} font-medium`}>
              Dynamic Multi-Tool Assistant
            </p>
          </div>
        </div>
        
        {/* Actions Controls Row */}
        <div className="flex items-center space-x-2">
          {/* Google Search Toggle */}
          <button
            onClick={() => setUseSearch(!useSearch)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all duration-200 ${
              useSearch
                ? isDarkMode
                  ? "bg-blue-500/15 border-blue-500/40 text-blue-400 shadow-sm shadow-blue-500/10"
                  : "bg-blue-50 border-blue-200 text-blue-600"
                : isDarkMode
                  ? "bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200"
                  : "bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200"
            }`}
            title="Toggle Live Google Search Grounding"
            id="search-toggle-btn"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{useSearch ? "Live Search ON" : "Live Search OFF"}</span>
          </button>

          {/* AI Memory Manager Toggle */}
          <button
            onClick={() => setIsBrainOpen(true)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all duration-200 ${
              memories.length > 0
                ? isDarkMode
                  ? "bg-violet-500/15 border-violet-500/40 text-violet-400"
                  : "bg-violet-50 border-violet-200 text-violet-600"
                : isDarkMode
                  ? "bg-slate-800 border-slate-700 text-slate-400"
                  : "bg-slate-100 border-slate-200 text-slate-500"
            }`}
            title="Configure AI Brain Memories"
            id="brain-toggle-btn"
          >
            <Brain className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Memory ({memories.length})</span>
          </button>

          {/* Voice Output Toggle */}
          <button
            onClick={() => {
              const nextVal = !voiceEnabled;
              setVoiceEnabled(nextVal);
              if (!nextVal) stopSpeaking();
            }}
            className={`p-2 rounded-lg border cursor-pointer transition-all duration-200 ${
              voiceEnabled
                ? isDarkMode
                  ? "bg-amber-500/15 border-amber-500/40 text-amber-400"
                  : "bg-amber-50 border-amber-200 text-amber-600"
                : isDarkMode
                  ? "bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200"
                  : "bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200"
            }`}
            title={voiceEnabled ? "Mute Voice Responses" : "Unmute Voice Responses"}
            id="voice-toggle-btn"
          >
            {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Dark / Light Mode Toggle */}
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`p-2 rounded-lg border cursor-pointer transition-all duration-200 ${
              isDarkMode 
                ? "bg-slate-800 border-slate-700 text-amber-400 hover:text-amber-300" 
                : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200"
            }`}
            title="Toggle theme"
            id="theme-toggle-btn"
          >
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Clear Chat */}
          {messages.length > 1 && (
            <button
              onClick={handleClearHistory}
              className={`p-2 rounded-lg border transition-all duration-200 cursor-pointer ${
                isDarkMode 
                  ? "bg-slate-800 hover:bg-rose-500/10 border-slate-700 hover:border-rose-500/30 text-slate-400 hover:text-rose-400" 
                  : "bg-slate-100 hover:bg-rose-50 border-slate-200 hover:border-rose-200 text-slate-500 hover:text-rose-600"
              }`}
              title="Clear Chat History"
              id="clear-btn"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Description Header Notice with contextual details */}
      <div 
        className={`px-6 py-2.5 border-b text-xs transition-all duration-300 ${
          isDarkMode 
            ? "bg-blue-500/5 border-slate-700/40 text-slate-300" 
            : "bg-blue-50/40 border-slate-200 text-slate-600"
        }`} 
        id="chat-description"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
          <span className="font-normal flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
            Demonstrating user-permitted memory context and interactive Google Search grounding.
          </span>
          {voiceEnabled && (
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border self-start sm:self-auto ${
              isSpeaking 
                ? "bg-amber-500/20 border-amber-500/30 text-amber-400 animate-pulse" 
                : "bg-slate-500/10 border-slate-500/20 text-slate-400"
            }`}>
              {isSpeaking ? "🔊 TTS Speaking" : "🔇 TTS Idle"}
            </span>
          )}
        </div>
      </div>

      {/* Message List */}
      <div 
        className={`flex-1 overflow-y-auto px-6 py-6 space-y-6 transition-all duration-300 ${
          isDarkMode ? "bg-slate-900/20" : "bg-slate-50/20"
        }`} 
        id="messages-container"
      >
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.25 }}
              className={`flex items-start gap-4 ${msg.sender === "user" ? "flex-row-reverse" : "flex-row"}`}
              id={`msg-${msg.id}`}
            >
              {/* Avatar */}
              <div className={`p-2 rounded-xl border flex-shrink-0 transition-all duration-300 ${
                msg.sender === "user" 
                  ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-400" 
                  : isDarkMode 
                    ? "bg-slate-800 border-slate-700 text-slate-300" 
                    : "bg-white border-slate-200 text-slate-600 shadow-sm"
              }`}>
                {msg.sender === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              {/* Bubble & Contents */}
              <div className={`flex flex-col max-w-[78%] ${msg.sender === "user" ? "items-end" : "items-start"}`}>
                <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words transition-all duration-300 ${
                  msg.sender === "user"
                    ? "bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-md rounded-tr-none"
                    : isDarkMode
                      ? "bg-slate-800/80 text-slate-200 border border-slate-800 rounded-tl-none"
                      : "bg-white text-slate-800 border border-slate-200/80 rounded-tl-none shadow-sm"
                }`}>
                  {msg.text}
                  
                  {/* Google Search grounding sources rendered beautifully */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className={`mt-3 pt-2 border-t text-xs ${
                      isDarkMode ? "border-slate-700/50" : "border-slate-100"
                    }`}>
                      <button
                        onClick={() => toggleSources(msg.id)}
                        className="flex items-center gap-1.5 text-blue-500 hover:text-blue-400 font-semibold cursor-pointer text-xs"
                      >
                        <Search className="w-3.5 h-3.5" />
                        <span>{expandedSources[msg.id] ? "Hide references" : `View ${msg.sources.length} online references`}</span>
                        {expandedSources[msg.id] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                      
                      <AnimatePresence>
                        {expandedSources[msg.id] && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-2 space-y-1.5 pl-2.5 border-l-2 border-blue-500/30 overflow-hidden"
                          >
                            {msg.sources.map((src, sIdx) => (
                              <a
                                key={sIdx}
                                href={src.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`flex items-center gap-1.5 text-[11px] transition-colors duration-150 ${
                                  isDarkMode ? "text-slate-400 hover:text-blue-400" : "text-slate-600 hover:text-blue-600"
                                }`}
                              >
                                <ExternalLink className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                <span className="truncate max-w-[95%] font-medium hover:underline">{src.title}</span>
                              </a>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>

                {/* Message footer timestamp / source model */}
                <div className="flex items-center gap-1.5 mt-1 px-1 text-[10px] text-slate-500 font-mono">
                  <span>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {msg.modelUsed && (
                    <>
                      <span>•</span>
                      <span className={`px-1.5 py-0.5 rounded border text-[9px] ${
                        isDarkMode 
                          ? "text-blue-400/90 bg-blue-500/5 border-blue-500/10" 
                          : "text-blue-600 bg-blue-50 border-blue-100"
                      }`}>
                        {msg.modelUsed}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Loading Indicator */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-4"
            id="chat-loading-spinner"
          >
            <div className={`p-2 rounded-xl border ${
              isDarkMode ? "bg-slate-800 border-slate-700 text-slate-300" : "bg-white border-slate-200 text-slate-600"
            }`}>
              <Bot className="w-4 h-4" />
            </div>
            <div className={`px-4 py-3 rounded-2xl rounded-tl-none border flex items-center space-x-2.5 ${
              isDarkMode ? "bg-slate-800/30 border-slate-800" : "bg-slate-100/50 border-slate-200"
            }`}>
              <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
              <span className={`text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"} font-medium`}>
                AI is searching and generating response...
              </span>
            </div>
          </motion.div>
        )}

        {/* Error Alert Box */}
        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-3 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-200 text-xs leading-relaxed"
            id="chat-error-alert"
          >
            <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold mb-0.5">Response Generation Failed</p>
              <p className="text-rose-300">{error}</p>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Bottom Suggestion Prompt List */}
      {messages.length === 1 && !isLoading && (
        <div 
          className={`px-6 py-2.5 border-t transition-all duration-300 ${
            isDarkMode ? "border-slate-800 bg-slate-800/20" : "border-slate-100 bg-slate-50/40"
          }`} 
          id="chat-suggestions"
        >
          <div className="text-slate-400 text-xs font-semibold mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Try initiating a conversation with these ideas:</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {suggestions.map((s, idx) => (
              <button
                key={idx}
                onClick={() => handleSuggestion(s)}
                className={`text-left px-3 py-2 text-xs rounded-xl border transition-all duration-200 truncate cursor-pointer font-medium ${
                  isDarkMode 
                    ? "bg-slate-800 hover:bg-slate-750 border-slate-700/60 hover:border-blue-500/40 text-slate-300 hover:text-white" 
                    : "bg-white hover:bg-slate-100 border-slate-200 hover:border-blue-300 text-slate-700 hover:text-blue-600 shadow-sm"
                }`}
                id={`suggestion-btn-${idx}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Voice Recognition Error Alert Banner */}
      <AnimatePresence>
        {voiceError && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className={`mx-4 mb-3 p-2.5 rounded-xl border flex items-start gap-2.5 text-xs transition-all ${
              isDarkMode 
                ? "bg-amber-500/10 border-amber-500/20 text-amber-300" 
                : "bg-amber-50 border-amber-250 text-amber-800"
            }`}
            id="voice-error-alert"
          >
            <Mic className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <span className="flex-1 leading-relaxed">{voiceError}</span>
            <button 
              type="button"
              onClick={() => setVoiceError(null)}
              className={`font-bold hover:opacity-80 px-1 rounded cursor-pointer ${
                isDarkMode ? "text-amber-400" : "text-amber-600"
              }`}
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Form with voice/search indicators */}
      <form 
        onSubmit={handleSend} 
        className={`p-4 border-t flex items-center space-x-3 transition-all duration-300 ${
          isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
        }`} 
        id="chat-input-form"
      >
        {/* Natural Speech Microphone Button */}
        <button
          type="button"
          onClick={toggleListening}
          className={`p-3 rounded-xl border flex-shrink-0 transition-all duration-200 cursor-pointer ${
            isListening
              ? "bg-rose-500/20 border-rose-500/50 text-rose-500 animate-pulse shadow-md shadow-rose-500/10"
              : isDarkMode
                ? "bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600"
                : "bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200 hover:border-slate-300"
          }`}
          title={isListening ? "Listening - Click to stop" : "Start Voice Input (Speech to Text)"}
          id="mic-btn"
        >
          {isListening ? <Mic className="w-4 h-4 animate-bounce" /> : <MicOff className="w-4 h-4" />}
        </button>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isListening ? "Listening... Speak now" : "Ask your question or search query here..."}
          disabled={isLoading}
          className={`flex-1 px-4 py-3 text-sm rounded-xl border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60 disabled:cursor-not-allowed ${
            isDarkMode
              ? "bg-slate-800 border-slate-700 focus:border-blue-500/60 text-slate-100 placeholder-slate-400"
              : "bg-slate-50 border-slate-200 focus:border-blue-400 text-slate-800 placeholder-slate-500"
          }`}
          id="chat-text-input"
        />

        {/* Dynamic submit action button */}
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="px-5 py-3 text-sm bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800/80 text-slate-100 disabled:text-slate-500 font-semibold rounded-xl flex items-center space-x-1.5 shadow-md hover:shadow-lg disabled:shadow-none hover:translate-y-[-1px] active:translate-y-[1px] cursor-pointer disabled:cursor-not-allowed transition-all duration-150"
          id="chat-submit-btn"
        >
          <span>Send</span>
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>

      {/* Sliding Drawer AI Brain / Long-Term Memories Configurator */}
      <AnimatePresence>
        {isBrainOpen && (
          <>
            {/* Backdrop Blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsBrainOpen(false)}
              className="absolute inset-0 bg-black z-40 cursor-pointer"
              id="brain-backdrop"
            />

            {/* Sliding Memory Panel Container */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 20 }}
              className={`absolute right-0 top-0 bottom-0 w-full sm:w-96 z-50 shadow-2xl flex flex-col transition-all duration-300 ${
                isDarkMode ? "bg-slate-900 border-l border-slate-800 text-slate-100" : "bg-white border-l border-slate-200 text-slate-800"
              }`}
              id="brain-drawer"
            >
              {/* Drawer Header */}
              <div className={`px-5 py-4 border-b flex items-center justify-between ${
                isDarkMode ? "border-slate-800" : "border-slate-100"
              }`}>
                <div className="flex items-center space-x-2.5">
                  <Brain className="w-5 h-5 text-violet-400" />
                  <span className="font-bold text-sm md:text-base">AI Brain Memory Panel</span>
                </div>
                <button
                  onClick={() => setIsBrainOpen(false)}
                  className={`p-1 rounded-lg hover:bg-slate-500/10 transition-colors cursor-pointer ${
                    isDarkMode ? "text-slate-400 hover:text-slate-200" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Drawer Helper notice info */}
              <div className={`px-5 py-3 border-b text-[11px] leading-relaxed flex gap-2 ${
                isDarkMode ? "bg-violet-500/5 border-slate-800 text-violet-300/90" : "bg-violet-50 border-slate-100 text-violet-700"
              }`}>
                <Info className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />
                <p>
                  These facts are stored in your secure browser cache. When you chat, they are securely injected as system background context, allowing the AI to retain weeks or months of context!
                </p>
              </div>

              {/* Memory List Scroll Container */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Active Memories ({memories.length})
                  </span>
                  {memories.length > 0 && (
                    <button
                      onClick={() => {
                        if (confirm("Are you sure you want to clear all stored memories?")) {
                          setMemories([]);
                        }
                      }}
                      className="text-[10px] font-bold text-rose-500 hover:underline cursor-pointer"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                {memories.length === 0 ? (
                  <div className="text-center py-8 px-4 border border-dashed border-slate-700/40 rounded-xl">
                    <Brain className="w-8 h-8 text-slate-600 mx-auto mb-2 animate-pulse" />
                    <p className="text-xs text-slate-500">The AI currently has no saved facts about you.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {memories.map((mem, idx) => (
                      <div 
                        key={idx}
                        className={`p-3 rounded-xl text-xs flex items-start justify-between gap-3 border transition-all duration-200 ${
                          isDarkMode 
                            ? "bg-slate-800/40 border-slate-800 hover:border-slate-700 text-slate-300" 
                            : "bg-slate-50 border-slate-100 hover:border-slate-200 text-slate-700"
                        }`}
                      >
                        <span className="flex-1 leading-relaxed">{mem}</span>
                        <button
                          onClick={() => handleDeleteMemory(idx)}
                          className="text-slate-400 hover:text-rose-500 p-0.5 rounded cursor-pointer transition-colors"
                          title="Delete memory item"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add New Memory Form */}
              <form 
                onSubmit={handleAddMemory} 
                className={`p-4 border-t ${
                  isDarkMode ? "bg-slate-900/60 border-slate-800" : "bg-slate-50 border-slate-100"
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newMemory}
                    onChange={(e) => setNewMemory(e.target.value)}
                    placeholder="E.g. I prefer Python code examples"
                    className={`flex-1 px-3 py-2 text-xs rounded-lg border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 ${
                      isDarkMode
                        ? "bg-slate-800 border-slate-700 text-slate-100 placeholder-slate-500 focus:border-violet-500/60"
                        : "bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-violet-400"
                    }`}
                  />
                  <button
                    type="submit"
                    disabled={!newMemory.trim()}
                    className="p-2 bg-violet-600 hover:bg-violet-500 text-white disabled:bg-slate-800/80 disabled:text-slate-500 rounded-lg flex items-center justify-center cursor-pointer transition-colors"
                    title="Save memory"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
