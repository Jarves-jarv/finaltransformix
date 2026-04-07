
import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, WorkoutSplit, ActiveProtocol, GeneratedDay, WorkoutSet, Exercise } from '../types';
import { ApiService } from '../services/api';
import { generateFullProtocol, getWorkoutPlan, customizeWorkout } from '../services/geminiService';
import { SplitSystem } from './SplitSystem';
import { ActiveSession } from '../components/ActiveSession';
import {
  History, Dumbbell, Layout, Settings2, RefreshCcw, BrainCircuit, Sparkles,
  ChevronLeft, Play, CheckCircle2, X, Clock, Calendar, AlertTriangle, Loader2, ShieldCheck,
  MessageSquare, Send, User, Bot, Check, ArrowRight, Tag
} from 'lucide-react';

interface Props {
  profile: UserProfile;
  setProfile: (profile: UserProfile) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  setActiveTab: (tab: string) => void;
}

// Algorithmic Coach for Weight Estimation (Cold Start)
const calculateInitialWeight = (profile: UserProfile, exerciseName: string): number => {
  const name = exerciseName.toLowerCase();
  const isMale = profile.gender === 'Male';
  const isAdvanced = profile.experience === 'Advanced';
  const isIntermediate = profile.experience === 'Intermediate';

  let baseWeight = 0;

  if (name.includes('squat') || name.includes('deadlift')) {
    baseWeight = isAdvanced ? 100 : isIntermediate ? 60 : 20;
  }
  else if (name.includes('leg press')) {
    baseWeight = isAdvanced ? 160 : isIntermediate ? 100 : 40;
  }
  else if (name.includes('lunge') || name.includes('split squat') || name.includes('step up')) {
    baseWeight = isAdvanced ? 20 : isIntermediate ? 12.5 : 5;
  }
  else if (name.includes('bench press') && !name.includes('dumbb')) {
    baseWeight = isAdvanced ? 80 : isIntermediate ? 50 : 20;
  }
  else if (name.includes('overhead') && !name.includes('dumbb')) {
    baseWeight = isAdvanced ? 50 : isIntermediate ? 35 : 20;
  }
  else if (name.includes('dumbb') && (name.includes('press'))) {
    if (name.includes('shoulder') || name.includes('overhead')) {
      baseWeight = isAdvanced ? 24 : isIntermediate ? 16 : 6;
    } else {
      baseWeight = isAdvanced ? 32 : isIntermediate ? 22 : 10;
    }
  }
  else if (name.includes('push up')) {
    return 0;
  }
  else if (name.includes('pull up') || name.includes('chin up')) {
    return 0;
  }
  else if (name.includes('lat pull') || name.includes('cable row')) {
    baseWeight = isAdvanced ? 70 : isIntermediate ? 45 : 25;
  }
  else if (name.includes('row') && name.includes('dumbb')) {
    baseWeight = isAdvanced ? 30 : isIntermediate ? 20 : 10;
  }
  else if (name.includes('raise') || name.includes('fly')) {
    baseWeight = isAdvanced ? 12 : isIntermediate ? 8 : 3;
  }
  else if (name.includes('curl') || name.includes('extension') || name.includes('skull')) {
    baseWeight = isAdvanced ? 15 : isIntermediate ? 10 : 5;
  }
  else {
    baseWeight = isAdvanced ? 20 : isIntermediate ? 15 : 5;
  }

  if (!isMale) {
    if (name.includes('squat') || name.includes('deadlift') || name.includes('leg')) {
      baseWeight *= 0.8;
    } else {
      baseWeight *= 0.55;
    }
  }

  if (profile.weight > 90) baseWeight *= 1.1;
  if (profile.weight < 55) baseWeight *= 0.85;

  let finalWeight = Math.max(1, baseWeight);
  if (finalWeight < 12.5) {
    finalWeight = Math.round(finalWeight);
  } else {
    finalWeight = Math.round(finalWeight / 2.5) * 2.5;
  }

  return finalWeight;
};

