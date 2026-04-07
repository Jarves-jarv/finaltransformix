
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { UserProfile, Gender, BodyType, FitnessGoal, ExperienceLevel, DietPreference, WeightUnit, HeightUnit, Gym } from '../types';
import { scanGymEquipment, findGymsWithMaps } from '../services/geminiService';
import { ArrowRight, ChevronLeft, Camera, ShieldCheck, Dumbbell, User, Target, Loader2, Sparkles, Zap, Search, MapPin, X, PlusCircle, Leaf, Utensils, BrainCircuit, Plus, Ruler, Scale, Globe, Database, Upload } from 'lucide-react';

interface Props {
  onComplete: (profile: UserProfile) => void;
  initialData?: Partial<UserProfile>;
}

const VERIFIED_GYMS = [
  { name: "Gold's Gym", equipment: ['Dumbbells', 'Barbell', 'Bench', 'Cables', 'Leg Press', 'Rack', 'Smith Machine', 'Lat Pulldown'] },
  { name: "Powerhouse Elite", equipment: ['Dumbbells', 'Barbell', 'Bench', 'Squat Rack', 'Incline Bench', 'Pull-up Bar'] },
  { name: "Cult.fit Sanctuary", equipment: ['Kettlebells', 'Dumbbells', 'Box', 'Pull-up Bar', 'TRX', 'Medicine Ball'] },
  { name: "Anytime Fitness", equipment: ['Treadmill', 'Cables', 'Smith Machine', 'Dumbbells', 'Bench'] },
];

const BODY_TYPE_LABELS = {
  [BodyType.ECTOMORPH]: { label: 'Slim / Lean', desc: 'Hard to gain mass' },
  [BodyType.MESOMORPH]: { label: 'Athletic / Balanced', desc: 'Natural muscle build' },
  [BodyType.ENDOMORPH]: { label: 'Heavy / Bulk', desc: 'Gains mass easily' },
};

const EXPERIENCE_LABELS = {
  [ExperienceLevel.BEGINNER]: { label: 'Newbie', desc: '0-6 months' },
  [ExperienceLevel.INTERMEDIATE]: { label: 'Steady', desc: '1-2 years' },
  [ExperienceLevel.ADVANCED]: { label: 'Elite', desc: '3+ years' },
};

const COMMON_FOODS = [
  'Chicken Breast', 'Rice', 'Oats', 'Eggs', 'Whey Protein', 'Paneer', 'Soya Chunks',
  'Fish', 'Broccoli', 'Avocado', 'Peanut Butter', 'Milk', 'Almonds', 'Quinoa', 'Lentils'
];

