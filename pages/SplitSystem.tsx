
import React, { useState, useMemo, useEffect } from 'react';
import { UserProfile, WorkoutSplit, TrainingStyle, ExperienceLevel, FitnessGoal } from '../types';
import { ApiService } from '../services/api';
import { optimizeSplit } from '../services/geminiService';
import {
  ChevronLeft, Dumbbell, Zap, Sparkles, Target,
  ArrowRight, Check, BrainCircuit,
  Plus, X, Loader2, Info, Tag, Trash2, Library
} from 'lucide-react';

interface Props {
  profile: UserProfile;
  setProfile: (p: UserProfile) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onComplete: () => void;
  onBack?: () => void;
}

const CORE_SPLITS: WorkoutSplit[] = [
  {
    id: 'ppl',
    name: 'Push Pull Legs (PPL)',
    daysPerWeek: 6,
    style: TrainingStyle.HYPERTROPHY,
    level: ExperienceLevel.INTERMEDIATE,
    avgTime: 60,
    isCustom: false,
    aiOptimized: true,
    category: FitnessGoal.MUSCLE_GAIN,
    recommendationTag: "🔥 RECOMMENDED",
    description: 'Gold standard for muscle growth and recovery. Trains synergistic muscles together.',
    days: [
      { name: 'Push', muscleGroups: ['Chest', 'Shoulders', 'Triceps'] },
      { name: 'Pull', muscleGroups: ['Back', 'Biceps'] },
      { name: 'Legs', muscleGroups: ['Quads', 'Hamstrings', 'Glutes', 'Calves'] }
    ]
  },
  {
    id: 'bro-split',
    name: 'Bro Split',
    daysPerWeek: 5,
    style: TrainingStyle.HYPERTROPHY,
    level: ExperienceLevel.ADVANCED,
    avgTime: 70,
    isCustom: false,
    aiOptimized: true,
    category: FitnessGoal.AESTHETICS,
    recommendationTag: "AESTHETICS",
    description: 'One muscle group per day for high intensity and focused volume.',
    days: [
      { name: 'Chest', muscleGroups: ['Chest'] },
      { name: 'Back', muscleGroups: ['Back'] },
      { name: 'Shoulders', muscleGroups: ['Shoulders'] },
      { name: 'Legs', muscleGroups: ['Quads', 'Hamstrings', 'Calves'] },
      { name: 'Arms', muscleGroups: ['Biceps', 'Triceps'] }
    ]
  },
  {
    id: 'arnold-split',
    name: 'Arnold Split',
    daysPerWeek: 6,
    style: TrainingStyle.HYPERTROPHY,
    level: ExperienceLevel.ADVANCED,
    avgTime: 80,
    isCustom: false,
    aiOptimized: true,
    category: FitnessGoal.MUSCLE_GAIN,
    recommendationTag: "HIGH VOLUME",
    description: 'Antagonistic pairing for classic bodybuilding pump and efficiency.',
    days: [
      { name: 'Chest & Back', muscleGroups: ['Chest', 'Back'] },
      { name: 'Shoulders & Arms', muscleGroups: ['Shoulders', 'Biceps', 'Triceps'] },
      { name: 'Legs', muscleGroups: ['Quads', 'Hamstrings', 'Glutes', 'Calves'] }
    ]
  },
  {
    id: 'upper-lower',
    name: 'Upper / Lower',
    daysPerWeek: 4,
    style: TrainingStyle.STRENGTH,
    level: ExperienceLevel.INTERMEDIATE,
    avgTime: 65,
    isCustom: false,
    aiOptimized: true,
    category: FitnessGoal.STRENGTH,
    recommendationTag: "STRENGTH",
    description: 'Hitting every muscle twice weekly with 48h rest between sessions.',
    days: [
      { name: 'Upper', muscleGroups: ['Chest', 'Back', 'Shoulders', 'Arms'] },
      { name: 'Lower', muscleGroups: ['Quads', 'Hamstrings', 'Glutes', 'Calves'] }
    ]
  }
];

const MUSCLE_GROUPS = [
  'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps',
  'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Abs', 'Full Body'
];

