
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { UserProfile, FitnessGoal, Gender, BodyType } from '../types';
import { analyzeMeal, getDietPlan, customizeDiet } from '../services/geminiService';
import { ApiService } from '../services/api';
import { Camera, Search, Plus, Leaf, Star, Info, MessageSquare, Sparkles, X, Send, BrainCircuit, Check, ChefHat, Loader2, History, Utensils, Calendar, RefreshCcw } from 'lucide-react';

interface Props {
  profile: UserProfile;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

type DietViewState = 'LOG' | 'CUSTOMIZE' | 'HISTORY';

interface DietChatMessage {
  role: 'user' | 'ai';
  text?: string;
  meals?: any[];
}

export const DietSystem: React.FC<Props> = ({ profile, showToast }) => {
  const [viewState, setViewState] = useState<DietViewState>('LOG');
  const [mealInput, setMealInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [suggestedMeals, setSuggestedMeals] = useState<any[]>([]);
  const [dietHistory, setDietHistory] = useState<any[]>([]);
  const [recentMeals, setRecentMeals] = useState<any[]>([]);

  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<DietChatMessage[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Advanced AI Macro Calculation Logic
  const targets = useMemo(() => {
    const p = profile;
    // Base BMR estimation (Mifflin-St Jeor simplified)
    let baseCals = p.weight * 24;

    // Activity & Lean Mass Proxy Adjustment
    let activityMultiplier = 1.4; // Default to moderately active
    if (p.experience === 'Advanced') activityMultiplier = 1.6;
    if (p.experience === 'Beginner') activityMultiplier = 1.3;

    let tdee = baseCals * activityMultiplier;

    // Body Type Adjustments (Metabolic Efficiency)
    if (p.bodyType === BodyType.ECTOMORPH) tdee *= 1.1; // Higher carb tolerance
    if (p.bodyType === BodyType.ENDOMORPH) tdee *= 0.9; // Lower carb tolerance
    if (p.gender === Gender.FEMALE) tdee *= 0.9;

    // Goal Adjustments
    let targetCals = tdee;
    let pMultiplier = 2.0; // g per kg

    if (p.goal === FitnessGoal.MUSCLE_GAIN) {
      targetCals += 400;
      pMultiplier = 2.2;
    } else if (p.goal === FitnessGoal.FAT_LOSS) {
      targetCals -= 500;
      pMultiplier = 2.5; // High protein to spare muscle in deficit
    } else {
      pMultiplier = 2.0;
    }

    const protein = Math.floor(p.weight * pMultiplier);
    const fats = Math.floor(p.weight * 0.85); // Healthy fat baseline
    const carbs = Math.floor((targetCals - (protein * 4) - (fats * 9)) / 4);

    return {
      calories: Math.floor(targetCals),
      protein,
      carbs: Math.max(carbs, 60),
      fats
    };
  }, [profile]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [todayMeals, savedDiet, history] = await Promise.all([
          ApiService.getTodaysMeals(),
          ApiService.getActiveDiet(),
          ApiService.getMealHistory(50)
        ]);

        setLogs(todayMeals.reverse());

        if (savedDiet && savedDiet.plan) {
          setSuggestedMeals(savedDiet.plan);
        }

        const uniqueMealsMap = new Map();
        history.forEach((m: any) => {
          if (!uniqueMealsMap.has(m.name.toLowerCase())) {
            uniqueMealsMap.set(m.name.toLowerCase(), m);
          }
        });
        setRecentMeals(Array.from(uniqueMealsMap.values()).slice(0, 10));
      } catch (e) {
        console.error("Failed to load diet data", e);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isAnalyzing]);

  const handleGenerateDiet = async () => {
    setIsAnalyzing(true);
    try {
      const plan = await getDietPlan(profile);
      setSuggestedMeals(plan);
      await ApiService.saveActiveDiet(plan);
      showToast("Fuel Protocol Generated", "success");
    } catch (e) {
      showToast("Nutrition model busy", "error");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const openCustomize = () => {
    setChatHistory([{
      role: 'ai',
      text: suggestedMeals.length > 0
        ? "Daily Protocol loaded. Any allergies or preferences to adjust?"
        : "I haven't generated a protocol yet. Should I create one based on your profile first?",
      meals: suggestedMeals.length > 0 ? suggestedMeals : undefined
    }]);
    setViewState('CUSTOMIZE');
  };

  const openHistory = async () => {
    setIsAnalyzing(true);
    const history = await ApiService.getMealHistory(100);
    const grouped = history.reduce((acc: any, meal: any) => {
      if (!acc[meal.date]) acc[meal.date] = [];
      acc[meal.date].push(meal);
      return acc;
    }, {});

    const formattedHistory = Object.keys(grouped).map(date => ({
      date,
      meals: grouped[date],
      totalCals: grouped[date].reduce((s: number, m: any) => s + m.calories, 0),
      totalProtein: grouped[date].reduce((s: number, m: any) => s + m.protein, 0)
    }));

    setDietHistory(formattedHistory);
    setViewState('HISTORY');
    setIsAnalyzing(false);
  };

  const handleCustomise = async () => {
    if (!chatInput.trim() || isAnalyzing) return;
    const userMsg = chatInput;
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsAnalyzing(true);

    try {
      const result = await customizeDiet(suggestedMeals, userMsg);
      setChatHistory(prev => [...prev, {
        role: 'ai',
        text: result.confirmation,
        meals: result.meals
      }]);
    } catch (e) {
      setChatHistory(prev => [...prev, { role: 'ai', text: "Failed to recalibrate nutrition. Please try again." }]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const applyNewDiet = async (newMeals: any[]) => {
    setSuggestedMeals(newMeals);
    await ApiService.saveActiveDiet(newMeals);
    setViewState('LOG');
    showToast("Diet Protocol Applied", "success");
  };

  const handleManualLog = async () => {
    if (!mealInput.trim()) {
      showToast("Describe your meal first", "info");
      return;
    }
    setIsAnalyzing(true);
    try {
      const info = await analyzeMeal(mealInput);
      await ApiService.logMeal(info);
      setLogs(prev => [info, ...prev]);
      setMealInput('');
      showToast(`${info.name} Logged`, "success");
    } catch (e) {
      showToast("AI analysis failed", "error");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleQuickLog = async (meal: any) => {
    setIsAnalyzing(true);
    try {
      const mealData = {
        name: meal.name,
        calories: meal.calories,
        protein: meal.protein,
        carbs: meal.carbs,
        fats: meal.fats,
        quality: 10
      };
      await ApiService.logMeal(mealData);
      setLogs(prev => [mealData, ...prev]);
      showToast(`${meal.name} added to log`, "success");
    } catch (e) {
      showToast("Log failed", "error");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const caloriesConsumed = logs.reduce((acc, curr) => acc + (curr.calories || 0), 0);
  const proteinConsumed = logs.reduce((acc, curr) => acc + (curr.protein || 0), 0);
  const carbsConsumed = logs.reduce((acc, curr) => acc + (curr.carbs || 0), 0);

  if (viewState === 'HISTORY') {
    return (
      <div className="space-y-6 pb-20 animate-in slide-in-from-right-4 duration-500 max-w-md mx-auto relative w-full">
        <header className="sticky top-0 z-30 bg-black/95 backdrop-blur-md -mx-4 px-5 py-4 border-b border-zinc-900/50 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-zinc-800 p-2 rounded-xl text-emerald-500"><History size={18} /></div>
            <h2 className="text-xl font-black italic uppercase tracking-tighter">Nutrition History</h2>
          </div>
          <button onClick={() => setViewState('LOG')} className="p-2 text-zinc-500 hover:text-white"><X size={20} /></button>
        </header>

        <div className="space-y-6 pt-4 px-1">
          {dietHistory.length === 0 ? (
            <div className="py-20 text-center space-y-3 opacity-40">
              <Calendar size={32} className="mx-auto text-zinc-500" />
              <p className="text-[10px] font-black uppercase tracking-widest">No nutrition records found</p>
            </div>
          ) : (
            dietHistory.map((day, idx) => (
              <div key={idx} className="space-y-3">
                <div className="flex justify-between items-end px-2">
                  <h3 className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em]">{new Date(day.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</h3>
                  <span className="text-[9px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">{day.totalCals} KCAL • {day.totalProtein}g P</span>
                </div>
                <div className="space-y-2">
                  {day.meals.map((meal: any, mIdx: number) => (
                    <div key={mIdx} className="bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-zinc-800 rounded-lg flex items-center justify-center text-zinc-600"><Utensils size={14} /></div>
                        <div>
                          <p className="text-[11px] font-black text-zinc-200 uppercase italic truncate max-w-[140px]">{meal.name}</p>
                          <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">P: {meal.protein}g • C: {meal.carbs}g</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-black text-white italic">{meal.calories} KCAL</span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  if (viewState === 'CUSTOMIZE') {
    return (
      <div className="flex flex-col h-[calc(100vh-220px)] space-y-4 animate-in slide-in-from-bottom-4 duration-300 max-w-md mx-auto relative w-full">
        <header className="sticky top-0 z-30 bg-black/95 backdrop-blur-md -mx-4 px-5 py-4 border-b border-zinc-900/50 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-600/20 p-2 rounded-xl text-emerald-500"><ChefHat size={18} /></div>
            <h2 className="text-xl font-black italic uppercase tracking-tighter">Diet Customiser</h2>
          </div>
          <button onClick={() => setViewState('LOG')} className="p-2 text-zinc-500 hover:text-white"><X size={20} /></button>
        </header>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-hide pb-4 pt-4 px-1">
          {chatHistory.map((m, i) => (
            <div key={i} className={`flex flex-col gap-2 ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
              {m.text && (
                <div className={`max-w-[85%] p-3 px-4 rounded-2xl text-[11px] font-semibold leading-relaxed shadow-lg ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-bl-none'
                  }`}>
                  {m.text}
                </div>
              )}
              {m.meals && (
                <div className="w-full max-w-[260px] bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95">
                  <div className="bg-zinc-800/50 p-2 border-b border-zinc-800 flex justify-between items-center">
                    <span className="text-[7px] font-black uppercase text-zinc-400 tracking-widest">Target Protocol</span>
                    <Sparkles size={10} className="text-emerald-400" />
                  </div>
                  <div className="p-2 space-y-1.5">
                    {m.meals.map((meal, idx) => (
                      <div key={idx} className="bg-black/40 p-2 rounded-lg border border-zinc-800/40">
                        <div className="flex justify-between items-start mb-1">
                          <p className="text-[9px] font-black uppercase text-white truncate">{meal.name}</p>
                          <span className="text-[7px] font-black text-emerald-500">{meal.calories} kcal</span>
                        </div>
                        <p className="text-[7px] font-bold text-zinc-600 leading-tight line-clamp-1">{meal.description}</p>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => applyNewDiet(m.meals!)}
                    className="w-full bg-emerald-600 py-2.5 text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-500 transition-colors"
                  >
                    <Check size={12} /> Use this Protocol
                  </button>
                </div>
              )}
            </div>
          ))}
          {isAnalyzing && (
            <div className="flex justify-start">
              <div className="bg-zinc-900 p-3.5 rounded-2xl rounded-bl-none flex gap-1 shadow-md">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce"></span>
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="flex gap-2 bg-zinc-900 p-1.5 rounded-2xl border border-zinc-800 focus-within:border-emerald-500 transition-colors shadow-2xl shrink-0 mb-4 mx-1">
          <input
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCustomise()}
            placeholder="e.g. make it high protein / vegan"
            className="flex-1 bg-transparent border-none focus:ring-0 text-[11px] py-2 px-3 font-bold text-white placeholder:text-zinc-700"
          />
          <button
            onClick={handleCustomise}
            disabled={!chatInput.trim() || isAnalyzing}
            className="bg-emerald-600 p-2.5 rounded-xl text-white disabled:opacity-30 transition-all hover:bg-emerald-500 shadow-lg shadow-emerald-600/20"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 max-w-md mx-auto relative w-full px-1">
      <header className="sticky top-0 z-30 bg-black/95 backdrop-blur-md -mx-4 px-5 py-4 border-b border-zinc-900/50 flex justify-between items-end px-1">
        <div>
          <span className="text-emerald-500 text-[10px] font-bold uppercase tracking-widest">Nutrition Control</span>
          <h2 className="text-3xl font-black italic uppercase tracking-tighter">Fuel</h2>
        </div>
        <div className="flex gap-2">
          <button onClick={openHistory} className="bg-zinc-900 p-2.5 rounded-xl border border-zinc-800 text-zinc-500 hover:text-emerald-500 transition-all active:scale-95" title="History"><History size={18} /></button>
          <button
            onClick={suggestedMeals.length > 0 ? openCustomize : handleGenerateDiet}
            className="bg-zinc-900 px-3 py-1.5 rounded-full border border-zinc-800 flex items-center gap-2 group hover:border-emerald-500/50 transition-all shadow-lg active:scale-95"
          >
            {isAnalyzing ? (
              <Loader2 size={14} className="animate-spin text-emerald-500" />
            ) : suggestedMeals.length > 0 ? (
              <MessageSquare size={14} className="text-emerald-500" />
            ) : (
              <Sparkles size={14} className="text-emerald-500" />
            )}
            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">
              {suggestedMeals.length > 0 ? 'Customise' : 'AI Protocol'}
            </span>
          </button>
        </div>
      </header>

      <div className="px-1 space-y-6 pt-4">
        {/* Suggested Meals Section */}
        <div className="space-y-3">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-[8px] font-black uppercase text-zinc-500 tracking-[0.3em]">AI Suggested Protocol</h3>
            <div className="flex gap-2">
              {suggestedMeals.length > 0 && (
                <button onClick={handleGenerateDiet} className="text-[8px] font-black text-zinc-500 uppercase hover:text-white flex items-center gap-1"><RefreshCcw size={10} /> New</button>
              )}
              {isAnalyzing && <span className="text-[7px] font-black text-emerald-500 animate-pulse uppercase">Calculating...</span>}
            </div>
          </div>

          {suggestedMeals.length === 0 && !isAnalyzing ? (
            <div className="bg-zinc-900/40 p-10 border-2 border-dashed border-zinc-800 rounded-[2.5rem] flex flex-col items-center justify-center text-center space-y-6 animate-in fade-in zoom-in-95 duration-700">
              <div className="bg-emerald-600/10 w-16 h-16 rounded-2xl flex items-center justify-center border border-emerald-500/20 shadow-2xl">
                <ChefHat size={24} className="text-emerald-500" />
              </div>
              <div className="space-y-2">
                <h4 className="text-sm font-black uppercase text-white italic tracking-tighter">Nutrition Architecture</h4>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest leading-relaxed">AI ready to optimize your {profile.dietPreference} requirements for {profile.goal}</p>
              </div>
              <button
                onClick={handleGenerateDiet}
                className="bg-emerald-600 text-white px-8 py-4 rounded-2xl font-black text-[10px] tracking-[0.2em] shadow-xl shadow-emerald-600/20 flex items-center gap-2 uppercase active:scale-95 transition-all"
              >
                <Sparkles size={14} /> Generate Daily Plan
              </button>
            </div>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide px-1">
              {suggestedMeals.map((meal, i) => (
                <div
                  key={i}
                  className="min-w-[150px] bg-zinc-900/60 p-4 rounded-[2rem] border border-zinc-800 flex flex-col justify-between h-32 hover:border-emerald-500/40 transition-all group"
                >
                  <div>
                    <span className="text-[7px] font-black uppercase text-zinc-600 tracking-tighter block mb-0.5">{meal.type}</span>
                    <p className="text-[10px] font-black text-white line-clamp-2 leading-tight uppercase italic">{meal.name}</p>
                  </div>
                  <div className="flex justify-between items-end">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-black text-emerald-500">{meal.calories} kcal</span>
                      <span className="text-[7px] font-bold text-zinc-600">P: {meal.protein}g</span>
                    </div>
                    <button
                      onClick={() => handleQuickLog(meal)}
                      disabled={isAnalyzing}
                      className="w-7 h-7 bg-zinc-800 rounded-full flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-lg active:scale-90"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-zinc-900 p-6 rounded-[2.5rem] border border-zinc-800 flex items-center gap-8 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform"><ChefHat size={80} /></div>
          <div className="relative w-28 h-28 flex items-center justify-center shrink-0">
            <svg className="w-full h-full -rotate-90">
              <circle cx="56" cy="56" r="48" fill="none" stroke="#27272a" strokeWidth="10" />
              <circle
                cx="56"
                cy="56"
                r="48"
                fill="none"
                stroke="#10b981"
                strokeWidth="10"
                strokeDasharray="301"
                strokeDashoffset={301 - (Math.min(caloriesConsumed / targets.calories, 1) * 301)}
                strokeLinecap="round"
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-xl font-black italic">{Math.max(targets.calories - caloriesConsumed, 0)}</span>
              <span className="text-[8px] text-zinc-500 uppercase font-bold tracking-widest">KCAL Rem.</span>
            </div>
          </div>
          <div className="flex-1 grid grid-cols-1 gap-4">
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] font-black text-zinc-500 uppercase">
                <span>Protein</span>
                <span className="text-emerald-500">{proteinConsumed}g / {targets.protein}g</span>
              </div>
              <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-700"
                  style={{ width: `${Math.min((proteinConsumed / targets.protein) * 100, 100)}%` }}
                ></div>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] font-black text-zinc-500 uppercase">
                <span>Carbs</span>
                <span className="text-orange-500">{carbsConsumed}g / {targets.carbs}g</span>
              </div>
              <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-500 transition-all duration-700"
                  style={{ width: `${Math.min((carbsConsumed / targets.carbs) * 100, 100)}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 p-6 rounded-[2.5rem] border border-zinc-800 space-y-4 shadow-xl">
          <h3 className="font-black flex items-center gap-2 text-emerald-400 uppercase text-xs tracking-widest">
            <Plus size={18} /> Quick Entry
          </h3>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                value={mealInput}
                onChange={(e) => setMealInput(e.target.value)}
                placeholder="e.g. 150g Chicken & Rice"
                className="w-full bg-zinc-800 border-none rounded-2xl py-4 pl-5 pr-12 text-sm font-black focus:ring-2 focus:ring-emerald-500 outline-none placeholder:text-zinc-700 text-white"
                onKeyDown={(e) => e.key === 'Enter' && handleManualLog()}
              />
              <button className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-white"><Search size={18} /></button>
            </div>
            <button
              onClick={() => showToast("Camera feature coming soon", "info")}
              className="bg-zinc-800 p-4 rounded-2xl text-zinc-500 border border-zinc-800/50"
            >
              <Camera size={20} />
            </button>
          </div>
          <button
            onClick={handleManualLog}
            disabled={isAnalyzing}
            className="w-full bg-white text-black font-black uppercase text-[10px] tracking-[0.2em] py-4 rounded-2xl shadow-xl disabled:opacity-50 transition-all active:scale-[0.98]"
          >
            {isAnalyzing ? 'Decoding Macros...' : 'Analyse & Save'}
          </button>

          {recentMeals.length > 0 && (
            <div className="pt-4 border-t border-zinc-800/50 space-y-3">
              <h4 className="text-[9px] font-black uppercase text-zinc-500 tracking-widest">Recent Meals</h4>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {recentMeals.map((meal, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleQuickLog(meal)}
                    disabled={isAnalyzing}
                    className="shrink-0 bg-black/40 hover:bg-zinc-800 border border-zinc-800 rounded-xl px-4 py-2 flex items-center gap-3 transition-colors group text-left"
                  >
                    <div>
                      <p className="text-[10px] font-black text-white uppercase italic truncate max-w-[120px]">{meal.name}</p>
                      <p className="text-[8px] font-bold text-emerald-500">{meal.calories} KCAL • P:{meal.protein}g</p>
                    </div>
                    <div className="w-5 h-5 rounded-full bg-emerald-600/20 text-emerald-500 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                      <Plus size={10} />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4 px-1">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[10px] font-black uppercase text-zinc-600 tracking-[0.2em]">Logged Today</h3>
          </div>
          {logs.length === 0 ? (
            <div className="bg-zinc-900/30 border border-zinc-800 border-dashed p-12 rounded-[2.5rem] text-center text-zinc-700 text-[10px] font-black uppercase tracking-widest">
              Protocol Empty
            </div>
          ) : (
            logs.map((log, i) => (
              <div key={i} className="bg-zinc-900 p-5 rounded-[2rem] border border-zinc-800 flex justify-between items-center group transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-zinc-800 rounded-2xl flex items-center justify-center overflow-hidden border border-zinc-700">
                    <img src={`https://picsum.photos/seed/${log.name}/150/150`} className="w-full h-full object-cover opacity-20 grayscale" alt="meal" />
                  </div>
                  <div>
                    <h4 className="font-black text-zinc-200 text-xs tracking-tighter uppercase italic">{log.name}</h4>
                    <div className="flex gap-2 text-[8px] font-black text-zinc-600 uppercase tracking-widest mt-1">
                      <span className="text-emerald-500">P: {log.protein}g</span>
                      <span>C: {log.carbs}g</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-black text-white text-sm italic">{log.calories} KCAL</p>
                  <div className="flex items-center justify-end gap-1 mt-0.5 opacity-60">
                    <Star size={8} className="text-amber-500 fill-amber-500" />
                    <span className="text-[8px] text-zinc-500 font-black">{log.quality}/10</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