export const Onboarding: React.FC<Props> = ({ onComplete, initialData }) => {
  const [step, setStep] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [gymSearch, setGymSearch] = useState('');
  const [showGymList, setShowGymList] = useState(false);
  const [foodInput, setFoodInput] = useState('');
  const [manualEquipInput, setManualEquipInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [onlineGyms, setOnlineGyms] = useState<Gym[]>([]);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);

  const handleOnlineSearch = async () => {
    if (!gymSearch.trim()) return;
    setIsSearchingOnline(true);
    setOnlineGyms([]);

    try {
      const results = await findGymsWithMaps(gymSearch);
      if (results.length > 0) {
        setOnlineGyms(results);
      }
    } catch (e) {
      console.error("Online search failed", e);
    } finally {
      setIsSearchingOnline(false);
    }
  };

  const [data, setData] = useState<UserProfile>({
    gender: Gender.MALE,
    age: 25,
    height: 175,
    weight: 75,
    weightUnit: WeightUnit.KG,
    heightUnit: HeightUnit.CM,
    bodyType: BodyType.MESOMORPH,
    experience: ExperienceLevel.BEGINNER,
    goal: FitnessGoal.MUSCLE_GAIN,
    dietPreference: DietPreference.VEGETARIAN,
    typicalMeals: [],
    equipment: [],
    gymName: '',
    isPassActive: false,
    referrals: 0,
    videoUploads: 0,
    ...initialData // Merge registration data (name, email, password)
  });

  // Local state for FT-IN handling
  const [heightFt, setHeightFt] = useState(5);
  const [heightIn, setHeightIn] = useState(9);
  const [localWeight, setLocalWeight] = useState(75);

  const filteredGyms = useMemo(() =>
    VERIFIED_GYMS.filter(g => g.name.toLowerCase().includes(gymSearch.toLowerCase())),
    [gymSearch]
  );

  useEffect(() => {
    if (data.weightUnit === WeightUnit.LBS) {
      setLocalWeight(Math.round(data.weight * 2.20462));
    } else {
      setLocalWeight(Math.round(data.weight));
    }
  }, [data.weightUnit]);

  useEffect(() => {
    if (data.heightUnit === HeightUnit.FT) {
      const totalInches = data.height / 2.54;
      setHeightFt(Math.floor(totalInches / 12));
      setHeightIn(Math.round(totalInches % 12));
    }
  }, [data.heightUnit]);

  const updateWeight = (val: number) => {
    const cleanVal = val || 0;
    setLocalWeight(cleanVal);
    if (data.weightUnit === WeightUnit.LBS) {
      setData({ ...data, weight: cleanVal / 2.20462 });
    } else {
      setData({ ...data, weight: cleanVal });
    }
  };

  const updateHeightFromFtIn = (ft: number, inc: number) => {
    let finalFt = ft || 0;
    let finalIn = inc || 0;

    // RULE: Inch never touch 12. If inc >= 12, increment ft and reset in.
    if (finalIn >= 12) {
      finalFt += Math.floor(finalIn / 12);
      finalIn = finalIn % 12;
    }

    setHeightFt(finalFt);
    setHeightIn(finalIn);
    const cm = (finalFt * 12 + finalIn) * 2.54;
    setData({ ...data, height: cm });
  };

  const next = () => {
    if (step === 1 && (data.age < 12 || data.weight < 30)) {
      setError("Please enter valid biological stats");
      return;
    }
    setError(null);
    setStep(s => s + 1);
  };

  const prev = () => setStep(s => s - 1);

  const handleSelectGym = (gym: any) => {
    setData({
      ...data,
      gymName: gym.name,
      equipment: Array.from(new Set([...data.equipment, ...(gym.equipment || [])]))
    });
    setGymSearch(gym.name);
    setShowGymList(false);
    setOnlineGyms([]);
  };

  const handleAddCustomGym = () => {
    if (gymSearch.trim()) {
      setData({ ...data, gymName: gymSearch.trim() });
      setShowGymList(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const identified = await scanGymEquipment(base64);

        if (identified && Array.isArray(identified)) {
          const normalizedNew = identified.map(item =>
            item.trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
          );

          setData(prev => {
            const currentEquipSet = new Set(prev.equipment);
            const trulyNew = normalizedNew.filter(item => !currentEquipSet.has(item));
            if (trulyNew.length === 0) return prev;
            return {
              ...prev,
              equipment: Array.from(new Set([...prev.equipment, ...trulyNew]))
            };
          });
        }
        setIsScanning(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Scan failed", err);
      setIsScanning(false);
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const handleAddFood = (food: string) => {
    if (!food.trim()) return;
    setData(prev => ({
      ...prev,
      typicalMeals: Array.from(new Set([...prev.typicalMeals, food.trim()]))
    }));
    setFoodInput('');
  };

  const handleAddManualEquip = () => {
    if (!manualEquipInput.trim()) return;
    const normalized = manualEquipInput.trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    setData(prev => ({
      ...prev,
      equipment: Array.from(new Set([...prev.equipment, normalized]))
    }));
    setManualEquipInput('');
  };

  const handleFinish = (passActive: boolean) => {
    setIsSubmitting(true);
    onComplete({ ...data, isPassActive: passActive });
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="flex flex-col items-center justify-center text-center space-y-10 h-full py-12 px-8 animate-in fade-in zoom-in-95 duration-700 relative overflow-hidden">
            <div className="absolute top-1/4 -left-20 w-64 h-64 bg-indigo-600/10 blur-[100px] rounded-full"></div>
            <div className="absolute bottom-1/4 -right-20 w-64 h-64 bg-emerald-600/5 blur-[100px] rounded-full"></div>
            <div className="relative group">
              <div className="w-24 h-24 bg-indigo-600 rounded-[2rem] rotate-12 flex items-center justify-center shadow-[0_0_50px_rgba(79,70,229,0.5)] transition-transform duration-1000 group-hover:rotate-0">
                <span className="text-5xl font-black italic -rotate-12 text-white group-hover:rotate-0 transition-transform duration-1000">T</span>
              </div>
              <div className="absolute -inset-2 bg-indigo-400/20 blur-xl rounded-full animate-pulse"></div>
            </div>
            <div className="space-y-3 relative z-10">
              <div className="flex flex-col items-center">
                <p className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em] mb-2">Welcome, {data.name || 'Agent'}</p>
                <h1 className="text-5xl font-black tracking-tighter italic uppercase leading-none text-white">TRANSFORMIX</h1>
              </div>
              <div className="flex items-center justify-center gap-2">
                <div className="h-[1px] w-8 bg-zinc-800"></div>
                <p className="text-zinc-600 font-black uppercase tracking-[0.4em] text-[8px]">AI Hypertrophy OS</p>
                <div className="h-[1px] w-8 bg-zinc-800"></div>
              </div>
            </div>
            <div className="space-y-6 relative z-10">
              <p className="text-zinc-400 text-sm leading-relaxed max-w-[260px] mx-auto font-medium">
                The next evolution in personalized human performance. Elite AI coaching for those who demand more than generic.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <div className="flex items-center gap-1.5 bg-zinc-900/50 px-3 py-1.5 rounded-full border border-zinc-800">
                  <BrainCircuit size={10} className="text-indigo-400" />
                  <span className="text-[7px] font-black uppercase tracking-widest text-zinc-500">Neural Sync</span>
                </div>
                <div className="flex items-center gap-1.5 bg-zinc-900/50 px-3 py-1.5 rounded-full border border-zinc-800">
                  <Target size={10} className="text-emerald-400" />
                  <span className="text-[7px] font-black uppercase tracking-widest text-zinc-500">Precision Labs</span>
                </div>
              </div>
            </div>
            <button
              onClick={next}
              className="w-full bg-white text-black py-5 rounded-2xl font-black text-xs flex items-center justify-center gap-3 hover:bg-zinc-200 transition-all active:scale-95 shadow-[0_20px_40px_rgba(0,0,0,0.4)] uppercase tracking-[0.2em] relative z-10"
            >
              Complete Profile <ArrowRight size={16} />
            </button>
            <p className="text-[7px] text-zinc-700 font-black uppercase tracking-[0.2em]">Version 3.1.2 // Secure Local Encryption</p>
          </div>
        );

      case 1:
        return (
          <div className="space-y-5 px-6 animate-in slide-in-from-right-8 duration-500 h-full overflow-y-auto scrollbar-hide">
            <h2 className="text-2xl font-black italic tracking-tighter uppercase leading-none mt-4">Physical<br /><span className="text-indigo-500">Core</span></h2>
            {error && <p className="text-rose-500 text-[8px] font-black uppercase bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/20">{error}</p>}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-zinc-500 text-[8px] font-black uppercase tracking-widest">Gender</label>
                <select value={data.gender} onChange={e => setData({ ...data, gender: e.target.value as Gender })} className="w-full bg-zinc-900 border border-zinc-800 p-3 rounded-lg outline-none font-black text-[10px] h-[46px]">
                  {Object.values(Gender).map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-zinc-500 text-[8px] font-black uppercase tracking-widest">Age</label>
                <input
                  type="number"
                  value={data.age || ''}
                  onFocus={e => e.target.select()}
                  onChange={e => setData({ ...data, age: Math.max(0, parseInt(e.target.value) || 0) })}
                  className="w-full bg-zinc-900 border border-zinc-800 p-3 rounded-lg focus:border-indigo-500 outline-none font-black text-sm"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-zinc-500 text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5"><Scale size={10} /> Weight</label>
                <div className="flex bg-zinc-900 p-1 rounded-lg border border-zinc-800">
                  {Object.values(WeightUnit).map(u => (
                    <button
                      key={u}
                      onClick={() => setData({ ...data, weightUnit: u })}
                      className={`px-3 py-1 rounded-md text-[8px] font-black uppercase transition-all ${data.weightUnit === u ? 'bg-indigo-600 text-white' : 'text-zinc-600'}`}
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
                onChange={e => updateWeight(parseFloat(e.target.value))}
                className="w-full bg-zinc-900 border border-zinc-800 p-3 rounded-lg outline-none font-black text-sm"
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-zinc-500 text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5"><Ruler size={10} /> Height</label>
                <div className="flex bg-zinc-900 p-1 rounded-lg border border-zinc-800">
                  <button
                    onClick={() => setData({ ...data, heightUnit: HeightUnit.CM })}
                    className={`px-3 py-1 rounded-md text-[8px] font-black uppercase transition-all ${data.heightUnit === HeightUnit.CM ? 'bg-indigo-600 text-white' : 'text-zinc-600'}`}
                  >
                    CM
                  </button>
                  <button
                    onClick={() => setData({ ...data, heightUnit: HeightUnit.FT })}
                    className={`px-3 py-1 rounded-md text-[8px] font-black uppercase transition-all ${data.heightUnit === HeightUnit.FT ? 'bg-indigo-600 text-white' : 'text-zinc-600'}`}
                  >
                    FT/IN
                  </button>
                </div>
              </div>

              {data.heightUnit === HeightUnit.CM ? (
                <input
                  type="number"
                  value={data.height ? Math.round(data.height) : ''}
                  onFocus={e => e.target.select()}
                  onChange={e => setData({ ...data, height: Math.max(0, parseInt(e.target.value) || 0) })}
                  className="w-full bg-zinc-900 border border-zinc-800 p-3 rounded-lg outline-none font-black text-sm"
                  placeholder="cm"
                />
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <input
                      type="number"
                      value={heightFt || ''}
                      onFocus={e => e.target.select()}
                      onChange={e => updateHeightFromFtIn(Math.max(0, parseInt(e.target.value) || 0), heightIn)}
                      className="w-full bg-zinc-900 border border-zinc-800 p-3 pr-8 rounded-lg outline-none font-black text-sm"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-zinc-600 uppercase">ft</span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      value={heightIn || ''}
                      onFocus={e => e.target.select()}
                      onChange={e => updateHeightFromFtIn(heightFt, Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-zinc-900 border border-zinc-800 p-3 pr-8 rounded-lg outline-none font-black text-sm"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-zinc-600 uppercase">in</span>
                  </div>
                </div>
              )}
            </div>

            <button onClick={next} className="w-full bg-indigo-600 py-4 rounded-xl font-black text-xs mt-4 shadow-xl active:scale-95 transition-all uppercase tracking-widest">Next</button>
          </div>
        );

      case 2:
        return (
          <div className="space-y-5 px-6 animate-in slide-in-from-right-8 duration-500 h-full overflow-y-auto scrollbar-hide">
            <h2 className="text-2xl font-black italic tracking-tighter uppercase leading-none mt-4">Physique<br /><span className="text-indigo-500">Status</span></h2>
            <div className="space-y-2.5">
              <label className="text-zinc-500 text-[8px] font-black uppercase tracking-widest flex items-center gap-2">
                <Sparkles size={10} className="text-indigo-400" /> Current Body Type
              </label>
              <div className="grid grid-cols-1 gap-2">
                {Object.values(BodyType).map(bt => (
                  <button
                    key={bt}
                    onClick={() => setData({ ...data, bodyType: bt })}
                    className={`p-3.5 rounded-xl border text-left transition-all ${data.bodyType === bt ? 'bg-indigo-600 border-indigo-500' : 'bg-zinc-900 border-zinc-800 opacity-60'}`}
                  >
                    <div className="font-black text-xs italic uppercase tracking-tighter">{BODY_TYPE_LABELS[bt].label}</div>
                    <div className={`text-[7px] font-bold uppercase tracking-widest mt-0.5 ${data.bodyType === bt ? 'text-indigo-100' : 'text-zinc-500'}`}>
                      {BODY_TYPE_LABELS[bt].desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2.5">
              <label className="text-zinc-500 text-[8px] font-black uppercase tracking-widest flex items-center gap-2">
                <Zap size={10} className="text-indigo-400" /> Experience Level
              </label>
              <div className="grid grid-cols-3 gap-2">
                {Object.values(ExperienceLevel).map(exp => (
                  <button
                    key={exp}
                    onClick={() => setData({ ...data, experience: exp })}
                    className={`py-2.5 rounded-lg border text-[8px] font-black flex flex-col items-center transition-all ${data.experience === exp ? 'bg-indigo-600 border-indigo-500' : 'bg-zinc-900 border-zinc-800 opacity-60'}`}
                  >
                    <span className="uppercase">{EXPERIENCE_LABELS[exp].label}</span>
                    <span className={`text-[6px] font-bold mt-0.5 opacity-60 ${data.experience === exp ? 'text-white' : 'text-zinc-500'}`}>{exp}</span>
                  </button>
                ))}
              </div>
            </div>
            <button onClick={next} className="w-full bg-indigo-600 py-4 rounded-xl font-black text-xs mt-2 shadow-xl active:scale-95 transition-all uppercase tracking-widest">Continue</button>
          </div>
        );

      case 3:
        return (
          <div className="space-y-5 px-6 animate-in slide-in-from-right-8 duration-500 h-full overflow-y-auto scrollbar-hide">
            <h2 className="text-2xl font-black italic tracking-tighter uppercase leading-none mt-4">Primary<br /><span className="text-indigo-500">Objective</span></h2>
            <div className="grid grid-cols-1 gap-2.5">
              {Object.values(FitnessGoal).map(g => (
                <button key={g} onClick={() => setData({ ...data, goal: g })} className={`p-4 rounded-2xl border flex items-center justify-between group transition-all ${data.goal === g ? 'bg-indigo-600 border-indigo-500 shadow-xl' : 'bg-zinc-900 border-zinc-800 opacity-60'}`}>
                  <span className="font-black text-sm italic uppercase tracking-tighter">{g}</span>
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${data.goal === g ? 'bg-white border-white text-indigo-600' : 'border-zinc-700'}`}>
                    {data.goal === g && <ArrowRight size={10} />}
                  </div>
                </button>
              ))}
            </div>
            <button onClick={next} className="w-full bg-indigo-600 py-4 rounded-xl font-black text-xs mt-4 shadow-xl uppercase tracking-widest">Next</button>
          </div>
        );

      case 4:
        return (
          <div className="space-y-5 px-6 animate-in slide-in-from-right-8 duration-500 h-full overflow-y-auto scrollbar-hide">
            <h2 className="text-2xl font-black italic tracking-tighter uppercase leading-none mt-4">Nutrition<br /><span className="text-indigo-500">Profile</span></h2>

            <div className="space-y-2.5">
              <label className="text-zinc-500 text-[8px] font-black uppercase tracking-widest flex items-center gap-2">
                <Leaf size={10} className="text-indigo-400" /> Diet Preference
              </label>
              <div className="grid grid-cols-3 gap-2">
                {Object.values(DietPreference).map(pref => (
                  <button
                    key={pref}
                    onClick={() => setData({ ...data, dietPreference: pref })}
                    className={`py-3 rounded-xl border text-[8px] font-black uppercase transition-all ${data.dietPreference === pref ? 'bg-indigo-600 border-indigo-500' : 'bg-zinc-900 border-zinc-800 opacity-60'}`}
                  >
                    {pref}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2.5">
              <label className="text-zinc-500 text-[8px] font-black uppercase tracking-widest flex items-center gap-2">
                <Utensils size={10} className="text-indigo-400" /> Typical Foods
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={foodInput}
                  onChange={(e) => setFoodInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddFood(foodInput)}
                  placeholder="e.g. Chicken, Oats, Paneer..."
                  className="w-full bg-zinc-900 border border-zinc-800 p-3 rounded-lg font-bold pl-10 focus:border-indigo-500 outline-none text-xs"
                />
                <PlusCircle size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
              </div>

              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pt-1">
                {COMMON_FOODS.filter(f => !data.typicalMeals.includes(f)).slice(0, 6).map(f => (
                  <button
                    key={f}
                    onClick={() => handleAddFood(f)}
                    className="text-[7px] font-black uppercase px-2 py-1 bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
                  >
                    + {f}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-1.5 pt-2">
                {data.typicalMeals.map(food => (
                  <div key={food} className="bg-indigo-600/10 border border-indigo-500/20 pl-2.5 pr-1 py-1 rounded flex items-center gap-1.5">
                    <span className="text-[7px] font-black uppercase text-indigo-100">{food}</span>
                    <button onClick={() => setData({ ...data, typicalMeals: data.typicalMeals.filter(f => f !== food) })} className="p-0.5 hover:text-white text-indigo-400"><X size={8} /></button>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={next} className="w-full bg-indigo-600 py-4 rounded-xl font-black text-xs mt-2 shadow-xl active:scale-95 transition-all uppercase tracking-widest">Next</button>
          </div>
        );

      case 5:
        return (
          <div className="space-y-4 px-6 relative pb-4 animate-in slide-in-from-right-8 duration-500 h-full overflow-y-auto scrollbar-hide">
            <h2 className="text-2xl font-black italic tracking-tighter uppercase leading-none mt-4">Battle<br /><span className="text-indigo-500">Gear</span></h2>
            <div className="space-y-2.5">
              <label className="text-zinc-500 text-[8px] font-black uppercase tracking-widest flex items-center gap-2">
                <MapPin size={10} className="text-indigo-400" /> Current Location / Gym
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={gymSearch}
                  onChange={(e) => {
                    setGymSearch(e.target.value);
                    setShowGymList(true);
                    setData({ ...data, gymName: e.target.value });
                  }}
                  onFocus={() => setShowGymList(true)}
                  placeholder="Type or search gym name..."
                  className="w-full bg-zinc-900 border border-zinc-800 p-3 rounded-lg font-bold pl-10 focus:border-indigo-500 outline-none text-xs"
                />
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
                {gymSearch && !VERIFIED_GYMS.some(g => g.name === gymSearch) && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 bg-indigo-600/20 text-indigo-400 px-1.5 py-0.5 rounded-[4px] text-[6px] font-black uppercase">Custom</div>
                )}
                {showGymList && gymSearch && (
                  <div className="absolute top-full mt-1 w-full bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl z-50 overflow-hidden max-h-64 overflow-y-auto animate-in slide-in-from-top-2">
                    {/* LOCAL RESULTS */}
                    <div className="p-2 border-b border-zinc-800 bg-black/40 flex items-center gap-2">
                      <Database size={10} className="text-zinc-500" />
                      <span className="text-[7px] font-black text-zinc-500 uppercase tracking-widest">Verified Network</span>
                    </div>

                    {filteredGyms.length > 0 ? (
                      filteredGyms.map(gym => (
                        <button
                          key={gym.name}
                          onClick={() => handleSelectGym(gym)}
                          className="w-full p-3 text-left font-black uppercase text-[8px] italic border-b border-zinc-800/50 hover:bg-indigo-600/10 transition-colors flex justify-between items-center group"
                        >
                          <span>{gym.name}</span>
                          <Zap size={10} className="text-indigo-500 opacity-0 group-hover:opacity-100" />
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
                          onClick={() => handleSelectGym(gym)}
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
                    {filteredGyms.length === 0 && onlineGyms.length === 0 && !isSearchingOnline && (
                      <button
                        onClick={handleAddCustomGym}
                        className="w-full p-4 text-left font-black uppercase text-[10px] bg-indigo-600/10 border-t border-zinc-800/50 hover:bg-indigo-600/20 transition-all flex items-center gap-3 group"
                      >
                        <div className="p-1.5 bg-indigo-600 rounded-lg group-hover:scale-110 transition-transform">
                          <Plus size={12} className="text-white" />
                        </div>
                        <div>
                          <p className="text-white italic">Add "{gymSearch}"</p>
                          <p className="text-[6px] text-zinc-500 tracking-widest mt-0.5">REGISTER AS CUSTOM LOCATION</p>
                        </div>
                      </button>
                    )}
                    <button onClick={() => setShowGymList(false)} className="w-full p-2 text-center text-[7px] font-black text-zinc-600 bg-black/50 uppercase border-t border-zinc-800/50">Hide Results</button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} className="hidden" onChange={handleFileUpload} />
              <button
                onClick={() => cameraInputRef.current?.click()}
                disabled={isScanning}
                className="flex-1 p-4 bg-zinc-900 border border-zinc-800 rounded-2xl group flex flex-col justify-center items-center gap-2 transition-all hover:border-indigo-500/50 active:scale-95 text-center"
              >
                <div className="p-2.5 bg-indigo-600 rounded-lg shadow-lg">
                  {isScanning ? <Loader2 size={16} className="animate-spin text-white" /> : <Camera size={16} className="text-white" />}
                </div>
                <div>
                  <h3 className="font-black text-[10px] uppercase italic text-white">{isScanning ? 'Decoding...' : 'Live Camera'}</h3>
                  <p className="text-zinc-500 text-[6px] font-black uppercase tracking-widest mt-0.5">Take a photo</p>
                </div>
              </button>

              <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isScanning}
                className="flex-1 p-4 bg-zinc-900 border border-zinc-800 rounded-2xl group flex flex-col justify-center items-center gap-2 transition-all hover:border-zinc-500/50 active:scale-95 text-center"
              >
                <div className="p-2.5 bg-zinc-800 rounded-lg shadow-lg">
                  {isScanning ? <Loader2 size={16} className="animate-spin text-zinc-400" /> : <Upload size={16} className="text-zinc-400" />}
                </div>
                <div>
                  <h3 className="font-black text-[10px] uppercase italic text-white">{isScanning ? 'Waiting...' : 'Upload Photo'}</h3>
                  <p className="text-zinc-500 text-[6px] font-black uppercase tracking-widest mt-0.5">From gallery</p>
                </div>
              </button>
            </div>

            <div className="space-y-3">
              <label className="text-zinc-500 text-[8px] font-black uppercase tracking-widest flex items-center gap-2">
                <Plus size={10} className="text-indigo-400" /> Manual Gear Entry
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={manualEquipInput}
                  onChange={(e) => setManualEquipInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddManualEquip()}
                  placeholder="e.g. Leg Press, Dumbbells, Bench..."
                  className="w-full bg-zinc-900 border border-zinc-800 p-3 rounded-lg font-bold pl-10 focus:border-indigo-500 outline-none text-xs"
                />
                <PlusCircle size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 cursor-pointer hover:text-indigo-500 transition-colors" onClick={handleAddManualEquip} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label className="text-zinc-500 text-[8px] font-black uppercase tracking-widest">Equipment Inventory</label>
                <span className="text-indigo-500 text-[8px] font-black">{data.equipment.length} Items</span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
                {data.equipment.map(eq => (
                  <div key={eq} className="bg-indigo-600/10 border border-indigo-500/20 pl-2.5 pr-1 py-1 rounded flex items-center gap-1.5 animate-in zoom-in-95">
                    <span className="text-[7px] font-black uppercase text-indigo-100">{eq}</span>
                    <button onClick={() => setData({ ...data, equipment: data.equipment.filter(e => e !== eq) })} className="p-0.5 hover:text-white text-indigo-400"><X size={8} /></button>
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={next}
              className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black text-xs mt-4 shadow-xl uppercase tracking-widest active:scale-95 transition-all shrink-0 mb-6"
            >
              Finalize Profile
            </button>
          </div>
        );

      case 6:
        return (
          <div className="space-y-6 px-6 h-full flex flex-col justify-center animate-in zoom-in-95 overflow-y-auto scrollbar-hide py-10">
            <div className="bg-gradient-to-br from-indigo-950/80 to-zinc-950 p-6 rounded-[2.5rem] border border-indigo-500/40 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5 rotate-12"><Dumbbell size={120} /></div>
              <span className="bg-indigo-600 text-[8px] uppercase font-black px-3 py-1 rounded-full mb-4 inline-block tracking-widest text-white">TRANSFORMIX PASS</span>
              <h2 className="text-3xl font-black mb-3 italic tracking-tighter uppercase leading-tight text-white">ALL INDIA<br />GYM ACCESS</h2>
              <p className="text-zinc-400 text-[11px] mb-8 leading-relaxed font-medium italic">8,100+ Premium Gyms. One unified digital key for your transformation.</p>
              <div className="flex flex-col gap-3 mb-8">
                <div className="flex items-baseline gap-2 border-l-2 border-indigo-500 pl-4">
                  <span className="text-4xl font-black italic text-white tracking-tighter">₹1637<span className="text-xl">/mo</span></span>
                  <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest ml-1">Easy EMI</span>
                </div>
                <div className="bg-indigo-600/10 border border-indigo-500/20 py-2.5 px-3.5 rounded-xl flex items-center gap-2.5 w-max">
                  <Sparkles size={14} className="text-indigo-400 animate-pulse" />
                  <div>
                    <p className="text-[10px] font-black uppercase text-indigo-100 italic tracking-[0.15em] leading-none">Instant Activation</p>
                    <p className="text-[8px] font-bold text-indigo-400 uppercase tracking-widest mt-1">Start transforming today</p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleFinish(true)}
                disabled={isSubmitting}
                className="w-full bg-white text-black py-5 rounded-2xl font-black text-xs italic shadow-2xl active:scale-95 transition-all uppercase tracking-widest flex items-center justify-center gap-2"
              >
                {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <>Activate Access <ArrowRight size={16} /></>}
              </button>
            </div>
            <button
              onClick={() => handleFinish(false)}
              disabled={isSubmitting}
              className="w-full text-zinc-600 py-2 font-black text-[10px] tracking-widest hover:text-white transition-all uppercase italic"
            >
              Skip for now
            </button>
          </div>
        );
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-black text-white max-w-md mx-auto flex flex-col relative overflow-hidden">
      {step > 0 && step < 6 && (
        <button
          onClick={prev}
          className="absolute top-6 left-6 p-2.5 bg-zinc-900 rounded-full z-[60] border border-zinc-800 hover:bg-zinc-800 transition-colors shadow-lg active:scale-90"
        >
          <ChevronLeft size={20} />
        </button>
      )}
      <div className="flex-1 flex flex-col justify-center relative">
        {renderStep()}
      </div>
      {step < 6 && (
        <div className="flex-none p-6 flex justify-center gap-2 bg-gradient-to-t from-black via-black to-transparent">
          {[0, 1, 2, 3, 4, 5].map(i => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-500 ${step === i ? 'w-10 bg-indigo-500' : 'w-1.5 bg-zinc-800'}`}
            ></div>
          ))}
        </div>
      )}
    </div>
  );
};
