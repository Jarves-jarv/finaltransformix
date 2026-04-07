
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { UserProfile, Gender, BodyType, FitnessGoal, ExperienceLevel, DietPreference, WeightUnit, HeightUnit, Gym } from '../types';
import { ApiService } from '../services/api';
import { scanGymEquipment, findGymsWithMaps } from '../services/geminiService';
import {
  Camera, User, ChevronLeft, Save,
  Dumbbell, Utensils, AlertTriangle, MapPin, Plus, X,
  Search, Target, Loader2, Zap, Sparkles, BrainCircuit, Scale, Ruler, Coffee, CalendarOff, LogOut, Globe, Database, Mail, Smartphone, Lightbulb, MessageSquare
} from 'lucide-react';

interface Props {
  profile: UserProfile;
  setProfile: (profile: UserProfile) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  setActiveTab: (tab: string) => void;
  logout: () => void;
}

export const Settings: React.FC<Props> = ({ profile, setProfile, showToast, setActiveTab, logout }) => {
  const [formData, setFormData] = useState<UserProfile>({ ...profile });
  const [isSaving, setIsSaving] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [injuryInput, setInjuryInput] = useState('');
  const [equipmentInput, setEquipmentInput] = useState('');

  // Gym Search State
  const [gymSearch, setGymSearch] = useState(profile.gymName || '');
  const [showGymList, setShowGymList] = useState(false);
  const [localGyms, setLocalGyms] = useState<Gym[]>([]);
  const [onlineGyms, setOnlineGyms] = useState<Gym[]>([]);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);

  // Suggestion State
  const [showSuggestionForm, setShowSuggestionForm] = useState(false);
  const [suggestionType, setSuggestionType] = useState<'feature' | 'bug' | 'other'>('feature');
  const [suggestionTitle, setSuggestionTitle] = useState('');
  const [suggestionDesc, setSuggestionDesc] = useState('');
  const [isSubmittingSuggestion, setIsSubmittingSuggestion] = useState(false);

  const [leaveDays, setLeaveDays] = useState<number | ''>('');
  const [recentLeave, setRecentLeave] = useState<any>(null);

  // Local state for converted inputs
  const [localWeight, setLocalWeight] = useState(profile.weight);
  const [heightFt, setHeightFt] = useState(5);
  const [heightIn, setHeightIn] = useState(9);

  const profileImageRef = useRef<HTMLInputElement>(null);
  const scanGearRef = useRef<HTMLInputElement>(null);

  // Initialize local states based on profile
  useEffect(() => {
    if (formData.weightUnit === WeightUnit.LBS) {
      setLocalWeight(Math.round(formData.weight * 2.20462));
    } else {
      setLocalWeight(Math.round(formData.weight));
    }

    if (formData.heightUnit === HeightUnit.FT) {
      const totalInches = formData.height / 2.54;
      setHeightFt(Math.floor(totalInches / 12));
      setHeightIn(Math.round(totalInches % 12));
    }

    loadRecentLeave();
    loadLocalGyms();
  }, []);

  const loadRecentLeave = async () => {
    const leave = await ApiService.getRecentLeave();
    setRecentLeave(leave);
  };

  const loadLocalGyms = async () => {
    await ApiService.seedGyms(); // Ensure DB has defaults
    const gyms = await ApiService.getGyms();
    setLocalGyms(gyms);
  };

  const handleWeightChange = (val: number) => {
    const cleanVal = val || 0;
    setLocalWeight(cleanVal);
    if (formData.weightUnit === WeightUnit.LBS) {
      setFormData({ ...formData, weight: cleanVal / 2.20462 });
    } else {
      setFormData({ ...formData, weight: cleanVal });
    }
  };

  const handleHeightFtInChange = (ft: number, inc: number) => {
    let finalFt = ft || 0;
    let finalIn = inc || 0;

    // RULE: Inch never touch 12. Overflow to feet.
    if (finalIn >= 12) {
      finalFt += Math.floor(finalIn / 12);
      finalIn = finalIn % 12;
    }

    setHeightFt(finalFt);
    setHeightIn(finalIn);
    const cm = (finalFt * 12 + finalIn) * 2.54;
    setFormData({ ...formData, height: cm });
  };

  const handleWeightUnitToggle = (unit: WeightUnit) => {
    if (formData.weightUnit === unit) return;
    setFormData({ ...formData, weightUnit: unit });
    if (unit === WeightUnit.LBS) {
      setLocalWeight(Math.round(formData.weight * 2.20462));
    } else {
      setLocalWeight(Math.round(formData.weight));
    }
  };

  const handleHeightUnitToggle = (unit: HeightUnit) => {
    if (formData.heightUnit === unit) return;
    setFormData({ ...formData, heightUnit: unit });
    if (unit === HeightUnit.FT) {
      const totalInches = formData.height / 2.54;
      setHeightFt(Math.floor(totalInches / 12));
      setHeightIn(Math.round(totalInches % 12));
    }
  };

  // Real-time protocol target calculation for preview
  const calculatedProtocol = useMemo(() => {
    const p = formData;
    let baseCals = p.weight * 24;
    let activityMultiplier = p.experience === 'Advanced' ? 1.6 : p.experience === 'Intermediate' ? 1.4 : 1.3;
    let tdee = baseCals * activityMultiplier;

    if (p.bodyType === BodyType.ECTOMORPH) tdee *= 1.1;
    if (p.bodyType === BodyType.ENDOMORPH) tdee *= 0.9;
    if (p.gender === Gender.FEMALE) tdee *= 0.9;

    let targetCals = tdee;
    let pMultiplier = 2.0;
    if (p.goal === FitnessGoal.MUSCLE_GAIN) { targetCals += 400; pMultiplier = 2.2; }
    else if (p.goal === FitnessGoal.FAT_LOSS) { targetCals -= 500; pMultiplier = 2.5; }

    const protein = Math.floor(p.weight * pMultiplier);
    const fats = Math.floor(p.weight * 0.85);
    const carbs = Math.floor((targetCals - (protein * 4) - (fats * 9)) / 4);

    return { calories: Math.floor(targetCals), protein, carbs: Math.max(carbs, 60) };
  }, [formData]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await ApiService.saveProfile(formData);
      setProfile(formData);
      showToast("Profile Synced to Core", "success");
      setActiveTab('home');
    } catch (e) {
      showToast("Sync Error: Storage full", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogLeave = async () => {
    if (!leaveDays || leaveDays <= 0) {
      showToast("Days must be greater than 0", "error");
      return;
    }
    await ApiService.logLeave(Number(leaveDays));
    showToast(`${leaveDays}-Day Break Logged. Protocols Adjusted.`, "success");
    loadRecentLeave();
    setLeaveDays('');
  };

  const handleCancelLeave = async () => {
    await ApiService.cancelActiveLeave();
    setRecentLeave(null);
    showToast("Recovery protocol cancelled. Back to full intensity.", "info");
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, profileImage: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleScanGear = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    showToast("AI Vision Initializing...", "info");
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const identified = await scanGymEquipment(base64);

        if (identified && Array.isArray(identified)) {
          const normalizedNew = identified.map(item =>
            item.trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
          );

          const currentEquipSet = new Set(formData.equipment);
          const trulyNew = normalizedNew.filter(item => !currentEquipSet.has(item));

          if (trulyNew.length > 0) {
            setFormData(prev => ({
              ...prev,
              equipment: Array.from(new Set([...prev.equipment, ...trulyNew]))
            }));
            showToast(`Found ${trulyNew.length} new items!`, "success");
          } else {
            showToast("No new equipment detected in this photo.", "info");
          }
        }
        setIsScanning(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      showToast("Scanning failed", "error");
      setIsScanning(false);
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  // GYM SEARCH & SELECTION LOGIC
  const handleSelectGym = async (gym: Gym, isOnline: boolean = false) => {
    // If it's an online result, save it to our local DB first
    if (isOnline) {
      await ApiService.addGym(gym);
      await loadLocalGyms(); // Refresh local list
    }

    setFormData({
      ...formData,
      gymName: gym.name,
      equipment: Array.from(new Set([...formData.equipment, ...gym.equipment]))
    });
    setGymSearch(gym.name);
    setShowGymList(false);
    setOnlineGyms([]); // Clear online results
    showToast(`${gym.name} set as home base`, "success");
  };

  const handleOnlineSearch = async () => {
    if (!gymSearch.trim()) return;
    setIsSearchingOnline(true);
    setOnlineGyms([]);

    try {
      const results = await findGymsWithMaps(gymSearch);
      if (results.length > 0) {
        setOnlineGyms(results);
        showToast(`Found ${results.length} locations on Maps`, "success");
      } else {
        showToast("No matches found on Maps", "info");
      }
    } catch (e) {
      showToast("Online search failed", "error");
    } finally {
      setIsSearchingOnline(false);
    }
  };

  const handleAddCustomGym = () => {
    if (gymSearch.trim()) {
      setFormData({ ...formData, gymName: gymSearch.trim() });
      setShowGymList(false);
      showToast(`Custom location set: ${gymSearch}`, "success");
    }
  };

  const addInjury = () => {
    if (injuryInput.trim()) {
      const current = formData.injuries || [];
      const normalized = injuryInput.trim();
      if (!current.includes(normalized)) {
        setFormData({ ...formData, injuries: [...current, normalized] });
        showToast("Injury profile updated", "info");
      }
      setInjuryInput('');
    }
  };

  const addEquipment = () => {
    if (equipmentInput.trim()) {
      const normalized = equipmentInput.trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      setFormData({ ...formData, equipment: Array.from(new Set([...formData.equipment, normalized])) });
      setEquipmentInput('');
    }
  };

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to sign out?')) {
      setIsLoggingOut(true);
      await logout();
    }
  };

  const handleSuggestionSubmit = async () => {
    if (!suggestionTitle.trim() || !suggestionDesc.trim()) {
      showToast("Please provide both title and description.", "error");
      return;
    }
    setIsSubmittingSuggestion(true);
    try {
      await ApiService.submitSuggestion({
        userId: profile.id,
        userName: profile.name || 'Anonymous',
        type: suggestionType,
        title: suggestionTitle.trim(),
        description: suggestionDesc.trim()
      });
      showToast("Suggestion submitted successfully!", "success");
      setSuggestionTitle('');
      setSuggestionDesc('');
      setShowSuggestionForm(false);
    } catch (e) {
      showToast("Failed to submit suggestion.", "error");
    } finally {
      setIsSubmittingSuggestion(false);
    }
  };

  const filteredLocalGyms = localGyms.filter(g => g.name.toLowerCase().includes(gymSearch.toLowerCase()));

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10 max-w-md mx-auto relative w-full">
      <header className="sticky top-0 z-30 bg-black/95 backdrop-blur-md -mx-4 px-5 py-4 border-b border-zinc-900/50 flex items-center gap-4 shrink-0">
        <button
          onClick={() => setActiveTab('home')}
          className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-full text-zinc-400 active:scale-90 transition-all"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1">
          <h2 className="text-3xl font-black italic uppercase tracking-tighter leading-none">System<br /><span className="text-indigo-500">Settings</span></h2>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-full text-rose-500 active:scale-90 transition-all hover:bg-rose-500 hover:text-white disabled:opacity-50"
        >
          {isLoggingOut ? <Loader2 size={20} className="animate-spin" /> : <LogOut size={20} />}
        </button>
      </header>

      <div className="px-1 space-y-8 pt-4">
        {/* Profile Section */}
        <section className="bg-zinc-900/50 p-6 rounded-[2.5rem] border border-zinc-800 space-y-6">
          <div className="flex flex-col items-center gap-4">
            <div className="relative group">
              <div className="w-24 h-24 bg-zinc-800 rounded-[2rem] overflow-hidden border-2 border-indigo-500/20 shadow-2xl relative">
                {formData.profileImage ? (
                  <img src={formData.profileImage} className="w-full h-full object-cover" alt="Profile" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-600">
                    <User size={40} />
                  </div>
                )}
                <button
                  onClick={() => profileImageRef.current?.click()}
                  className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                >
                  <Camera size={20} />
                </button>
              </div>
              <input type="file" ref={profileImageRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
              <div className="absolute -bottom-1 -right-1 bg-indigo-600 p-1.5 rounded-lg border-2 border-black shadow-lg">
                <Camera size={10} className="text-white" />
              </div>
            </div>
          </div>

          {/* Core Personal Details */}
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-zinc-500 text-[8px] font-black uppercase tracking-widest">Full Name</label>
              <div className="relative">
                <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-black/40 border border-zinc-800 p-3 pl-10 rounded-xl focus:border-indigo-500 outline-none font-black text-sm text-white"
                  placeholder="Your Name"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1">
                <label className="text-zinc-500 text-[8px] font-black uppercase tracking-widest">Email Address</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-black/40 border border-zinc-800 p-3 pl-10 rounded-xl focus:border-indigo-500 outline-none font-black text-xs text-white"
                    placeholder="name@email.com"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-zinc-500 text-[8px] font-black uppercase tracking-widest">Phone Number</label>
                <div className="relative">
                  <Smartphone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="tel"
                    value={formData.phone || ''}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-black/40 border border-zinc-800 p-3 pl-10 rounded-xl focus:border-indigo-500 outline-none font-black text-xs text-white"
                    placeholder="+91..."
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-zinc-500 text-[8px] font-black uppercase tracking-widest">Gender</label>
              <select
                value={formData.gender}
                onChange={e => setFormData({ ...formData, gender: e.target.value as Gender })}
                className="w-full bg-black/40 border border-zinc-800 p-3 rounded-xl focus:border-indigo-500 outline-none font-black text-[10px] text-white h-[46px]"
              >
                {Object.values(Gender).map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-zinc-500 text-[8px] font-black uppercase tracking-widest">Age</label>
              <input
                type="number"
                value={formData.age || ''}
                onFocus={e => e.target.select()}
                onChange={e => setFormData({ ...formData, age: Math.max(0, parseInt(e.target.value) || 0) })}
                className="w-full bg-black/40 border border-zinc-800 p-3 rounded-xl focus:border-indigo-500 outline-none font-black text-sm text-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-zinc-500 text-[8px] font-black uppercase tracking-widest">Goal</label>
              <select
                value={formData.goal}
                onChange={e => setFormData({ ...formData, goal: e.target.value as FitnessGoal })}
                className="w-full bg-black/40 border border-zinc-800 p-3 rounded-xl focus:border-indigo-500 outline-none font-black text-[10px] text-white h-[46px]"
              >
                {Object.values(FitnessGoal).map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-zinc-500 text-[8px] font-black uppercase tracking-widest">Diet</label>
              <select
                value={formData.dietPreference}
                onChange={e => setFormData({ ...formData, dietPreference: e.target.value as DietPreference })}
                className="w-full bg-black/40 border border-zinc-800 p-3 rounded-xl focus:border-indigo-500 outline-none font-black text-[10px] text-white h-[46px]"
              >
                {Object.values(DietPreference).map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="text-zinc-500 text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5"><Scale size={10} /> Weight</label>
              <div className="flex bg-black/40 p-1 rounded-lg border border-zinc-800">
                {Object.values(WeightUnit).map(u => (
                  <button
                    key={u}
                    onClick={() => handleWeightUnitToggle(u)}
                    className={`px-3 py-1 rounded-md text-[8px] font-black uppercase transition-all ${formData.weightUnit === u ? 'bg-indigo-600 text-white' : 'text-zinc-600'}`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
            <input
              type="number"
              value={localWeight || ''}
              onFocus={e => e.target.select()}
              onChange={e => handleWeightChange(parseFloat(e.target.value))}
              className="w-full bg-black/40 border border-zinc-800 p-3 rounded-xl focus:border-indigo-500 outline-none font-black text-sm text-white"
            />
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="text-zinc-500 text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5"><Ruler size={10} /> Height</label>
              <div className="flex bg-black/40 p-1 rounded-lg border border-zinc-800">
                <button
                  onClick={() => handleHeightUnitToggle(HeightUnit.CM)}
                  className={`px-3 py-1 rounded-md text-[8px] font-black uppercase transition-all ${formData.heightUnit === HeightUnit.CM ? 'bg-indigo-600 text-white' : 'text-zinc-600'}`}
                >
                  CM
                </button>
                <button
                  onClick={() => handleHeightUnitToggle(HeightUnit.FT)}
                  className={`px-3 py-1 rounded-md text-[8px] font-black uppercase transition-all ${formData.heightUnit === HeightUnit.FT ? 'bg-indigo-600 text-white' : 'text-zinc-600'}`}
                >
                  FT/IN
                </button>
              </div>
            </div>
            {formData.heightUnit === HeightUnit.CM ? (
              <input
                type="number"
                value={formData.height ? Math.round(formData.height) : ''}
                onFocus={e => e.target.select()}
                onChange={e => setFormData({ ...formData, height: Math.max(0, parseInt(e.target.value) || 0) })}
                className="w-full bg-black/40 border border-zinc-800 p-3 rounded-xl focus:border-indigo-500 outline-none font-black text-sm text-white"
              />
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <input
                    type="number"
                    value={heightFt || ''}
                    onFocus={e => e.target.select()}
                    onChange={e => handleHeightFtInChange(Math.max(0, parseInt(e.target.value) || 0), heightIn)}
                    className="w-full bg-black/40 border border-zinc-800 p-3 pr-8 rounded-xl focus:border-indigo-500 outline-none font-black text-sm text-white"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-zinc-600 uppercase">ft</span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    value={heightIn || ''}
                    onFocus={e => e.target.select()}
                    onChange={e => handleHeightFtInChange(heightFt, Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full bg-black/40 border border-zinc-800 p-3 pr-8 rounded-xl focus:border-indigo-500 outline-none font-black text-sm text-white"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-zinc-600 uppercase">in</span>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 p-4 bg-black/40 border border-zinc-800 rounded-2xl space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <BrainCircuit size={12} className="text-indigo-500" />
              <h4 className="text-[9px] font-black uppercase text-zinc-500 tracking-widest">Calculated AI Protocol</h4>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center">
                <p className="text-[7px] font-black text-zinc-600 uppercase">Energy</p>
                <p className="text-xs font-black italic text-white">{calculatedProtocol.calories} kcal</p>
              </div>
              <div className="text-center border-x border-zinc-800">
                <p className="text-[7px] font-black text-zinc-600 uppercase">Protein</p>
                <p className="text-xs font-black italic text-emerald-500">{calculatedProtocol.protein}g</p>
              </div>
              <div className="text-center">
                <p className="text-[7px] font-black text-zinc-600 uppercase">Carbs</p>
                <p className="text-xs font-black italic text-orange-500">{calculatedProtocol.carbs}g</p>
              </div>
            </div>
          </div>
        </section>

        {/* New Rest & Recovery Section */}
        <section className="bg-zinc-900/50 p-6 rounded-[2.5rem] border border-zinc-800 space-y-4">
          <h3 className="text-xs font-black uppercase text-zinc-500 tracking-widest flex items-center gap-2">
            <CalendarOff size={14} className="text-amber-500" /> Recovery & Time Off
          </h3>

          <div className="space-y-3">
            {recentLeave ? (
              <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-amber-500 text-black rounded-lg shrink-0"><Coffee size={16} /></div>
                  <div>
                    <h4 className="text-[10px] font-black uppercase text-amber-200">Recovery Active</h4>
                    <p className="text-[8px] font-bold text-amber-500/70 mt-0.5">
                      Returned from {recentLeave.durationDays} day break. Weights reduced for safety.
                    </p>
                  </div>
                </div>
                <button onClick={handleCancelLeave} className="bg-amber-500/20 hover:bg-amber-500 hover:text-black text-amber-500 p-2 rounded-xl transition-all"><X size={14} /></button>
              </div>
            ) : (
              <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-wide">No recent breaks logged. Training at 100% intensity.</p>
            )}

            <div className="flex gap-2 items-end bg-black/40 p-4 rounded-2xl border border-zinc-800/50">
              <div className="flex-1 space-y-2">
                <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Log Recent Time Off (Days)</label>
                <input
                  type="number"
                  min="1"
                  value={leaveDays}
                  onChange={e => setLeaveDays(e.target.value === '' ? '' : parseInt(e.target.value))}
                  placeholder="e.g. 4"
                  className="w-full bg-zinc-900 border border-zinc-800 p-2.5 rounded-xl text-xs font-black text-white focus:border-indigo-500 outline-none placeholder:text-zinc-700"
                />
              </div>
              <button
                onClick={handleLogLeave}
                className="bg-zinc-800 text-zinc-300 px-4 py-2.5 rounded-xl border border-zinc-700 font-black text-[9px] uppercase tracking-widest hover:text-white hover:bg-zinc-700 transition-colors"
              >
                Report Break
              </button>
            </div>
          </div>
        </section>

        {/* Health & Injuries Section */}
        <section className="bg-zinc-900/50 p-6 rounded-[2.5rem] border border-zinc-800 space-y-4">
          <h3 className="text-xs font-black uppercase text-zinc-500 tracking-widest flex items-center gap-2">
            <AlertTriangle size={14} className="text-rose-500" /> Health Protocol
          </h3>
          <div className="space-y-3">
            <label className="text-zinc-500 text-[8px] font-black uppercase tracking-widest">Injuries & Limitations</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={injuryInput}
                onChange={e => setInjuryInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addInjury()}
                placeholder="e.g. Lower back pain, Shoulder impingement..."
                className="flex-1 bg-black/40 border border-zinc-800 p-3 rounded-xl focus:border-rose-500 outline-none font-black text-xs text-white"
              />
              <button onClick={addInjury} className="p-3 bg-zinc-800 rounded-xl text-rose-500 border border-zinc-700">
                <Plus size={18} />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {(formData.injuries || []).map((injury, i) => (
                <div key={i} className="bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-lg flex items-center gap-2 animate-in zoom-in-95">
                  <span className="text-[8px] font-black uppercase text-rose-200">{injury}</span>
                  <button onClick={() => setFormData({ ...formData, injuries: (formData.injuries || []).filter((_, idx) => idx !== i) })} className="text-rose-400">
                    <X size={10} />
                  </button>
                </div>
              ))}
              {(formData.injuries || []).length === 0 && (
                <p className="text-[7px] font-black text-zinc-700 uppercase tracking-widest italic py-2">No active injury profiles</p>
              )}
            </div>
          </div>
        </section>

        {/* Gym & Gear */}
        <section className="bg-zinc-900/50 p-6 rounded-[2.5rem] border border-zinc-800 space-y-4">
          <h3 className="text-xs font-black uppercase text-zinc-500 tracking-widest flex items-center gap-2">
            <Dumbbell size={14} className="text-indigo-500" /> Training Environment
          </h3>
          <div className="space-y-1 relative">
            <label className="text-zinc-500 text-[8px] font-black uppercase tracking-widest">Active Gym</label>
            <div className="relative">
              <input
                type="text"
                value={gymSearch}
                onChange={e => {
                  setGymSearch(e.target.value);
                  setShowGymList(true);
                }}
                onFocus={() => setShowGymList(true)}
                placeholder="Search or enter gym name..."
                className="w-full bg-black/40 border border-zinc-800 p-4 rounded-xl focus:border-indigo-500 outline-none font-black text-xs text-white pl-10"
              />
              <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />

              {showGymList && gymSearch && (
                <div className="absolute top-full left-0 w-full mt-2 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl z-50 overflow-hidden max-h-72 overflow-y-auto animate-in slide-in-from-top-2">

                  {/* LOCAL RESULTS */}
                  <div className="p-2 border-b border-zinc-800 bg-black/40 flex items-center gap-2">
                    <Database size={10} className="text-zinc-500" />
                    <span className="text-[7px] font-black text-zinc-500 uppercase tracking-widest">Verified Network</span>
                  </div>
                  {filteredLocalGyms.length > 0 ? (
                    filteredLocalGyms.map(gym => (
                      <button
                        key={gym.name}
                        onClick={() => handleSelectGym(gym, false)}
                        className="w-full p-4 text-left font-black uppercase text-[10px] italic border-b border-zinc-800/50 hover:bg-indigo-600/10 transition-colors flex justify-between items-center group"
                      >
                        <div>
                          <span>{gym.name}</span>
                          <p className="text-[7px] not-italic text-zinc-600 mt-0.5">{gym.location}</p>
                        </div>
                        <Zap size={10} className="text-indigo-500" />
                      </button>
                    ))
                  ) : (
                    <div className="p-4 text-center text-[9px] text-zinc-600 italic">No local matches</div>
                  )}

                  {/* ONLINE SEARCH BUTTON & RESULTS */}
                  <div className="p-2 border-b border-zinc-800 bg-black/40 flex items-center gap-2 border-t mt-2">
                    <Globe size={10} className="text-emerald-500" />
                    <span className="text-[7px] font-black text-emerald-500 uppercase tracking-widest">Google Maps Search</span>
                  </div>

                  {isSearchingOnline ? (
                    <div className="p-6 flex justify-center items-center gap-2">
                      <Loader2 size={16} className="animate-spin text-emerald-500" />
                      <span className="text-[9px] font-bold text-zinc-500">Scanning Area...</span>
                    </div>
                  ) : onlineGyms.length > 0 ? (
                    onlineGyms.map((gym, i) => (
                      <button
                        key={i}
                        onClick={() => handleSelectGym(gym, true)}
                        className="w-full p-4 text-left font-black uppercase text-[10px] italic border-b border-zinc-800/50 hover:bg-emerald-600/10 transition-colors flex justify-between items-center group"
                      >
                        <div>
                          <span className="text-emerald-400">{gym.name}</span>
                          <p className="text-[7px] not-italic text-zinc-500 mt-0.5">{gym.location}</p>
                        </div>
                        <Plus size={10} className="text-emerald-500" />
                      </button>
                    ))
                  ) : (
                    <button
                      onClick={handleOnlineSearch}
                      className="w-full p-4 text-left font-black uppercase text-[9px] hover:bg-zinc-800/50 transition-all flex items-center gap-2 text-zinc-400 hover:text-white"
                    >
                      <Search size={12} /> Search Online for "{gymSearch}"
                    </button>
                  )}

                  {/* Manual Add Fallback */}
                  {filteredLocalGyms.length === 0 && onlineGyms.length === 0 && !isSearchingOnline && (
                    <button
                      onClick={handleAddCustomGym}
                      className="w-full p-4 text-left font-black uppercase text-[10px] bg-indigo-600/10 border-t border-zinc-800/50 hover:bg-indigo-600/20 transition-all flex items-center gap-3 group"
                    >
                      <div className="p-1.5 bg-indigo-600 rounded-lg group-hover:scale-110 transition-transform">
                        <Plus size={12} className="text-white" />
                      </div>
                      <div>
                        <p className="text-white italic">Add "{gymSearch}" Manually</p>
                        <p className="text-[6px] text-zinc-500 tracking-widest mt-0.5">REGISTER CUSTOM LOCATION</p>
                      </div>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-end">
              <label className="text-zinc-500 text-[8px] font-black uppercase tracking-widest">Gear Inventory</label>
              <button
                onClick={() => scanGearRef.current?.click()}
                disabled={isScanning}
                className="flex items-center gap-1.5 bg-indigo-600/10 text-indigo-500 border border-indigo-500/20 px-3 py-1.5 rounded-lg active:scale-95 transition-all"
              >
                {isScanning ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                <span className="text-[7px] font-black uppercase tracking-widest">Scan Gym Photo</span>
              </button>
              <input type="file" ref={scanGearRef} onChange={handleScanGear} accept="image/*" className="hidden" />
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={equipmentInput}
                onChange={e => setEquipmentInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addEquipment()}
                placeholder="Add Machine/Gear..."
                className="flex-1 bg-black/40 border border-zinc-800 p-3 rounded-xl focus:border-indigo-500 outline-none font-black text-xs text-white"
              />
              <button onClick={addEquipment} className="p-3 bg-zinc-800 rounded-xl text-indigo-500 border border-zinc-700">
                <Plus size={18} />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2 max-h-32 overflow-y-auto">
              {formData.equipment.map((eq, i) => (
                <div key={i} className="bg-indigo-600/10 border border-indigo-500/20 px-2.5 py-1 rounded-lg flex items-center gap-2 animate-in zoom-in-95">
                  <span className="text-[8px] font-black uppercase text-indigo-100">{eq}</span>
                  <button onClick={() => setFormData({ ...formData, equipment: formData.equipment.filter((_, idx) => idx !== i) })} className="text-indigo-400">
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* System Feedback & Suggestions */}
        <section className="bg-zinc-900/50 p-6 rounded-[2.5rem] border border-zinc-800 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-black uppercase text-zinc-500 tracking-widest flex items-center gap-2">
              <Lightbulb size={14} className="text-amber-400" /> Suggest Update
            </h3>
            <button
              onClick={() => setShowSuggestionForm(!showSuggestionForm)}
              className="text-[9px] font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              {showSuggestionForm ? 'Hide Form' : 'Submit Feedback'}
            </button>
          </div>

          {showSuggestionForm && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
              <p className="text-[10px] text-zinc-400 italic">Have an idea or found a bug? Let us know to improve the app.</p>

              <div className="flex gap-2">
                {(['feature', 'bug', 'other'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setSuggestionType(type)}
                    className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-xl border transition-all ${suggestionType === type ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-black/40 border-zinc-800 text-zinc-500'}`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Short Title..."
                  value={suggestionTitle}
                  onChange={e => setSuggestionTitle(e.target.value)}
                  className="w-full bg-black/40 border border-zinc-800 p-3 rounded-xl focus:border-indigo-500 outline-none font-black text-xs text-white"
                />
                <textarea
                  placeholder="Describe your suggestion or issue in detail..."
                  rows={3}
                  value={suggestionDesc}
                  onChange={e => setSuggestionDesc(e.target.value)}
                  className="w-full bg-black/40 border border-zinc-800 p-3 rounded-xl focus:border-indigo-500 outline-none font-black text-xs text-white resize-none"
                />
              </div>

              <button
                onClick={handleSuggestionSubmit}
                disabled={isSubmittingSuggestion}
                className="w-full bg-indigo-600 text-white py-3 rounded-xl flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all"
              >
                {isSubmittingSuggestion ? <Loader2 size={14} className="animate-spin" /> : <MessageSquare size={14} />}
                {isSubmittingSuggestion ? 'Submitting...' : 'Send to Developers'}
              </button>
            </div>
          )}
        </section>

        <div className="pt-8 pb-20">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full bg-white text-black py-5 rounded-[2rem] font-black text-xs italic tracking-[0.2em] shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all uppercase"
          >
            {isSaving ? (
              <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <><Save size={18} /> Apply Synchronization</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
