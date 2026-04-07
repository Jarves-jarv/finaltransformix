
import React, { useState, useRef, useEffect } from 'react';
import { UserProfile } from '../types';
import { getAIResponse } from '../services/geminiService';
import { ApiService } from '../services/api';
import { Send, Sparkles, Mic, ChevronRight, BrainCircuit } from 'lucide-react';

interface Props { profile: UserProfile; }

export const Assistant: React.FC<Props> = ({ profile }) => {
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', text: string }[]>([
    { role: 'ai', text: `Hi there! I'm your Transformix AI assistant. How can I help with your ${profile.goal} journey today?` }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [context, setContext] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load all user data to build the AI context
  useEffect(() => {
    const loadContext = async () => {
      try {
        const [workouts, meals, progress, protocol, diet] = await Promise.all([
          ApiService.getWorkoutHistory(20),
          ApiService.getMealHistory(20),
          ApiService.getWeightHistory(),
          ApiService.getActiveProtocol(),
          ApiService.getActiveDiet()
        ]);

        const fullContext = `
          You are Transformix AI, an elite hyper-personalized fitness coach.
          You have access to the user's complete fitness data provided below. Use this to provide highly specific, data-driven advice.

          USER PROFILE:
          ${JSON.stringify(profile)}

          WORKOUT HISTORY (Last 20 sessions):
          ${JSON.stringify(workouts)}

          NUTRITION LOGS (Last 20 meals):
          ${JSON.stringify(meals)}

          BODY METRICS & PROGRESS:
          ${JSON.stringify(progress)}

          CURRENT ACTIVE PROTOCOL:
          ${JSON.stringify(protocol)}

          CURRENT DIET PLAN:
          ${JSON.stringify(diet)}

          GUIDELINES:
          1. Reference specific numbers (e.g., "I see you lifted 20kg on bench press last week" or "You've been consistent with protein").
          2. Be encouraging, precise, and tactical. Avoid generic advice.
          3. If the user asks about their progress, analyze the provided history trends.
          4. Keep responses concise (under 3-4 sentences unless detailed analysis is requested).
        `;
        setContext(fullContext);
      } catch (e) {
        console.error("Failed to load context for AI", e);
      }
    };
    loadContext();
  }, [profile]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input || isLoading) return;
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);

    try {
      const history = messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }]
      }));
      // Pass the fully loaded context to the AI service
      const response = await getAIResponse(userMsg, history, context);
      setMessages(prev => [...prev, { role: 'ai', text: response }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'ai', text: "Sorry, I had a mental glitch. Can you ask that again?" }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    // We break out of the parent layout padding using negative margins (-m-4) to create a full-bleed experience.
    <div className="flex flex-col flex-1 -m-4 bg-black relative max-w-md mx-auto w-[calc(100%+2rem)]">

      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-black/95 backdrop-blur-xl border-b border-zinc-900 px-5 py-4 flex items-center gap-3 shadow-lg shrink-0">
        <div className="bg-indigo-600/20 p-2 rounded-xl shadow-lg border border-indigo-500/20"><BrainCircuit size={18} className="text-indigo-500" /></div>
        <div>
          <h3 className="font-black italic uppercase tracking-tighter text-white text-sm">AI Coach</h3>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
            <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Neural Link Active</span>
          </div>
        </div>
      </div>

      {/* Messages Area - Fills remaining space, allowing scrolling above the sticky footer */}
      <div className="flex-1 p-4 space-y-6 pb-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
            <div className={`max-w-[85%] p-4 rounded-[1.8rem] text-xs font-medium leading-relaxed shadow-xl ${m.role === 'user'
                ? 'bg-indigo-600 text-white rounded-br-none border border-indigo-500/50'
                : 'bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-bl-none'
              }`}>
              {m.text}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start animate-pulse">
            <div className="bg-zinc-900 p-4 rounded-[1.8rem] rounded-bl-none flex gap-1.5 border border-zinc-800">
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"></span>
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area - Sticky Bottom */}
      <div className="sticky bottom-0 z-30 bg-black/95 backdrop-blur-xl border-t border-zinc-900 p-4 pt-3 pb-6">

        {/* Suggestions */}
        {messages.length < 5 && !isLoading && (
          <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
            {[
              'Swap Bench Press',
              'High-Protein Snacks',
              'Update Weight',
              'Overtraining?'
            ].map(s => (
              <button
                key={s}
                onClick={() => setInput(s)}
                className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 px-3 py-2 rounded-full text-[9px] font-black uppercase tracking-widest text-zinc-500 whitespace-nowrap flex items-center gap-1 transition-all active:scale-95 shadow-md flex-shrink-0"
              >
                {s} <ChevronRight size={10} className="text-indigo-500" />
              </button>
            ))}
          </div>
        )}

        {/* Input Bar */}
        <div className="flex items-center gap-2 bg-zinc-900 p-1.5 rounded-[2rem] border border-zinc-800 focus-within:border-indigo-500/50 transition-all shadow-2xl">
          <button className="p-3 rounded-full text-zinc-500 hover:text-indigo-400 transition-colors active:scale-90 flex-shrink-0">
            <Mic size={18} />
          </button>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Ask your AI Coach..."
            className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-bold text-white placeholder:text-zinc-600 px-2 min-w-0 h-full py-2"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="bg-indigo-600 p-3 rounded-full text-white shadow-lg shadow-indigo-600/30 disabled:opacity-20 disabled:grayscale transition-all active:scale-95 flex-shrink-0 hover:bg-indigo-500"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};