export const WorkoutSystem: React.FC<Props> = ({ profile, setProfile, showToast, setActiveTab }) => {
  const [loading, setLoading] = useState(true);
  const [activeSplit, setActiveSplit] = useState<WorkoutSplit | null>(null);
  const [activeProtocol, setActiveProtocol] = useState<ActiveProtocol | null>(null);
  const [viewState, setViewState] = useState<'MAIN' | 'CHANGE_SPLIT' | 'HISTORY' | 'DAY_PREVIEW' | 'ACTIVE_SESSION' | 'CUSTOMIZE_PREVIEW'>('MAIN');
  const [history, setHistory] = useState<any[]>([]);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0);
  const [sessionData, setSessionData] = useState<any>(null);

  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
  }, [profile.currentSplitId]);

  useEffect(() => {
    if (viewState === 'CUSTOMIZE_PREVIEW') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, viewState]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (profile.currentSplitId) {
        const [split, protocol] = await Promise.all([
          ApiService.getSplit(profile.currentSplitId),
          ApiService.getActiveProtocol()
        ]);
        setActiveSplit(split || null);
        setActiveProtocol(protocol || null);
      } else {
        setActiveSplit(null);
        setViewState('CHANGE_SPLIT');
      }
    } catch (e) {
      console.error(e);
      showToast("Failed to load workout data", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateFullProtocol = async () => {
    if (!activeSplit) return;
    setLoading(true);
    try {
      if (profile.injuries && profile.injuries.length > 0) {
        showToast(`Applying Safety Filters for: ${profile.injuries.length} conditions`, "info");
      }
      const leave = await ApiService.getRecentLeave();
      let leaveContext = undefined;
      if (leave) {
        leaveContext = `User returning from ${leave.durationDays} days off. Adjust intensity.`;
      }

      const generatedDays = await generateFullProtocol(profile, activeSplit, leaveContext);
      const newProtocol: ActiveProtocol = {
        splitId: activeSplit.id,
        splitName: activeSplit.name,
        generatedAt: Date.now(),
        days: generatedDays,
        currentDayIndex: 0
      };
      await ApiService.saveActiveProtocol(newProtocol);
      setActiveProtocol(newProtocol);
      showToast("Neural Protocol Synthesized", "success");
    } catch (e: any) {
      console.error(e);
      showToast(e.message || "AI Generation Failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleResetCycle = async () => {
    if (!activeProtocol) return;
    await ApiService.updateActiveProtocolDay(activeProtocol.id!, 0);
    setActiveProtocol({ ...activeProtocol, currentDayIndex: 0 });
    showToast("Cycle Reset", "info");
  };

  const openDayPreview = (index: number) => {
    setSelectedDayIndex(index);
    setViewState('DAY_PREVIEW');
  };

  const startCustomization = () => {
    if (!activeProtocol) return;
    const day = activeProtocol.days[selectedDayIndex];
    setChatHistory([{
      role: 'ai',
      text: `I've loaded the ${day.name} protocol. How should we adjust the ${day.muscleGroups.join(' + ')} session today?`,
      plan: day.exercises
    }]);
    setViewState('CUSTOMIZE_PREVIEW');
  };

  const handleCustomizeSubmit = async () => {
    if (!chatInput.trim() || isAnalyzing || !activeProtocol) return;
    const msg = chatInput;
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', text: msg }]);
    setIsAnalyzing(true);
    try {
      const day = activeProtocol.days[selectedDayIndex];
      const lastPlan = chatHistory.slice().reverse().find(m => m.plan)?.plan || day.exercises;
      const result = await customizeWorkout(lastPlan, msg);
      setChatHistory(prev => [...prev, {
        role: 'ai',
        text: result.confirmation,
        plan: result.exercises
      }]);
    } catch (e) {
      setChatHistory(prev => [...prev, { role: 'ai', text: "I encountered an error recalculating the metrics. Please try again." }]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const applyNewPlan = async (newExercises: Exercise[]) => {
    if (!activeProtocol) return;
    const newProtocol = JSON.parse(JSON.stringify(activeProtocol));
    newProtocol.days[selectedDayIndex].exercises = newExercises.map((ex: any) => ({
      ...ex,
      sets: Array(ex.setsCount || 3).fill({ weight: 0, reps: 0, completed: false })
    }));
    await ApiService.saveActiveProtocol(newProtocol);
    setActiveProtocol(newProtocol);
    showToast("Protocol Updated & Synced", "success");
    setViewState('DAY_PREVIEW');
  };

  const startSession = async () => {
    if (!activeProtocol) return;
    setLoading(true);
    try {
      const day = activeProtocol.days[selectedDayIndex];
      const exerciseNames = day.exercises.map(e => e.name);

      const [recentLeave, historyMap] = await Promise.all([
        ApiService.getRecentLeave(),
        ApiService.getHistoryForExercises(exerciseNames)
      ]);

      const isRecovery = !!recentLeave;

      const exercisesWithMath = day.exercises.map(ex => {
        let suggestedWeight = ex.suggestedWeight || '0';
        let numericSuggestion = 0;
        const lastLog = historyMap[ex.name];

        if (lastLog) {
          numericSuggestion = lastLog.weight;
          if (isRecovery) {
            numericSuggestion = Math.round((lastLog.weight * 0.85));
            suggestedWeight = `${numericSuggestion}`;
          } else {
            if (lastLog.reps >= 10) {
              numericSuggestion = lastLog.weight + 2.5;
              suggestedWeight = numericSuggestion.toString();
            } else {
              suggestedWeight = lastLog.weight.toString();
            }
          }
        } else {
          numericSuggestion = calculateInitialWeight(profile, ex.name);
          if (isRecovery) numericSuggestion = Math.round(numericSuggestion * 0.8);
          suggestedWeight = `${numericSuggestion}`;
        }

        return {
          ...ex,
          suggestedWeight,
          lastWeight: lastLog ? lastLog.weight : undefined,
          lastReps: lastLog ? lastLog.reps : undefined,
          isRecovery: isRecovery,
          sets: Array(ex.setsCount || 3).fill({ weight: 0, reps: 0, completed: false })
        };
      });

      setSessionData({
        name: day.name,
        startTime: Date.now(),
        exercises: exercisesWithMath
      });
      setViewState('ACTIVE_SESSION');
      if (isRecovery) showToast(`Recovery Mode: Weights reduced by 15%`, "info");
      else if (Object.keys(historyMap).length === 0) showToast(`New Cycle: AI calibrated starting weights`, "success");
    } catch (e) {
      console.error(e);
      showToast("Error initializing session", "error");
    } finally {
      setLoading(false);
    }
  };

  const completeSession = async () => {
    if (!sessionData || !activeProtocol || !activeSplit) return;
    setLoading(true);
    try {
      const day = activeProtocol.days[selectedDayIndex];
      const workoutLog = {
        name: day.name,
        muscleGroup: day.muscleGroups.join(', '),
        exercises: sessionData.exercises,
        durationMinutes: Math.round((Date.now() - sessionData.startTime) / 60000),
        splitName: activeSplit.name,
        splitId: activeSplit.id
      };
      await ApiService.saveWorkout(workoutLog);

      const nextIndex = (activeProtocol.currentDayIndex + 1) % activeProtocol.days.length;
      await ApiService.updateActiveProtocolDay(activeProtocol.id!, nextIndex);
      setActiveProtocol({ ...activeProtocol, currentDayIndex: nextIndex });

      setViewState('MAIN');
      setSessionData(null);
      showToast("Workout Logged & Cycle Advanced", "success");
    } catch (e) {
      showToast("Failed to save workout", "error");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-full space-y-4">
      <Loader2 className="animate-spin text-indigo-500" size={32} />
      <p className="text-xs font-black uppercase text-zinc-500 tracking-widest">Processing...</p>
    </div>
  );

  if (viewState === 'CHANGE_SPLIT' || !activeSplit) {
    return (
      <SplitSystem
        profile={profile}
        setProfile={setProfile}
        showToast={showToast}
        onComplete={() => { loadData(); setViewState('MAIN'); }}
        onBack={activeSplit ? () => setViewState('MAIN') : undefined}
      />
    );
  }

  if (viewState === 'HISTORY') {
    return (
      <div className="flex flex-col h-full bg-black p-4 animate-in fade-in duration-300 max-w-md mx-auto relative w-full">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-black italic uppercase text-white tracking-tighter">History</h2>
          <button onClick={() => setViewState('MAIN')} className="p-2 bg-zinc-900 rounded-xl text-zinc-400 active:scale-90 transition-all"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-4 scrollbar-hide">
          {history.length === 0 ? (
            <div className="py-20 text-center space-y-4 opacity-40">
              <History size={48} className="mx-auto text-zinc-700" />
              <p className="text-[10px] font-black uppercase tracking-widest">No records found</p>
            </div>
          ) : (
            history.map((w, i) => (
              <div key={i} className="bg-zinc-900/60 p-5 rounded-[2rem] border border-zinc-800 space-y-4 shadow-xl">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <h4 className="text-white font-black uppercase italic tracking-tighter text-base leading-none">{w.name}</h4>
                    <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">{new Date(w.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                  </div>
                  <div className="bg-zinc-800 px-2.5 py-1 rounded-lg text-[10px] font-black text-zinc-400 border border-zinc-700">{w.durationMinutes} min</div>
                </div>

                {w.splitName && (
                  <div className="flex items-center gap-2 bg-black/40 px-3 py-2.5 rounded-xl border border-zinc-800/50">
                    <Tag size={12} className="text-indigo-500" />
                    <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest leading-none">Protocol: <span className="text-white italic">{w.splitName}</span></span>
                  </div>
                )}

                <div className="flex justify-between items-end">
                  <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">{w.muscleGroup}</p>
                  <div className="flex -space-x-2">
                    {w.exercises?.slice(0, 3).map((ex: any, idx: number) => (
                      <div key={idx} className="w-6 h-6 rounded-full bg-zinc-800 border-2 border-zinc-900 flex items-center justify-center text-[7px] font-black text-indigo-500 uppercase italic">
                        {ex.name[0]}
                      </div>
                    ))}
                    {w.exercises?.length > 3 && (
                      <div className="w-6 h-6 rounded-full bg-zinc-800 border-2 border-zinc-900 flex items-center justify-center text-[7px] font-black text-zinc-500">
                        +{w.exercises.length - 3}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  if (viewState === 'ACTIVE_SESSION' && sessionData) {
    return (
      <ActiveSession
        sessionName={sessionData.name}
        exercises={sessionData.exercises}
        onUpdateExercises={(exs) => setSessionData({ ...sessionData, exercises: exs })}
        onFinish={completeSession}
        onCancel={() => { setViewState('MAIN'); setSessionData(null); }}
      />
    );
  }

  if (viewState === 'CUSTOMIZE_PREVIEW') {
    return (
      <div className="fixed inset-0 z-[160] flex flex-col bg-black animate-in slide-in-from-right duration-300 max-w-md mx-auto relative">
        <div className="flex-none pt-[max(1rem,env(safe-area-inset-top))] px-4 pb-4 flex justify-between items-center bg-black/80 backdrop-blur-md border-b border-zinc-900 z-10">
          <button onClick={() => setViewState('DAY_PREVIEW')} className="p-2 bg-zinc-900 rounded-xl text-zinc-400 hover:text-white"><ChevronLeft size={20} /></button>
          <div className="text-center">
            <h2 className="text-xl font-black italic uppercase text-white">AI Architect</h2>
            <p className="text-[8px] font-black uppercase text-indigo-500 tracking-widest">Protocol Recalibration</p>
          </div>
          <div className="w-10"></div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide pb-20">
          {chatHistory.map((msg, i) => (
            <div key={i} className={`flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              {msg.text && (
                <div className={`max-w-[85%] p-3.5 rounded-2xl text-xs font-medium leading-relaxed shadow-lg ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-bl-none'
                  }`}>
                  {msg.text}
                </div>
              )}
              {msg.plan && (
                <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl mt-1 animate-in zoom-in-95">
                  <div className="bg-zinc-800/50 p-2.5 border-b border-zinc-800 flex justify-between items-center">
                    <span className="text-[8px] font-black uppercase text-zinc-400 tracking-widest">Workout Protocol</span>
                    <Sparkles size={12} className="text-indigo-400" />
                  </div>
                  <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
                    {msg.plan.map((ex: Exercise, idx: number) => (
                      <div key={idx} className="bg-black/40 p-2.5 rounded-xl border border-zinc-800/60 flex justify-between items-center">
                        <div>
                          <p className="text-[9px] font-black uppercase text-white truncate w-40">{ex.name}</p>
                          <p className="text-[8px] text-zinc-500">{ex.setsCount} Sets × {ex.reps}</p>
                        </div>
                        <span className="text-[8px] font-black text-indigo-500 bg-indigo-500/10 px-1.5 py-0.5 rounded">{ex.restTime || '60s'}</span>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => applyNewPlan(msg.plan)} className="w-full bg-emerald-600 hover:bg-emerald-500 py-3 text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 text-white transition-colors">
                    <Check size={12} /> Apply this Workout
                  </button>
                </div>
              )}
            </div>
          ))}
          {isAnalyzing && (
            <div className="flex justify-start">
              <div className="bg-zinc-900 p-4 rounded-2xl rounded-bl-none flex gap-1 shadow-md border border-zinc-800">
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"></span>
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
        <div className="p-4 bg-black/90 backdrop-blur-md border-t border-zinc-900">
          <div className="flex gap-2 bg-zinc-900 p-1.5 rounded-2xl border border-zinc-800 focus-within:border-indigo-500 transition-colors shadow-2xl">
            <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCustomizeSubmit()} placeholder="e.g. Swap heavy squats for leg press..." className="flex-1 bg-transparent border-none focus:ring-0 text-xs py-3 px-3 font-bold text-white placeholder:text-zinc-600" />
            <button onClick={handleCustomizeSubmit} disabled={!chatInput.trim() || isAnalyzing} className="bg-indigo-600 p-3 rounded-xl text-white disabled:opacity-30 transition-all hover:bg-indigo-500 shadow-lg">
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (viewState === 'DAY_PREVIEW' && activeProtocol) {
    const day = activeProtocol.days[selectedDayIndex];
    return (
      <div className="fixed inset-0 z-[150] flex flex-col bg-black animate-in slide-in-from-right duration-300 max-w-md mx-auto relative">
        <div className="flex-none pt-[max(1rem,env(safe-area-inset-top))] px-4 pb-4 flex justify-between items-center bg-black/80 backdrop-blur-md border-b border-zinc-900 z-10">
          <button onClick={() => setViewState('MAIN')} className="p-2 bg-zinc-900 rounded-xl text-zinc-400 hover:text-white transition-all active:scale-90"><ChevronLeft size={20} /></button>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black italic uppercase text-white tracking-tighter leading-none">{day.name}</h2>
            <button onClick={startCustomization} className="flex items-center gap-1.5 bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-600 hover:text-white px-3 py-1.5 rounded-lg transition-all ml-2 active:scale-95 group">
              <Sparkles size={12} className="group-hover:text-white" />
              <span className="text-[9px] font-black uppercase tracking-widest">Customise</span>
            </button>
          </div>
          <div className="w-10"></div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-32 scrollbar-hide">
          {day.exercises.map((ex, i) => (
            <div key={i} className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-[2rem] shadow-xl">
              <div className="flex justify-between items-start mb-4">
                <h4 className="text-sm font-black text-white uppercase tracking-tight">{ex.name}</h4>
                <span className="text-[9px] font-bold text-zinc-500 uppercase bg-black px-2 py-1 rounded-lg border border-zinc-800/50">{ex.muscleGroup}</span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-[10px] font-bold text-zinc-400 uppercase mb-3">
                <div className="flex flex-col gap-0.5"><span className="text-zinc-600 text-[8px] tracking-widest">VOLUME</span><span className="text-white">{ex.setsCount} × {ex.reps}</span></div>
                <div className="flex flex-col gap-0.5 text-right"><span className="text-zinc-600 text-[8px] tracking-widest">REST</span><span className="text-white">{ex.restTime || '60s'}</span></div>
                <div className="col-span-2 bg-black/30 p-3 rounded-xl border border-zinc-800/50">
                  <span className="text-zinc-600 text-[8px] tracking-widest block mb-1">COACH TIP</span>
                  <span className="text-indigo-400 normal-case italic font-medium">"{ex.formCue}"</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex-none absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black to-transparent pt-12 pb-[max(1.5rem,env(safe-area-inset-bottom))] px-4 pointer-events-none">
          <div className="pointer-events-auto">
            <button onClick={startSession} className="w-full bg-indigo-600 text-white py-5 rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all">
              <Play size={18} fill="currentColor" /> Start Session
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-black animate-in fade-in h-full relative px-2 max-w-md mx-auto w-full">
      <div className="flex-none pt-4 px-1">
        <div className="flex justify-between items-start mb-4">
          <div className="space-y-1">
            <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">Neural Core</h2>
            <div className="flex items-center gap-2">
              <p className="text-zinc-600 text-[9px] font-black uppercase tracking-[0.3em]">System Operational</p>
              {profile.injuries && profile.injuries.length > 0 && (
                <div className="flex items-center gap-1 bg-rose-950/30 border border-rose-500/20 px-2 py-0.5 rounded-full">
                  <ShieldCheck size={8} className="text-rose-500" />
                  <span className="text-[7px] font-black text-rose-500 uppercase tracking-widest">Health Protocol</span>
                </div>
              )}
            </div>
          </div>
          <button onClick={async () => { setLoading(true); const h = await ApiService.getWorkoutHistory(20); setHistory(h); setViewState('HISTORY'); setLoading(false); }} className="flex items-center gap-2 bg-zinc-900/80 border border-zinc-800 px-4 py-3 rounded-2xl text-[10px] font-black uppercase text-zinc-400 shadow-xl transition-all active:scale-95"><History size={16} className="text-indigo-500" /> History</button>
        </div>
        <button onClick={() => setViewState('CHANGE_SPLIT')} className="w-full text-left bg-gradient-to-br from-indigo-950/40 to-zinc-950 p-5 rounded-[2.5rem] border border-zinc-800 shadow-2xl relative overflow-hidden group mb-4">
          <div className="absolute -top-6 -right-6 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Dumbbell size={120} className="rotate-12" /></div>
          <div className="relative z-10 space-y-3">
            <div className="flex justify-between items-center"><div className="flex items-center gap-4"><div className="p-3 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-600/30 text-white"><Layout size={18} /></div><div className="space-y-0.5"><h4 className="text-xl font-black italic uppercase tracking-tighter text-white">{activeSplit?.name}</h4><p className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.2em]">Active Configuration</p></div></div><Settings2 size={18} className="text-zinc-700 shrink-0" /></div>
          </div>
        </button>
      </div>
      <div className="flex-1 overflow-hidden px-1">
        {activeProtocol && activeProtocol.splitId === activeSplit?.id ? (
          <div className="flex flex-col h-full space-y-2 pb-4">
            <div className="flex justify-between items-end px-1 flex-none">
              <h3 className="text-sm font-black uppercase text-zinc-500 tracking-[0.2em]">Generated Cycle</h3>
              <button onClick={handleResetCycle} className="text-[8px] font-black text-zinc-600 uppercase flex items-center gap-1 hover:text-white"><RefreshCcw size={10} /> Reset</button>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col gap-3 pb-32">
              {activeProtocol.days.map((day, idx) => {
                const isNext = idx === (activeProtocol.currentDayIndex % activeProtocol.days.length);
                return (
                  <button key={idx} onClick={() => openDayPreview(idx)} className={`w-full p-5 rounded-[2rem] border transition-all relative overflow-hidden group text-left shrink-0 ${isNext ? 'bg-zinc-900 border-indigo-500 shadow-xl' : 'bg-zinc-900/40 border-zinc-800/50 opacity-60 hover:opacity-100'}`}>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black italic text-lg ${isNext ? 'bg-indigo-600 text-white shadow-lg' : 'bg-zinc-800 text-zinc-600'}`}>
                          {idx + 1}
                        </div>
                        <div>
                          <h4 className={`text-base font-black uppercase italic tracking-tighter ${isNext ? 'text-white' : 'text-zinc-400'}`}>{day.name}</h4>
                          <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest mt-0.5">{day.muscleGroups.join(' + ')}</p>
                        </div>
                      </div>
                      {isNext && <div className="bg-indigo-600/10 px-3 py-1 rounded-full border border-indigo-500/20 text-[8px] font-black text-indigo-400 uppercase tracking-widest animate-pulse">Next Up</div>}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="py-12 px-6 bg-zinc-900/30 rounded-[2.5rem] border border-zinc-800 border-dashed text-center space-y-4 flex flex-col justify-center items-center h-48">
            <BrainCircuit size={40} className="mx-auto text-zinc-600" />
            <p className="text-[10px] font-black uppercase text-zinc-500 tracking-widest leading-relaxed">No active protocol detected for {activeSplit?.name}.</p>
          </div>
        )}
      </div>
      <div className="fixed bottom-[5.5rem] left-0 right-0 z-30 flex justify-center pointer-events-none px-4">
        <div className="w-full max-w-md pointer-events-auto">
          {activeProtocol && activeProtocol.splitId === activeSplit?.id ? (
            <button onClick={handleGenerateFullProtocol} className="w-full py-4 text-[9px] font-black text-zinc-500 uppercase tracking-widest hover:text-white transition-colors flex items-center justify-center gap-2 border border-dashed border-zinc-800 rounded-2xl hover:border-indigo-500 hover:bg-zinc-900/50 bg-black/80 backdrop-blur-md">
              <Sparkles size={12} /> Regenerate Cycle (AI)
            </button>
          ) : (
            <button onClick={handleGenerateFullProtocol} className="w-full bg-white text-black py-5 rounded-2xl font-black text-xs italic tracking-[0.2em] shadow-2xl active:scale-95 transition-all uppercase flex items-center justify-center gap-2">
              <Sparkles size={16} className="text-indigo-600" /> Generate {activeSplit?.days.length}-Day Cycle
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
