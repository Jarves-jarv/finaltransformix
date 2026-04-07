
import React, { useState } from 'react';
import { ChevronRight, BrainCircuit, CheckCircle2, Save, X, Timer, Sparkles, Loader2, Send, History, Target, AlertTriangle, Check } from 'lucide-react';
import { Exercise, WorkoutSet } from '../types';
import { customizeWorkout } from '../services/geminiService';

interface ActiveSessionProps {
  sessionName: string;
  exercises: Exercise[];
  onUpdateExercises: (exercises: Exercise[]) => void;
  onFinish: () => void;
  onCancel: () => void;
}

export const ActiveSession: React.FC<ActiveSessionProps> = ({
  sessionName,
  exercises,
  onUpdateExercises,
  onFinish,
  onCancel
}) => {
  const [activeIdx, setActiveIdx] = useState(0);
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  const updateSet = (exIdx: number, sIdx: number, field: keyof WorkoutSet, value: any) => {
    const newExercises = [...exercises];
    const exercise = newExercises[exIdx];
    const newSets = [...exercise.sets];

    newSets[sIdx] = { ...newSets[sIdx], [field]: value };

    // If completing a set, ensure weight/reps are valid numbers
    if (field === 'completed' && value === true) {
      if (!newSets[sIdx].weight) newSets[sIdx].weight = 0;
      if (!newSets[sIdx].reps) newSets[sIdx].reps = 0;
    }

    exercise.sets = newSets;
    onUpdateExercises(newExercises);
  };

  const handleAiCustomize = async () => {
    if (!aiPrompt.trim()) return;
    setIsAiLoading(true);
    try {
      const result = await customizeWorkout(exercises, aiPrompt);
      if (result && result.exercises) {
        // Merge new plan with existing state to preserve logged sets if exercise name matches
        const updatedExercises = result.exercises.map((newEx: any) => {
          const existing = exercises.find(e => e.name === newEx.name);
          if (existing) return existing;
          return {
            ...newEx,
            sets: Array(newEx.setsCount || 3).fill({ weight: 0, reps: 0, completed: false })
          };
        });
        onUpdateExercises(updatedExercises);
        setShowAIModal(false);
        setAiPrompt('');
      }
    } catch (e) {
      console.error("AI Customization failed", e);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleFinish = () => {
    onFinish();
  };

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-black animate-in fade-in duration-300 max-w-md mx-auto relative">
      {/* Header - Fixed Top with Safe Area Support */}
      <div className="flex-none pt-[max(1rem,env(safe-area-inset-top))] px-4 pb-4 flex justify-between items-center bg-black/90 backdrop-blur-md border-b border-zinc-900 z-20">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex items-center gap-2 text-red-500 animate-pulse shrink-0">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            <span className="text-[10px] font-black uppercase tracking-widest">Live</span>
          </div>
          <div className="h-4 w-[1px] bg-zinc-800 shrink-0"></div>
          <h2 className="text-sm font-black italic uppercase text-white truncate max-w-[120px]">{sessionName}</h2>

          <button
            onClick={() => setShowAIModal(true)}
            className="flex items-center gap-1.5 bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-600 hover:text-white px-3 py-1.5 rounded-lg transition-all active:scale-95 group ml-2 shrink-0"
          >
            <Sparkles size={12} className="group-hover:text-white" />
            <span className="text-[9px] font-black uppercase tracking-widest whitespace-nowrap">Customise using AI</span>
          </button>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={onCancel}
            className="text-[10px] font-black uppercase text-zinc-600 hover:text-white bg-zinc-900 px-3 py-1.5 rounded-lg transition-colors border border-zinc-800"
          >
            End
          </button>
        </div>
      </div>

      {/* Main List - Scrollable Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-32 scrollbar-hide">
        {exercises.map((ex, exIdx) => {
          const isActive = activeIdx === exIdx;
          const isCompleted = ex.sets.every(s => s.completed);

          return (
            <div
              key={exIdx}
              id={`exercise-${exIdx}`}
              className={`rounded-[2rem] border transition-all duration-500 overflow-hidden ${isActive
                  ? 'bg-zinc-900 border-indigo-500/50 shadow-2xl scale-[1.01]'
                  : isCompleted
                    ? 'bg-zinc-900/40 border-emerald-500/20 opacity-60'
                    : 'bg-zinc-900/40 border-zinc-800'
                }`}
              onClick={() => setActiveIdx(exIdx)}
            >
              {/* Exercise Header */}
              <div className={`p-4 flex justify-between items-center ${isActive ? 'bg-indigo-600/5' : ''}`}>
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 flex items-center justify-center rounded-xl text-sm font-black transition-colors ${isActive ? 'bg-indigo-600 text-white shadow-lg' : isCompleted ? 'bg-emerald-500/20 text-emerald-500' : 'bg-zinc-800 text-zinc-600'
                    }`}>
                    {exIdx + 1}
                  </div>
                  <div>
                    <h3 className={`font-black text-sm italic uppercase leading-tight ${isActive ? 'text-white' : 'text-zinc-400'}`}>
                      {ex.name}
                    </h3>
                    <p className="text-[9px] font-black text-zinc-600 uppercase mt-1 tracking-wider">
                      {ex.muscleGroup} • {ex.sets.length} Sets
                    </p>
                  </div>
                </div>
                {isActive ? (
                  <ChevronRight size={20} className="text-indigo-500 rotate-90 transition-transform" />
                ) : isCompleted ? (
                  <CheckCircle2 size={20} className="text-emerald-500" />
                ) : (
                  <ChevronRight size={20} className="text-zinc-700" />
                )}
              </div>

              {/* Active Expanded View */}
              {isActive && (
                <div className="px-4 pb-6 space-y-5 animate-in slide-in-from-top-2">

                  {/* AI Tip */}
                  {ex.formCue && (
                    <div className="bg-indigo-500/10 p-3 rounded-2xl border border-indigo-500/10 flex gap-3 items-start">
                      <div className="bg-indigo-500/20 p-1.5 rounded-lg text-indigo-400 shrink-0">
                        <BrainCircuit size={14} />
                      </div>
                      <div>
                        <span className="text-[7px] font-black text-indigo-500 uppercase tracking-widest block mb-0.5">AI Coach Cue</span>
                        <p className="text-[11px] text-zinc-300 font-medium italic leading-snug">"{ex.formCue}"</p>
                      </div>
                    </div>
                  )}

                  {/* Comparative Stats Row */}
                  <div className={`grid grid-cols-2 gap-3 ${ex.isRecovery ? 'bg-amber-500/5 border border-amber-500/20' : 'bg-zinc-950/80 border border-zinc-800'} p-3 rounded-2xl`}>
                    {/* Last Time */}
                    <div className="flex items-center gap-3 border-r border-zinc-800 pr-2">
                      <div className="p-2 bg-zinc-900 rounded-lg text-zinc-500"><History size={14} /></div>
                      <div>
                        <span className="text-[7px] font-black uppercase tracking-widest text-zinc-500 block mb-0.5">Last Time</span>
                        {ex.lastWeight ? (
                          <span className="text-[10px] font-black text-zinc-300">{ex.lastWeight}kg x {ex.lastReps || '-'}</span>
                        ) : (
                          <span className="text-[10px] font-black text-zinc-600 italic">No Data</span>
                        )}
                      </div>
                    </div>

                    {/* Recommended / Recovery */}
                    <div className="flex items-center gap-3 pl-1">
                      <div className={`p-2 rounded-lg ${ex.isRecovery ? 'bg-amber-500/20 text-amber-500' : 'bg-indigo-600/20 text-indigo-500'}`}>
                        {ex.isRecovery ? <AlertTriangle size={14} /> : <Target size={14} />}
                      </div>
                      <div>
                        <span className={`text-[7px] font-black uppercase tracking-widest block mb-0.5 ${ex.isRecovery ? 'text-amber-500' : 'text-indigo-500'}`}>
                          {ex.isRecovery ? 'Recovery Load' : 'Target'}
                        </span>
                        <span className="text-[10px] font-black text-white">{ex.suggestedWeight || 0}kg x {ex.reps || '8-12'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 pt-1">
                    <div className="grid grid-cols-[30px_1fr_1fr_70px] gap-2 px-1 text-[9px] font-black uppercase text-zinc-600 tracking-widest text-center">
                      <span>Set</span>
                      <span>Kg</span>
                      <span>Reps</span>
                      <span>Log</span>
                    </div>
                    {ex.sets.map((set, sIdx) => {
                      // PROGRESSIVE DISCLOSURE: Only show if it's the first set OR previous set is completed
                      const isOpen = sIdx === 0 || ex.sets[sIdx - 1].completed;

                      if (!isOpen) return null;

                      return (
                        <div key={sIdx} className={`grid grid-cols-[30px_1fr_1fr_70px] gap-2 items-center p-1.5 rounded-xl border transition-all animate-in slide-in-from-top-2 duration-300 ${set.completed
                            ? 'bg-emerald-500/5 border-emerald-500/20'
                            : 'bg-zinc-950 border-zinc-800'
                          }`}>
                          <div className="text-center">
                            <span className={`text-xs font-black ${set.completed ? 'text-emerald-500' : 'text-zinc-500'}`}>{sIdx + 1}</span>
                          </div>

                          <div className="relative">
                            <input
                              type="number"
                              placeholder={ex.suggestedWeight || '0'}
                              value={set.weight || ''}
                              onChange={(e) => updateSet(exIdx, sIdx, 'weight', parseFloat(e.target.value))}
                              onClick={(e) => e.stopPropagation()}
                              className={`w-full bg-zinc-900 border border-zinc-800 rounded-lg py-3 text-center text-sm font-bold text-white focus:border-indigo-500 outline-none placeholder:font-medium transition-all ${set.completed ? 'opacity-50 text-emerald-500' : ''
                                } ${ex.isRecovery ? 'placeholder:text-amber-500/40 focus:border-amber-500/50' : 'placeholder:text-zinc-700'}`}
                            />
                          </div>

                          <div className="relative">
                            <input
                              type="number"
                              placeholder={ex.reps ? ex.reps.toString().split('-')[0] : '0'}
                              value={set.reps || ''}
                              onChange={(e) => updateSet(exIdx, sIdx, 'reps', parseFloat(e.target.value))}
                              onClick={(e) => e.stopPropagation()}
                              className={`w-full bg-zinc-900 border border-zinc-800 rounded-lg py-3 text-center text-sm font-bold text-white focus:border-indigo-500 outline-none placeholder:font-medium transition-all ${set.completed ? 'opacity-50 text-emerald-500' : ''
                                } ${ex.isRecovery ? 'placeholder:text-amber-500/40 focus:border-amber-500/50' : 'placeholder:text-zinc-700'}`}
                            />
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateSet(exIdx, sIdx, 'completed', !set.completed);
                            }}
                            className={`h-[46px] rounded-lg flex items-center justify-center transition-all font-black text-[10px] uppercase tracking-widest ${set.completed
                                ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20 w-full'
                                : 'bg-indigo-600 text-white w-full shadow-lg shadow-indigo-600/20 hover:scale-105 active:scale-95'
                              }`}
                          >
                            {set.completed ? <CheckCircle2 size={20} /> : 'LOG'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer Actions - Fixed Bottom */}
      <div className="absolute bottom-0 left-0 right-0 z-[100] bg-gradient-to-t from-black via-black to-transparent pt-12 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pointer-events-none">
        <div className="pointer-events-auto max-w-md mx-auto w-full">
          <button
            onClick={handleFinish}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-5 rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-600/20 flex items-center justify-center gap-3 active:scale-95 transition-all"
          >
            <Save size={18} /> Finish Session
          </button>
        </div>
      </div>

      {/* AI Customization Modal */}
      {showAIModal && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/90 backdrop-blur-md p-6 animate-in fade-in duration-300">
          <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-6 space-y-6 relative shadow-2xl animate-in slide-in-from-bottom-10">
            <button onClick={() => setShowAIModal(false)} className="absolute top-5 right-5 text-zinc-500 hover:text-white p-2 bg-zinc-800 rounded-full"><X size={16} /></button>

            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-lg shadow-indigo-600/30"><Sparkles size={20} /></div>
              <div>
                <h3 className="text-xl font-black italic uppercase text-white tracking-tight">Modify Session</h3>
                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Real-time AI Adjustment</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase text-zinc-500 tracking-widest ml-1">Your Request</label>
              <textarea
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                placeholder="e.g. My shoulder hurts, replace pushing movements..."
                className="w-full bg-black border border-zinc-800 rounded-2xl p-4 text-xs font-bold text-white h-32 resize-none focus:border-indigo-500 outline-none placeholder:text-zinc-700"
              />
            </div>

            <button
              onClick={handleAiCustomize}
              disabled={isAiLoading || !aiPrompt.trim()}
              className="w-full bg-indigo-600 text-white py-5 rounded-[2rem] font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/20 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
            >
              {isAiLoading ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
              {isAiLoading ? 'Recalibrating...' : 'Apply this Workout'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