export const SplitSystem: React.FC<Props> = ({ profile, setProfile, showToast, onComplete, onBack }) => {
  const [view, setView] = useState<'BROWSE' | 'BUILD'>('BROWSE');
  const [step, setStep] = useState(1);
  const [customSplits, setCustomSplits] = useState<WorkoutSplit[]>([]);
  const [customData, setCustomData] = useState<Partial<WorkoutSplit>>({
    name: '',
    daysPerWeek: 3,
    days: [
      { name: 'Day 1', muscleGroups: [] },
      { name: 'Day 2', muscleGroups: [] },
      { name: 'Day 3', muscleGroups: [] }
    ],
    style: TrainingStyle.HYPERTROPHY,
    aiOptimized: false,
    isCustom: true,
    id: `custom-${Date.now()}`
  });
  const [isOptimizing, setIsOptimizing] = useState(false);

  useEffect(() => {
    loadCustomSplits();
  }, []);

  const loadCustomSplits = async () => {
    const all = await ApiService.getAllSplits();
    const coreIds = CORE_SPLITS.map(c => c.id);
    setCustomSplits(all.filter(s => !coreIds.includes(s.id)));
  };

  const handleSelectSplit = async (split: WorkoutSplit) => {
    await ApiService.saveSplit(split);
    const newProfile = { ...profile, currentSplitId: split.id };
    await ApiService.saveProfile(newProfile);
    setProfile(newProfile);
    showToast(`${split.name} Activated`, "success");
    onComplete();
  };

  const handleDeleteSplit = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (id === profile.currentSplitId) {
      showToast("Cannot delete active protocol", "error");
      return;
    }
    if (confirm("Permanently delete this training architecture?")) {
      await ApiService.deleteSplit(id);
      await loadCustomSplits();
      showToast("Protocol Purged", "info");
    }
  };

  const startCustomBuilder = () => {
    const defaultDays = Array(3).fill(null).map((_, i) => ({
      name: `Day ${i + 1}`,
      muscleGroups: []
    }));
    setCustomData({
      name: '',
      daysPerWeek: 3,
      days: defaultDays,
      style: TrainingStyle.HYPERTROPHY,
      aiOptimized: false,
      isCustom: true,
      id: `custom-${Date.now()}`,
      category: profile.goal,
      level: profile.experience,
      avgTime: 60,
      description: 'Custom training protocol.'
    });
    setStep(1);
    setView('BUILD');
  };

  const handleMuscleToggle = (dayIdx: number, muscle: string) => {
    const newDays = [...(customData.days || [])];
    const current = newDays[dayIdx].muscleGroups;
    if (current.includes(muscle)) {
      newDays[dayIdx].muscleGroups = current.filter(m => m !== muscle);
    } else {
      newDays[dayIdx].muscleGroups = [...current, muscle];
    }
    setCustomData({ ...customData, days: newDays });
  };

  const runAIOptimization = async () => {
    setIsOptimizing(true);
    try {
      const result = await optimizeSplit(customData, profile);
      setCustomData({ ...result.optimizedSplit, aiOptimized: true });
      showToast("Protocol optimized.", "success");
      setStep(6);
    } catch (e) {
      showToast("AI reasoning failed.", "error");
    } finally {
      setIsOptimizing(false);
    }
  };

  const isStepValid = () => {
    if (step === 1) return (customData.name?.trim().length || 0) >= 3;
    if (step === 2) return (customData.daysPerWeek || 0) >= 2;
    if (step === 3) return customData.days?.every(d => d.name.trim().length > 0);
    if (step === 4) return customData.days?.every(d => d.muscleGroups.length > 0);
    if (step === 5) return !!customData.style;
    return true;
  };

  if (view === 'BUILD') {
    return (
      <div className="flex flex-col h-full bg-black animate-in fade-in duration-300 relative max-w-md mx-auto w-full">
        <header className="sticky top-0 z-50 bg-black/95 backdrop-blur-md px-4 py-4 border-b border-zinc-900/50 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => step > 1 ? setStep(s => s - 1) : setView('BROWSE')} className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 active:scale-90 transition-all">
              <ChevronLeft size={18} />
            </button>
            <h2 className="text-lg font-black italic uppercase tracking-tighter leading-none text-white">Custom Builder</h2>
          </div>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${step === i ? 'bg-indigo-600' : 'bg-zinc-800'}`}></div>
            ))}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto py-6 px-4 scrollbar-hide pb-32">
          {step === 1 && (
            <div className="space-y-6 animate-in slide-in-from-right-4">
              <div className="space-y-1">
                <h3 className="text-2xl font-black italic uppercase tracking-tighter leading-none text-white">Identity</h3>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Name your custom protocol</p>
              </div>
              <div className="bg-zinc-900/60 p-6 rounded-[2.5rem] border border-zinc-800 focus-within:border-indigo-500/50 transition-all flex flex-col gap-3 shadow-xl">
                <div className="flex items-center gap-3 text-zinc-500">
                  <Tag size={16} className="text-indigo-500" />
                  <span className="text-[8px] font-black uppercase tracking-[0.2em]">Protocol Label</span>
                </div>
                <input
                  autoFocus
                  value={customData.name}
                  onChange={(e) => setCustomData({ ...customData, name: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && isStepValid() && setStep(2)}
                  className="w-full bg-transparent border-none p-0 focus:ring-0 font-black italic text-3xl uppercase tracking-tighter text-white placeholder:text-zinc-800"
                  placeholder="e.g. ALPHA MASS"
                />
                <p className="text-[7px] text-zinc-600 font-bold uppercase tracking-widest leading-relaxed">Choose a unique identifier for your training architecture.</p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in slide-in-from-right-4">
              <div className="space-y-1">
                <h3 className="text-2xl font-black italic uppercase tracking-tighter leading-none text-white">Frequency</h3>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Training days per week</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[2, 3, 4, 5, 6].map(d => (
                  <button
                    key={d}
                    onClick={() => {
                      const newDays = Array(d).fill(null).map((_, i) => ({
                        name: `Day ${i + 1}`,
                        muscleGroups: []
                      }));
                      setCustomData({ ...customData, daysPerWeek: d, days: newDays });
                    }}
                    className={`p-6 rounded-3xl border transition-all flex flex-col items-center justify-center gap-1 ${customData.daysPerWeek === d ? 'bg-indigo-600 border-indigo-500 shadow-xl' : 'bg-zinc-900 border-zinc-800 opacity-60'}`}
                  >
                    <span className="text-4xl font-black italic">{d}</span>
                    <span className="text-[9px] font-black uppercase tracking-widest">Days</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-in slide-in-from-right-4">
              <div className="space-y-1">
                <h3 className="text-2xl font-black italic uppercase tracking-tighter leading-none text-white">Sessions</h3>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Name each training block</p>
              </div>
              <div className="space-y-3">
                {customData.days?.map((day, i) => (
                  <div key={`${i}-${customData.daysPerWeek}`} className="bg-zinc-900/60 p-5 rounded-[2rem] border border-zinc-800 focus-within:border-indigo-500/50 transition-all flex flex-col gap-1 shadow-lg">
                    <label className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em] block">Session {i + 1}</label>
                    <input
                      value={day.name}
                      onChange={(e) => {
                        const newDays = [...(customData.days || [])];
                        newDays[i].name = e.target.value;
                        setCustomData({ ...customData, days: newDays });
                      }}
                      className="w-full bg-transparent border-none p-0 focus:ring-0 font-black italic text-xl uppercase tracking-tighter text-white placeholder:text-zinc-800"
                      placeholder={`Day ${i + 1}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6 animate-in slide-in-from-right-4">
              <div className="space-y-1">
                <h3 className="text-2xl font-black italic uppercase tracking-tighter leading-none text-white">Targets</h3>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Map muscles to daily sessions</p>
              </div>
              <div className="space-y-6">
                {customData.days?.map((day, i) => {
                  const isMissingMuscle = day.muscleGroups.length === 0;
                  return (
                    <div key={`${i}-${customData.daysPerWeek}`} className="space-y-4">
                      <div className="flex justify-between items-center border-l-2 border-indigo-500 pl-3">
                        <h4 className="text-[11px] font-black uppercase italic text-indigo-400 tracking-[0.2em] leading-none">{day.name}</h4>
                        {isMissingMuscle && <span className="text-[8px] font-black text-rose-500 uppercase tracking-widest bg-rose-500/10 px-2 py-0.5 rounded">REQUIRED</span>}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {MUSCLE_GROUPS.map(m => (
                          <button
                            key={m}
                            onClick={() => handleMuscleToggle(i, m)}
                            className={`px-4 py-2.5 rounded-2xl border text-[10px] font-black uppercase transition-all ${day.muscleGroups.includes(m) ? 'bg-white border-white text-black shadow-lg' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-6 animate-in slide-in-from-right-4">
              <div className="space-y-1">
                <h3 className="text-2xl font-black italic uppercase tracking-tighter leading-none text-white">Stimulus</h3>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Select primary intent</p>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {Object.values(TrainingStyle).map(s => (
                  <button
                    key={s}
                    onClick={() => setCustomData({ ...customData, style: s })}
                    className={`p-6 rounded-[2rem] border text-left transition-all flex items-center justify-between shadow-lg ${customData.style === s ? 'bg-indigo-600 border-indigo-500' : 'bg-zinc-900 border-zinc-800 opacity-60'}`}
                  >
                    <span className="text-xl font-black italic uppercase tracking-tighter">{s}</span>
                    <div className={`w-8 h-8 rounded-full border flex items-center justify-center ${customData.style === s ? 'bg-white border-white text-indigo-600' : 'border-zinc-700 text-transparent'}`}>
                      <Check size={16} strokeWidth={3} />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-6 animate-in slide-in-from-right-4">
              <div className="space-y-1">
                <h3 className="text-2xl font-black italic uppercase tracking-tighter leading-none text-white">Sync</h3>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Final review of architecture</p>
              </div>

              <div className="bg-zinc-900 p-7 rounded-[2.5rem] border border-zinc-800 space-y-6 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5 rotate-12"><Dumbbell size={100} /></div>
                <div className="space-y-1 relative z-10">
                  <h4 className="text-2xl font-black italic uppercase text-white leading-none tracking-tighter">{customData.name}</h4>
                  <div className="flex gap-2 mt-3">
                    <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/10">{customData.daysPerWeek} Days/Wk</span>
                    <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/10">{customData.style}</span>
                  </div>
                </div>

                <div className="space-y-3 relative z-10">
                  {customData.days?.map((day, i) => (
                    <div key={i} className="flex justify-between items-center py-3 border-b border-zinc-800/40 last:border-0">
                      <span className="text-[11px] font-black uppercase text-zinc-500 italic shrink-0 w-28 truncate">{day.name}</span>
                      <div className="flex gap-1.5 flex-wrap justify-end">
                        {day.muscleGroups.map(m => (
                          <span key={m} className="text-[8px] font-black uppercase bg-black px-2 py-0.5 rounded-lg text-zinc-400 border border-zinc-800/50">{m}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {!customData.aiOptimized && (
                <button
                  onClick={runAIOptimization}
                  disabled={isOptimizing}
                  className="w-full bg-indigo-600/10 border border-indigo-500/20 text-indigo-500 py-5 rounded-[2rem] font-black text-[10px] italic tracking-[0.2em] uppercase flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xl"
                >
                  {isOptimizing ? <Loader2 size={18} className="animate-spin" /> : <BrainCircuit size={18} />}
                  {isOptimizing ? 'SYNCHRONIZING...' : 'AI OPTIMIZE STRUCTURE'}
                </button>
              )}
            </div>
          )}
        </main>

        <footer className="absolute bottom-0 left-0 w-full bg-black/95 backdrop-blur-xl border-t border-zinc-900 p-6 z-[60] pb-12 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
          <button
            onClick={() => step < 6 ? setStep(s => s + 1) : handleSelectSplit(customData as WorkoutSplit)}
            disabled={!isStepValid()}
            className="w-full bg-white text-black py-5 rounded-[2rem] font-black text-xs italic tracking-[0.2em] shadow-2xl flex items-center justify-center gap-2 active:scale-95 transition-all uppercase disabled:opacity-30 disabled:scale-100"
          >
            {step < 6 ? <>Continue <ArrowRight size={18} /></> : <>Activate Protocol</>}
          </button>
        </footer>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-black animate-in fade-in duration-500 overflow-hidden relative max-w-md mx-auto w-full">
      <header className="flex-none px-4 py-4 border-b border-zinc-900/50 flex justify-between items-end bg-black/80 backdrop-blur-md sticky top-0 z-40 shrink-0">
        <div className="space-y-0.5">
          <span className="text-indigo-500 text-[9px] font-black uppercase tracking-[0.3em]">Strategy</span>
          <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white leading-none">Protocols</h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={startCustomBuilder}
            className="bg-zinc-900 px-4 py-2 rounded-2xl border border-zinc-800 text-[9px] font-black uppercase tracking-widest text-white active:scale-95 flex items-center gap-2 shadow-xl"
          >
            <Plus size={14} strokeWidth={3} /> Build
          </button>
          {onBack && (
            <button onClick={onBack} className="p-2 bg-zinc-900 border border-zinc-800 rounded-2xl text-zinc-500 active:scale-90 transition-all shadow-xl"><X size={18} /></button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto pb-24 px-2 space-y-8 pt-2 scrollbar-hide">
        {/* Library Info */}
        <div className="bg-indigo-600/5 p-4 rounded-3xl border border-indigo-500/10 flex items-center gap-4 mx-1 shadow-inner">
          <Info size={18} className="text-indigo-500 shrink-0" />
          <p className="text-[10px] font-black text-zinc-500 uppercase leading-relaxed tracking-tight">Stick to one protocol for 4+ weeks for optimal neural adaptation.</p>
        </div>

        {/* Standard Library Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-2">
            <Library size={14} className="text-indigo-500" />
            <h3 className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.3em]">Standard Library</h3>
          </div>
          <div className="space-y-4">
            {CORE_SPLITS.map((split) => {
              const isActive = profile.currentSplitId === split.id;
              return (
                <div
                  key={split.id}
                  className={`bg-zinc-900/80 p-5 rounded-[2.5rem] border transition-all duration-300 relative group active:scale-[0.98] shadow-2xl ${isActive ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-zinc-800/80'}`}
                  onClick={() => handleSelectSplit(split)}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="space-y-2">
                      <h4 className="text-2xl font-black italic uppercase tracking-tighter text-white leading-none">{split.name}</h4>
                      <div className="flex flex-wrap gap-2">
                        <span className="text-[8px] font-black uppercase bg-indigo-600/10 text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-500/10 tracking-widest">{split.recommendationTag}</span>
                        <span className="text-[8px] font-black uppercase bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded-full tracking-widest">{split.daysPerWeek} Days/Wk</span>
                      </div>
                    </div>
                    {isActive && <div className="bg-indigo-600 p-2.5 rounded-2xl text-white shadow-xl shadow-indigo-600/30 border border-indigo-400"><Check size={20} strokeWidth={4} /></div>}
                  </div>

                  <p className="text-[11px] text-zinc-500 font-bold italic mb-5 leading-tight border-l-2 border-zinc-800 pl-4">{split.description}</p>

                  <div className="grid grid-cols-1 gap-2">
                    {split.days.map((d, i) => (
                      <div key={i} className="flex items-center gap-3 bg-black/40 px-4 py-3 rounded-2xl border border-zinc-800/40">
                        <span className="text-[10px] font-black text-zinc-500 uppercase italic shrink-0 w-20 truncate">{d.name}</span>
                        <div className="flex gap-1.5 flex-wrap">
                          {d.muscleGroups.map(m => (
                            <span key={m} className="text-[8px] font-black uppercase text-zinc-300 group-hover:text-indigo-400 transition-colors bg-zinc-800/50 px-2 py-0.5 rounded-lg border border-zinc-800/50">{m}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Custom Protocols Section */}
        {customSplits.length > 0 && (
          <div className="space-y-4 animate-in slide-in-from-bottom-4">
            <div className="flex items-center gap-2 px-2">
              <Zap size={14} className="text-amber-500" />
              <h3 className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.3em]">Personal Architectures</h3>
            </div>
            <div className="space-y-4">
              {customSplits.map((split) => {
                const isActive = profile.currentSplitId === split.id;
                return (
                  <div
                    key={split.id}
                    className={`bg-zinc-900/40 p-5 rounded-[2.5rem] border transition-all duration-300 relative group active:scale-[0.98] ${isActive ? 'border-amber-500 ring-2 border-amber-500/20 shadow-xl' : 'border-zinc-800/80'}`}
                    onClick={() => handleSelectSplit(split)}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="space-y-2">
                        <h4 className="text-xl font-black italic uppercase tracking-tighter text-white leading-none">{split.name}</h4>
                        <div className="flex gap-2">
                          <span className="text-[8px] font-black uppercase bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full border border-amber-500/10">CUSTOM BUILD</span>
                          <span className="text-[8px] font-black uppercase bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded-full">{split.daysPerWeek} Sessions/Wk</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => handleDeleteSplit(e, split.id)}
                          className="p-2 bg-rose-500/10 text-rose-500 rounded-xl border border-rose-500/20 hover:bg-rose-500 hover:text-white transition-all shadow-lg"
                        >
                          <Trash2 size={16} />
                        </button>
                        {isActive && <div className="bg-amber-500 p-2 rounded-xl text-black shadow-xl"><Check size={16} strokeWidth={4} /></div>}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      {split.days.map((d, i) => (
                        <div key={i} className="flex items-center gap-3 bg-black/40 px-4 py-2.5 rounded-2xl border border-zinc-800/40">
                          <span className="text-[9px] font-black text-zinc-500 uppercase italic shrink-0 w-16 truncate">{d.name}</span>
                          <div className="flex gap-1.5 flex-wrap">
                            {d.muscleGroups.map(m => (
                              <span key={m} className="text-[7px] font-black uppercase text-zinc-400 bg-zinc-800/50 px-2 py-0.5 rounded-lg border border-zinc-800/50">{m}</span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
