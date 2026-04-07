
import React, { useState, useEffect } from 'react';
import { ApiService } from '../services/api';
import { Gym, GymEquipmentRequest } from '../types';
import {
  ShieldCheck, Users, MapPin, Video, Check, X,
  Trash2, Plus, Building2, TrendingUp, Search,
  ExternalLink, Database, Crown, AlertTriangle, Settings,
  LayoutDashboard, ListChecks, Network, UserCheck, Star, Zap, BrainCircuit, Copy, FileText, Dumbbell, Camera, CreditCard, Tag, Bot, Gift, Coins, Landmark, LogOut, Save, RefreshCcw, MessageSquare, Package, Map, ShoppingBag, FileBadge, Trophy, CheckCircle2, Percent
} from 'lucide-react';

interface Props {
  setActiveTab: (tab: string) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  logout: () => void;
}



// System Prompts Registry
const SYSTEM_PROMPTS = [
  {
    id: 'workout-gen',
    title: 'Daily Protocol Generator',
    category: 'WORKOUT',
    description: 'Generates the core 6-exercise workout plan based on split and user stats.',
    model: 'gemini-2.5-flash',
    template: `You are an expert strength & hypertrophy coach.
Generate TODAY’S personalized gym workout for a \${profile.age}y/o \${profile.gender}.

INPUTS:
1. Selected Workout Split: \${split.name}
2. Selected Workout Type (Style): \${split.style}
3. Targets: \${targetedMuscles.join(', ')}
4. Goal: \${profile.goal}
5. Experience: \${profile.experience}
6. Available Equipment: \${profile.equipment.join(', ')}
7. History: \${historyContext}
8. Health Protocol: \${injuryContext}

RULES:
1. Prioritize compound movements.
2. Training Style Specifics:
   - Hypertrophy: 3-5 sets, 6-12 reps, 60-90s rest. 
   - Strength: 3-6 sets, 1-5 reps, 2-4m rest.
   - Power (Intermediate+ only): 3-5 sets, 1-3 reps, 2-3m rest.
   - Endurance: 2-4 sets, 12-20+ reps, 30-45s rest.
3. Progression: If previous sets were successful, increase weight by 2-5% or add 1-2 reps.
4. Structure: exactly 6 exercises.
5. INJURY PREVENTION: Cross-reference the "Health Protocol".

RETURN A JSON ARRAY of exactly 6 exercise objects.`
  },
  {
    id: 'diet-gen',
    title: 'Nutrition Plan Generator',
    category: 'NUTRITION',
    description: 'Creates a 4-meal daily plan customized to macros and preferences.',
    model: 'gemini-2.5-flash',
    template: `Generate 4-meal nutrition plan for \${profile.goal}, weight \${profile.weight}kg.
Strict Diet Preference: \${profile.dietPreference}
Return JSON array of meal objects.
Each object must have: type, name, description, calories, protein, carbs, fats.
CRITICAL RULE: All meals MUST strictly comply with a \${profile.dietPreference} diet. No exceptions.`
  },
  {
    id: 'vision-equip',
    title: 'Equipment Vision Scanner',
    category: 'VISION',
    description: 'Identifies gym machines from user uploaded photos.',
    model: 'gemini-2.5-flash',
    template: `[IMAGE DATA]
Identify fitness equipment in JSON array.`
  },
  {
    id: 'workout-custom',
    title: 'Workout Recalibration',
    category: 'WORKOUT',
    description: 'Modifies an existing plan based on user chat input.',
    model: 'gemini-2.5-flash',
    template: `Modify this plan: \${JSON.stringify(currentPlan)} based on: "\${userRequest}".
Return JSON object: { "confirmation": string, "exercises": array }`
  },
  {
    id: 'diet-custom',
    title: 'Diet Recalibration',
    category: 'NUTRITION',
    description: 'Adjusts meal plans based on allergies or cravings.',
    model: 'gemini-2.5-flash',
    template: `Update diet: \${JSON.stringify(currentDiet)} based on: "\${userRequest}". 
Return JSON { confirmation, meals }.`
  },
  {
    id: 'body-fat',
    title: 'Body Fat Estimator',
    category: 'SYSTEM',
    description: 'Estimates body fat % from user metrics and logs.',
    model: 'gemini-2.5-flash',
    template: `Act as a clinical exercise physiologist. Estimate body fat % for:
Profile: \${profile.gender}, \${profile.age}y/o, \${profile.height}cm, \${weight}kg.
Measurements: \${JSON.stringify(measurements)}.
Return ONLY JSON: { "bodyFat": number, "confidence": string, "insight": string }`
  },
  {
    id: 'math-progression',
    title: 'Algorithmic Load Calc',
    category: 'WORKOUT',
    description: 'Mathematically calculates sets & reps using 1RM formulas (Epley) and Volume Load.',
    model: 'Linear Regression Engine',
    template: `// LOGIC KERNEL:
1RM_Est = Weight * (1 + Reps/30)
Next_Weight = 1RM_Est * Target_Intensity_Index

IF (Previous_RPE < 7 AND Reps >= Target) {
   Recommendation = "Increase Load +2.5kg"
   Next_Sets = 3
   Next_Reps = "8-10"
} ELSE IF (Previous_RPE > 9) {
   Recommendation = "Deload / Maintain"
   Next_Sets = 3
   Next_Reps = "Same"
}`
  },
  {
    id: 'meal-analyze',
    title: 'Meal Macro Analyzer',
    category: 'NUTRITION',
    description: 'Extracts macros from natural language food descriptions.',
    model: 'gemini-2.5-flash',
    template: `Analyze meal: \${meal}. Return JSON macros.`
  },
  {
    id: 'split-optimize',
    title: 'Split Architecture Optimizer',
    category: 'WORKOUT',
    description: 'Reorganizes custom workout splits for optimal recovery.',
    model: 'gemini-2.5-flash',
    template: `Optimize split: \${JSON.stringify(split)}. Return JSON { optimizedSplit }.`
  }
];

export const AdminPanel: React.FC<Props> = ({ setActiveTab, showToast, logout }) => {
  const [tab, setTab] = useState<'OVERVIEW' | 'USERS' | 'TASKS' | 'PROMPTS' | 'NETWORK' | 'COMMERCE' | 'FEEDBACK'>('OVERVIEW');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Data States
  const [pendingEquipment, setPendingEquipment] = useState<GymEquipmentRequest[]>([]);
  const [pendingRedemptions, setPendingRedemptions] = useState<any[]>([]);
  const [pendingRefunds, setPendingRefunds] = useState<any[]>([]);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [stats, setStats] = useState({ users: 0, activeSubs: 0, revenue: 0 });
  const [systemPrompts, setSystemPrompts] = useState<any[]>([]);
  const [aiLimits, setAiLimits] = useState<Record<string, number>>({});
  const [suggestions, setSuggestions] = useState<any[]>([]);

  // Pricing & Coupon Data
  const [pricingConfig, setPricingConfig] = useState<any>({
    BASE_PRICE: 0, DOWN_PAYMENT: 0, FINANCE_FEE: 0,
    PLAN_STARTER: 0, PLAN_MOMENTUM: 0, PLAN_TRANSFORMATION: 0, PLAN_CHAMPION: 0, REFERRAL_DISCOUNT: 0
  });
  const [coupons, setCoupons] = useState<any[]>([]);
  const [newCouponCode, setNewCouponCode] = useState('');
  const [newCouponAmount, setNewCouponAmount] = useState('');
  const [newCommissionAmount, setNewCommissionAmount] = useState('');
  const [newHamper, setNewHamper] = useState('');
  const [selectedCouponStats, setSelectedCouponStats] = useState<any>(null);

  // Pass Features State
  const [passFeatures, setPassFeatures] = useState<any[]>([]);
  const [newPassFeatureText, setNewPassFeatureText] = useState('');
  const [newPassFeatureIcon, setNewPassFeatureIcon] = useState('Map');

  // Users Tab State
  const [userSubTab, setUserSubTab] = useState<'MEMBERS' | 'CREATORS' | 'AFFILIATES' | 'VERIFICATIONS'>('MEMBERS');
  const [userSearch, setUserSearch] = useState('');
  const [selectedCreator, setSelectedCreator] = useState<any>(null);
  const [selectedAffiliate, setSelectedAffiliate] = useState<any>(null);
  const [selectedAffiliateConversions, setSelectedAffiliateConversions] = useState<any[]>([]);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [memberFilter, setMemberFilter] = useState<'ALL' | 'ACTIVE' | 'EXPIRED'>('ALL');
  const [allUsers, setAllUsers] = useState<any[]>([]);

  // Prompts Tab State
  const [promptCategory, setPromptCategory] = useState<string>('ALL');
  const [editingPrompt, setEditingPrompt] = useState<any>(null);

  // Gym Form State
  const [gymName, setGymName] = useState('');
  const [gymLocation, setGymLocation] = useState('');
  const [gymEquipmentInput, setGymEquipmentInput] = useState('');
  const [gymEquipmentList, setGymEquipmentList] = useState<string[]>([]);
  const [showGymForm, setShowGymForm] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setTimeout(() => setIsRefreshing(false), 500); // UI feel
  };

  const loadData = async () => {
    const gymList = await ApiService.getGyms();
    const equipReqs = await ApiService.getPendingEquipmentRequests();
    const pConfig = await ApiService.getPricingConfig();
    const couponList = await ApiService.getCoupons();
    const redemptions = await ApiService.getAllPendingRedemptions();
    const limits = await ApiService.getAILimits();
    const loadedSuggestions = await ApiService.getSuggestions();
    const loadedPassFeatures = await ApiService.getPassFeatures();
    const loadedRefunds = await ApiService.getAllPendingReferralRefunds();
    const liveProfiles = await ApiService.getAllProfiles();

    const seededPrompts = await ApiService.seedDefaultPrompts(SYSTEM_PROMPTS as any);

    // Format live profiles to match mock signature
    const formattedLiveProfiles = liveProfiles.map(p => {
      const isPassActiveNow = p.isPassActive && p.passExpiryDate && p.passExpiryDate >= Date.now();
      const isPlanActiveNow = p.planExpiryDate && p.planExpiryDate >= Date.now();

      return {
        id: p.id || Math.random(),
        name: p.name || 'Unknown Agent',
        email: p.email || 'N/A',
        mobile: p.phone || '+91 -',
        plan: isPassActiveNow ? 'Pass Client' : (p.plan || 'Free Tier'),
        expiry: isPassActiveNow ? new Date(p.passExpiryDate as number).toISOString() : (p.planExpiryDate ? new Date(p.planExpiryDate).toISOString() : new Date().toISOString()),
        uploads: p.videoUploads || 0,
        referrals: p.referrals || 0,
        status: (isPassActiveNow || isPlanActiveNow) ? 'active' : 'inactive',
        documentationStatus: p.documentationStatus || 'verified',
        trophyStatus: p.trophyStatus,
        trophyRejectionReason: p.trophyRejectionReason,
        trophyDelivery: p.trophyDelivery,
        lastPurchasePrice: p.lastPurchasePrice,
        lastCouponUsed: p.lastCouponUsed,
        lastAffiliateId: p.lastAffiliateId,
        isReal: true // Flag to distinguish
      };
    }).sort((a, b) => b.id - a.id);

    setAllUsers([...formattedLiveProfiles]);
    setGyms(gymList);
    setPendingEquipment(equipReqs);
    setPricingConfig(pConfig);
    setCoupons(couponList);
    setPendingRedemptions(redemptions);
    setSystemPrompts(seededPrompts);
    setPendingRefunds(loadedRefunds);
    setAiLimits(limits);
    setSuggestions(loadedSuggestions);
    setPassFeatures(loadedPassFeatures);

    setStats({
      users: formattedLiveProfiles.length,
      activeSubs: formattedLiveProfiles.filter(p => p.status === 'active').length,
      revenue: formattedLiveProfiles.reduce((acc, p) => acc + (p.lastPurchasePrice || 0), 0)
    });
  };

  const handleReviewEquipment = async (id: number, status: 'approved' | 'rejected') => {
    if (status === 'approved') {
      await ApiService.approveEquipmentRequest(id);
      showToast("Gym Equipment Updated", "success");
    } else {
      await ApiService.rejectEquipmentRequest(id);
      showToast("Request Rejected", "info");
    }
    setPendingEquipment(prev => prev.filter(r => r.id !== id));
    const gymList = await ApiService.getGyms();
    setGyms(gymList);
  };

  const handleAddGym = async () => {
    if (!gymName || !gymLocation) return;
    await ApiService.addGym({
      name: gymName,
      location: gymLocation,
      equipment: gymEquipmentList.length > 0 ? gymEquipmentList : ['Standard Setup'],
      rating: 5.0
    });
    setGymName('');
    setGymLocation('');
    setGymEquipmentList([]);
    setGymEquipmentInput('');
    setShowGymForm(false);
    loadData();
    showToast("Network Location Added", "success");
  };

  const handleAddEquipmentToForm = () => {
    if (gymEquipmentInput.trim()) {
      setGymEquipmentList([...gymEquipmentList, gymEquipmentInput.trim()]);
      setGymEquipmentInput('');
    }
  };

  const handleDeleteGym = async (id: number) => {
    await ApiService.deleteGym(id);
    loadData();
    showToast("Location Removed", "info");
  };

  // Commerce Handlers
  const handleUpdatePricing = async () => {
    await ApiService.savePricingConfig(pricingConfig);
    showToast("Global Pricing Updated", "success");
  };

  const handleAddCoupon = async () => {
    if (!newCouponCode) return;

    const amount = parseFloat(newCouponAmount) || 0;
    const commission = parseFloat(newCommissionAmount) || 0;

    if (amount > pricingConfig.BASE_PRICE) {
      showToast("Discount amount cannot exceed Base Price", "error");
      return;
    }

    try {
      await ApiService.addCoupon(newCouponCode, amount, newHamper, commission);
      setNewCouponCode('');
      setNewCouponAmount('');
      setNewCommissionAmount('');
      setNewHamper('');
      loadData();
      showToast("Promotion & Commission Registered", "success");
    } catch (e: any) {
      showToast(e.message || "Failed to create promotion.", "error");
    }
  };

  const handleDeleteCoupon = async (id: number) => {
    await ApiService.deleteCoupon(id);
    loadData();
    showToast("Promotional Code Deactivated", "info");
  };

  const handleAddPassFeature = async () => {
    if (!newPassFeatureText || !newPassFeatureIcon) return;
    try {
      await ApiService.addPassFeature(newPassFeatureText, newPassFeatureIcon);
      showToast("Pass Feature Added", "success");
      setNewPassFeatureText('');
      setNewPassFeatureIcon('Map');
      loadData();
    } catch (e) {
      showToast("Failed to add feature", "error");
    }
  };

  const handleDeletePassFeature = async (id: number) => {
    if (window.confirm("Remove this Pass feature?")) {
      await ApiService.removePassFeature(id);
      showToast("Feature Removed", "success");
      loadData();
    }
  };

  const handleReviewRedemption = async (id: number, status: 'completed' | 'rejected') => {
    await ApiService.updateRedemptionStatus(id, status);
    setPendingRedemptions(prev => prev.filter(r => r.id !== id));
    showToast(`Redemption ${status}`, status === 'completed' ? 'success' : 'info');
  };

  const handleRestoreCoupon = async (id: number) => {
    await ApiService.restoreCoupon(id);
    loadData();
    showToast("Promotional Code Reactivated", "success");
  };

  const handleSavePrompt = async () => {
    if (!editingPrompt) return;
    await ApiService.saveSystemPrompt(editingPrompt);
    setEditingPrompt(null);
    loadData();
    showToast("System Prompt Updated", "success");
  };

  const handleSaveAILimit = async (key: string, value: number) => {
    await ApiService.updateAILimit(key, value);
    showToast("AI Quota Updated", "success");
    loadData();
  };

  const handleReviewSuggestion = async (id: number, status: 'reviewed' | 'implemented' | 'rejected') => {
    await ApiService.updateSuggestionStatus(id, status);
    loadData();
    showToast(`Suggestion marked as ${status}`, "success");
  };

  const handleVerifyDocumentation = async (userId: number) => {
    await ApiService.verifyUserDocumentation(userId);
    setSelectedMember((prev: any) => ({ ...prev, documentationStatus: 'verified' }));

    // Update local list state
    setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, documentationStatus: 'verified' } : u));
    showToast("Documentation Verified", "success");
  };

  const activeCoupons = coupons.filter(c => c.active);
  const inactiveCoupons = coupons.filter(c => !c.active);

  const filteredPrompts = promptCategory === 'ALL' ? systemPrompts : systemPrompts.filter((p: any) => p.category === promptCategory);

  const filteredUsers = allUsers.filter(u =>
    u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.id.toString().includes(userSearch)
  );

  const getSortedUsers = () => {
    const creators = filteredUsers.filter(u => (u.uploads || 0) > 0);
    const affiliates = filteredUsers.filter(u => (u.referrals || 0) > 0);
    const regularMembers = filteredUsers.filter(u => (u.uploads || 0) === 0 && (u.referrals || 0) === 0);

    if (userSubTab === 'CREATORS') return creators.sort((a, b) => b.uploads - a.uploads);
    if (userSubTab === 'AFFILIATES') return affiliates.sort((a, b) => b.referrals - a.referrals);

    // MEMBERS (Clean list of regular clients)
    if (userSubTab === 'MEMBERS') {
      let members = regularMembers;
      if (memberFilter === 'ACTIVE') members = members.filter(m => m.status === 'active');
      if (memberFilter === 'EXPIRED') members = members.filter(m => m.status === 'inactive');
      return members;
    }

    // VERIFICATIONS (Pending status from any category)
    if (userSubTab === 'VERIFICATIONS') {
      return filteredUsers.filter(m => m.documentationStatus === 'pending');
    }

    return filteredUsers;
  };

  return (
    <div className="flex flex-col h-screen bg-black text-white max-w-md mx-auto relative w-full overflow-hidden border-x border-zinc-900">

      <header className="flex-none bg-zinc-950/95 backdrop-blur-xl border-b border-amber-500/20 px-5 py-4 flex justify-between items-center shadow-2xl z-40">
        <div className="flex items-center gap-3">
          <div className="bg-amber-500 p-2 rounded-xl text-black shadow-[0_0_20px_rgba(245,158,11,0.4)]">
            <ShieldCheck size={20} strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">God Mode</h2>
            <p className="text-[8px] font-bold text-amber-500 uppercase tracking-widest">System Administration</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={`p-2.5 bg-zinc-900 border border-zinc-800 rounded-full text-zinc-400 hover:text-white transition-all active:scale-90 ${isRefreshing ? 'opacity-50' : ''}`}
          >
            <RefreshCcw size={18} className={isRefreshing ? 'animate-spin text-amber-500' : ''} />
          </button>
          <button
            onClick={logout}
            className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-full text-rose-500 hover:bg-rose-500 hover:text-white transition-all active:scale-90"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto pb-24 scrollbar-hide">

        {/* OVERVIEW TAB */}
        {tab === 'OVERVIEW' && (
          <div className="px-4 py-6 space-y-6 animate-in slide-in-from-left-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-zinc-900/50 p-5 rounded-[2rem] border border-zinc-800 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 opacity-5 rotate-12"><Users size={60} /></div>
                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">Total Agents</p>
                <h3 className="text-3xl font-black italic text-white tracking-tighter">{stats.users.toLocaleString()}</h3>
              </div>
              <div className="bg-zinc-900/50 p-5 rounded-[2rem] border border-zinc-800 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 opacity-5 rotate-12"><Crown size={60} /></div>
                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">Pro Members</p>
                <h3 className="text-3xl font-black italic text-amber-500 tracking-tighter">{stats.activeSubs}</h3>
              </div>
              <div className="col-span-2 bg-gradient-to-r from-zinc-900 to-black p-6 rounded-[2rem] border border-zinc-800 relative overflow-hidden shadow-xl">
                <div className="absolute top-0 right-0 p-3 opacity-5"><TrendingUp size={100} /></div>
                <div className="relative z-10">
                  <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <Database size={12} className="text-emerald-500" /> Est. Monthly Revenue
                  </p>
                  <h3 className="text-4xl font-black italic text-white tracking-tighter">₹{(stats.revenue).toLocaleString()}</h3>
                  <div className="mt-4 flex items-center gap-2">
                    <span className="bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border border-emerald-500/20">+12.5% vs Last Mo</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-amber-500/5 border border-amber-500/20 p-5 rounded-[2rem] flex items-center gap-4">
              <div className="bg-amber-500/20 p-3 rounded-2xl text-amber-500"><AlertTriangle size={24} /></div>
              <div>
                <h4 className="font-black text-sm text-amber-100 uppercase tracking-tight">System Status</h4>
                <p className="text-[9px] font-bold text-amber-500/60 uppercase tracking-widest mt-1">All Nodes Operational • Version 3.2.1</p>
              </div>
            </div>
          </div>
        )}

        {/* USERS TAB */}
        {tab === 'USERS' && (
          <div className="px-4 py-4 space-y-4 animate-in slide-in-from-right-4">
            {/* Search */}
            <div className="relative">
              <input
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search ID, Name or Email..."
                className="w-full bg-zinc-900 border border-zinc-800 p-3 pl-10 rounded-2xl text-xs font-bold text-white focus:border-amber-500 outline-none placeholder:text-zinc-600"
              />
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600" />
            </div>

            {/* Sub Tabs */}
            <div className="flex bg-zinc-900 p-1 rounded-xl border border-zinc-800 overflow-x-auto scrollbar-hide">
              {['MEMBERS', 'VERIFICATIONS', 'CREATORS', 'AFFILIATES'].map(st => (
                <button
                  key={st}
                  onClick={() => setUserSubTab(st as any)}
                  className={`flex-1 min-w-max px-3 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${userSubTab === st ? 'bg-amber-500 text-black shadow-lg text-xs' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  {st}
                  {st === 'VERIFICATIONS' && (
                    <span className="ml-2 bg-rose-500 text-white px-1.5 py-0.5 rounded-full text-[8px]">
                      {allUsers.filter(u => u.documentationStatus === 'pending').length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Member Filters */}
            {userSubTab === 'MEMBERS' && (
              <div className="flex gap-2 mb-2">
                {['ALL', 'ACTIVE', 'EXPIRED'].map(f => (
                  <button
                    key={f}
                    onClick={() => setMemberFilter(f as any)}
                    className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest border transition-all ${memberFilter === f
                      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                      : 'bg-transparent text-zinc-500 border-zinc-800 hover:border-zinc-700'
                      }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}

            {/* List */}
            <div className="space-y-2">
              {getSortedUsers().map(u => (
                <div
                  key={u.id}
                  onClick={() => {
                    if (userSubTab === 'CREATORS') setSelectedCreator(u);
                    if (userSubTab === 'AFFILIATES') setSelectedAffiliate(u);
                    if (userSubTab === 'MEMBERS' || userSubTab === 'VERIFICATIONS') setSelectedMember(u);
                  }}
                  className={`bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800 flex justify-between items-center group cursor-pointer ${userSubTab === 'CREATORS' ? 'hover:border-indigo-500/50' :
                    userSubTab === 'AFFILIATES' ? 'hover:border-amber-500/50' :
                      userSubTab === 'VERIFICATIONS' ? 'hover:border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.1)]' : 'hover:border-emerald-500/50'
                    }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-black uppercase text-white">{u.name}</h4>
                      <span className="text-[8px] font-bold text-zinc-600 bg-zinc-950 px-1.5 py-0.5 rounded">ID: {u.id}</span>
                      {userSubTab === 'VERIFICATIONS' && u.documentationStatus === 'pending' && (
                        <AlertTriangle size={12} className="text-amber-500 animate-pulse" />
                      )}
                    </div>

                    {/* Dynamic Details based on SubTab */}
                    {(userSubTab === 'MEMBERS' || userSubTab === 'VERIFICATIONS') && (
                      <div className="mt-1 flex items-center gap-2 text-[9px] font-bold uppercase">
                        <span className={`${u.status === 'active' ? 'text-emerald-500' : 'text-rose-500'}`}>{u.plan}</span>
                        <span className="text-zinc-600">• Exp: {new Date(u.expiry).toLocaleDateString()}</span>
                      </div>
                    )}

                    {userSubTab === 'CREATORS' && (
                      <div className="mt-1 flex items-center gap-2 text-[9px] font-bold uppercase text-indigo-400">
                        <Video size={10} /> {u.uploads} Uploads
                      </div>
                    )}

                    {userSubTab === 'AFFILIATES' && (
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-[9px] font-bold uppercase text-amber-500">
                          <Zap size={10} /> {u.referrals} Referrals
                        </div>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            setSelectedAffiliate(u);
                            const convs = await ApiService.getAffiliateConversions(u.id!);
                            setSelectedAffiliateConversions(convs);
                          }}
                          className="px-2 py-1 bg-amber-500/10 text-amber-500 rounded text-[7px] font-black uppercase border border-amber-500/10 hover:bg-amber-500 hover:text-white transition-all"
                        >
                          View Conversions
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Right Side Indicator */}
                  <div>
                    {userSubTab === 'VERIFICATIONS' && (
                      <div className="flex items-center justify-center p-2 bg-amber-500/10 text-amber-500 rounded-full border border-amber-500/20">
                        <FileBadge size={14} />
                      </div>
                    )}
                    {userSubTab === 'MEMBERS' && (
                      <div className={`w-2 h-2 rounded-full ${u.status === 'active' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-rose-500'}`}></div>
                    )}
                    {userSubTab === 'CREATORS' && u.uploads > 50 && (
                      <Star size={16} className="text-indigo-500 fill-indigo-500/20" />
                    )}
                    {userSubTab === 'AFFILIATES' && u.referrals > 10 && (
                      <Crown size={16} className="text-amber-500 fill-amber-500/20" />
                    )}
                  </div>
                </div>
              ))}

              {userSubTab === 'VERIFICATIONS' && getSortedUsers().length === 0 && (
                <div className="text-center py-12 flex flex-col items-center justify-center">
                  <FileBadge size={40} className="text-zinc-800 mb-3" />
                  <p className="text-xs font-black text-zinc-500 uppercase tracking-widest">Inbox Zero</p>
                  <p className="text-[9px] font-bold text-zinc-600 uppercase mt-1">No Pass Documents Pending Verification</p>
                </div>
              )}
            </div>

            {/* Creator Links Modal */}
            {selectedCreator && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in pb-24">
                <div className="bg-zinc-950 border border-zinc-800 w-full max-w-sm rounded-[2rem] p-6 shadow-2xl animate-in zoom-in-95 overflow-hidden flex flex-col max-h-[80vh]">

                  <div className="flex justify-between items-start mb-6 shrink-0">
                    <div>
                      <h3 className="text-lg font-black uppercase text-white tracking-tighter">{selectedCreator.name}</h3>
                      <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest mt-0.5">Content Creator</p>
                    </div>
                    <button onClick={() => setSelectedCreator(null)} className="p-2 bg-zinc-900 rounded-full text-zinc-500 hover:text-white"><X size={14} /></button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-6 shrink-0">
                    <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-xl flex flex-col items-center justify-center">
                      <span className="text-xl font-black italic text-white">{selectedCreator.uploads}</span>
                      <span className="text-[7px] font-black uppercase text-zinc-500 tracking-widest mt-1">Total Links</span>
                    </div>
                    <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-xl flex flex-col items-center justify-center">
                      <span className="text-xl font-black italic text-emerald-500">{selectedCreator.referrals || 0}</span>
                      <span className="text-[7px] font-black uppercase text-zinc-500 tracking-widest mt-1 text-center">Tracked Sales<br />(Ref / Hub)</span>
                    </div>
                  </div>

                  {selectedCreator.trophyStatus === 'applied' && (
                    <div className="mb-6 p-4 bg-zinc-900/80 border border-amber-500/30 rounded-2xl shrink-0 space-y-3 shadow-[0_0_15px_rgba(245,158,11,0.1)]">
                      <div className="flex items-center gap-2 text-amber-500">
                        <Trophy size={16} />
                        <h4 className="text-[10px] font-black uppercase tracking-widest">Trophy Application</h4>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            try {
                              await ApiService.approveReelsTrophy(selectedCreator.id!);
                              setSelectedCreator({ ...selectedCreator, trophyStatus: 'awarded' } as any);
                              loadData();
                            } catch (e) { console.error(e) }
                          }}
                          className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => {
                            const reason = prompt("Enter rejection reason:");
                            if (reason) {
                              ApiService.rejectReelsTrophy(selectedCreator.id!, reason).then(() => {
                                setSelectedCreator({ ...selectedCreator, trophyStatus: 'rejected', trophyRejectionReason: reason } as any);
                                loadData();
                              });
                            }
                          }}
                          className="flex-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex-1 overflow-y-auto pr-2 space-y-3 scrollbar-hide">
                    {Array.from({ length: Math.min(10, selectedCreator.uploads) }).map((_, idx) => (
                      <div key={idx} className="bg-zinc-900/50 p-3 rounded-xl border border-zinc-800/50 flex justify-between items-center group">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="p-2 bg-indigo-500/10 rounded-lg shrink-0"><Video size={12} className="text-indigo-400" /></div>
                          <div className="truncate">
                            <p className="text-[10px] font-black text-white uppercase truncate">instagram.com/p/{Math.random().toString(36).substring(7)}</p>
                            <p className="text-[7px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5">Mapped to: {selectedCreator.name.split(' ')[0]}10</p>
                          </div>
                        </div>
                        <a href="#" className="p-2 text-indigo-400 hover:text-white transition-colors shrink-0"><ExternalLink size={12} /></a>
                      </div>
                    ))}
                    {selectedCreator.uploads === 0 && (
                      <p className="text-center text-[10px] font-bold text-zinc-600 uppercase py-6">No links submitted</p>
                    )}
                  </div>

                </div>
              </div>
            )}

            {/* Affiliate Referrals Modal */}
            {selectedAffiliate && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in pb-24">
                <div className="bg-zinc-950 border border-zinc-800 w-full max-w-sm rounded-[2rem] p-6 shadow-2xl animate-in zoom-in-95 overflow-hidden flex flex-col max-h-[80vh]">

                  <div className="flex justify-between items-start mb-6 shrink-0">
                    <div>
                      <h3 className="text-lg font-black uppercase text-white tracking-tighter">{selectedAffiliate.name}</h3>
                      <p className="text-[9px] font-bold text-amber-500 uppercase tracking-widest mt-0.5">Top Affiliate / Partner</p>
                    </div>
                    <button onClick={() => setSelectedAffiliate(null)} className="p-2 bg-zinc-900 rounded-full text-zinc-500 hover:text-white"><X size={14} /></button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-6 shrink-0">
                    <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-xl flex flex-col items-center justify-center text-center">
                      <span className="text-xl font-black italic text-white">{selectedAffiliate.referrals}</span>
                      <span className="text-[7px] font-black uppercase text-zinc-500 tracking-widest mt-1">Total Conversions</span>
                    </div>
                    <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-xl flex flex-col items-center justify-center text-center">
                      <span className="text-xl font-black italic text-amber-500">
                        ₹{selectedAffiliateConversions.reduce((acc, c) => acc + (c.commission || 0), 0).toLocaleString()}
                      </span>
                      <span className="text-[7px] font-black uppercase text-zinc-500 tracking-widest mt-1">Real Commission</span>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto pr-2 space-y-3 scrollbar-hide">
                    {selectedAffiliateConversions.map((conv, idx) => {
                      const isCreator = conv.type === 'CREATOR';
                      return (
                        <div key={conv.id || idx} className="bg-zinc-900/50 p-3 rounded-xl border border-zinc-800/50 flex flex-col gap-2 relative">
                          <div className="flex justify-between items-start">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <UserCheck size={12} className="text-zinc-400" />
                                <span className="text-[10px] font-black uppercase text-white">{conv.buyerName}</span>
                              </div>
                              {allUsers.find(u => u.name === conv.buyerName) && (
                                <div className="flex flex-col mt-0.5">
                                  <span className="text-[8px] font-bold text-zinc-400">{allUsers.find(u => u.name === conv.buyerName)?.email}</span>
                                  <span className="text-[8px] font-bold text-zinc-400">{allUsers.find(u => u.name === conv.buyerName)?.mobile}</span>
                                  <span className="text-[7px] font-black uppercase text-indigo-400 mt-0.5">{allUsers.find(u => u.name === conv.buyerName)?.plan}</span>
                                </div>
                              )}
                            </div>
                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border uppercase mt-0.5 ${isCreator
                              ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/10'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/10'
                              }`}>
                              {isCreator ? `+₹${conv.commission} Comm` : 'Referral Credit'}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-1 mt-1">
                            <div>
                              <p className="text-[6px] font-black text-zinc-600 uppercase tracking-widest">Code Used</p>
                              <p className="text-[9px] font-bold text-zinc-300 uppercase">{conv.codeUsed}</p>
                            </div>
                            <div>
                              <p className="text-[6px] font-black text-zinc-600 uppercase tracking-widest">Amount Paid</p>
                              <p className="text-[9px] font-bold text-emerald-500 uppercase font-black">₹{conv.amountPaid?.toLocaleString() || '0'}</p>
                            </div>
                          </div>

                          <div className="flex justify-between items-center mt-1 border-t border-zinc-800/50 pt-2">
                            <p className="text-[7px] font-black text-zinc-500 uppercase">{new Date(conv.timestamp).toLocaleString()}</p>
                            <div className="flex items-center gap-1 opacity-50">
                              <Tag size={8} className="text-zinc-500" />
                              <span className="text-[7px] font-black text-zinc-500 uppercase">Tracked</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    {selectedAffiliateConversions.length === 0 && (
                      <p className="text-center text-[10px] font-bold text-zinc-600 uppercase py-6">No real conversions tracked yet</p>
                    )}
                  </div>

                </div>
              </div>
            )}

            {/* Member Profile Modal */}
            {selectedMember && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in pb-24">
                <div className="bg-zinc-950 border border-zinc-800 w-full max-w-sm rounded-[2rem] p-6 shadow-2xl animate-in zoom-in-95 flex flex-col items-center relative">
                  <button onClick={() => setSelectedMember(null)} className="absolute top-4 right-4 p-2 bg-zinc-900 rounded-full text-zinc-500 hover:text-white"><X size={14} /></button>

                  <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-emerald-500/50 mb-4 bg-zinc-900 mt-2">
                    <img src={`https://i.pravatar.cc/150?u=${selectedMember.id}`} className="w-full h-full object-cover" alt="Profile" />
                  </div>

                  <h3 className="text-xl font-black uppercase text-white tracking-tighter">{selectedMember.name}</h3>
                  <p className={`text-[9px] font-bold uppercase tracking-widest mt-1 px-2 py-0.5 rounded-full ${selectedMember.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                    {selectedMember.plan}
                  </p>

                  <div className="w-full space-y-3 mt-6">
                    {/* Purchase & Affiliate Tracking */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-zinc-900/80 p-3 rounded-2xl border border-zinc-800/50 flex flex-col items-center justify-center text-center">
                        <span className="text-[7px] font-black text-zinc-500 uppercase tracking-widest block mb-1">Purchase Value</span>
                        <span className="text-xs font-black text-white italic">{selectedMember.lastPurchasePrice ? `₹${selectedMember.lastPurchasePrice}` : 'N/A'}</span>
                      </div>
                      <div className="bg-zinc-900/80 p-3 rounded-2xl border border-zinc-800/50 flex flex-col items-center justify-center text-center">
                        <span className="text-[7px] font-black text-zinc-500 uppercase tracking-widest block mb-1">Applied Promo</span>
                        <span className="text-[9px] font-black text-indigo-400 uppercase">{selectedMember.lastCouponUsed || 'None'}</span>
                      </div>
                    </div>
                    {selectedMember.lastAffiliateId && (
                      <div className="bg-amber-500/5 border border-amber-500/10 p-2.5 rounded-xl flex items-center gap-3">
                        <div className="p-1.5 bg-amber-500/20 text-amber-500 rounded-lg"><UserCheck size={12} /></div>
                        <div>
                          <p className="text-[7px] font-black text-zinc-500 uppercase tracking-widest">Referred By Affiliate ID</p>
                          <p className="text-[10px] font-bold text-amber-400">#{selectedMember.lastAffiliateId}</p>
                        </div>
                      </div>
                    )}
                    {/* Documentation Verification Notice */}
                    <div className={`p-4 rounded-2xl border ${selectedMember.documentationStatus === 'pending' ? 'bg-amber-500/10 border-amber-500/30' : 'bg-emerald-500/5 border-emerald-500/20'} flex flex-col items-center justify-center text-center space-y-3`}>
                      <div className={`p-2 rounded-full ${selectedMember.documentationStatus === 'pending' ? 'bg-amber-500/20 text-amber-500' : 'bg-emerald-500/20 text-emerald-500'}`}>
                        {selectedMember.documentationStatus === 'pending' ? <AlertTriangle size={20} /> : <FileBadge size={20} />}
                      </div>
                      <div>
                        <h4 className={`text-[10px] font-black uppercase tracking-widest ${selectedMember.documentationStatus === 'pending' ? 'text-amber-500' : 'text-emerald-500'}`}>
                          {selectedMember.documentationStatus === 'pending' ? 'Pending Documentation' : 'Documentation Verified'}
                        </h4>
                        <p className="text-[8px] font-bold text-zinc-500 uppercase mt-1">Requires Govt ID & Signature</p>
                      </div>

                      {selectedMember.documentationStatus === 'pending' && (
                        <button
                          onClick={() => handleVerifyDocumentation(selectedMember.id)}
                          className="w-full bg-amber-500 text-black py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest mt-2 hover:bg-amber-400 active:scale-95 transition-all shadow-[0_0_15px_rgba(245,158,11,0.3)] flex items-center justify-center gap-2"
                        >
                          <Check size={14} /> Mark as Verified
                        </button>
                      )}
                    </div>

                    <div className="bg-zinc-900/50 p-3 rounded-xl border border-zinc-800/50 flex justify-between items-center mt-4">
                      <div className="flex gap-3 items-center">
                        <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500"><Copy size={12} /></div>
                        <div>
                          <p className="text-[7px] font-bold text-zinc-500 uppercase tracking-widest">Mobile Number</p>
                          <p className="text-xs font-black text-white">{selectedMember.mobile || '+91 9876543210'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-zinc-900/50 p-3 rounded-xl border border-zinc-800/50 flex justify-between items-center">
                      <div className="flex gap-3 items-center">
                        <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400"><FileText size={12} /></div>
                        <div>
                          <p className="text-[7px] font-bold text-zinc-500 uppercase tracking-widest">Email Address</p>
                          <p className="text-xs font-black text-white">{selectedMember.email}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-zinc-900/50 p-3 rounded-xl border border-zinc-800/50 flex justify-between items-center">
                      <div className="flex gap-3 items-center">
                        <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500"><UserCheck size={12} /></div>
                        <div>
                          <p className="text-[7px] font-bold text-zinc-500 uppercase tracking-widest">System ID</p>
                          <p className="text-xs font-black text-white">#{selectedMember.id}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            )}

          </div>
        )}

        {/* COMMERCE TAB */}
        {tab === 'COMMERCE' && (
          <div className="px-4 py-6 space-y-8 animate-in slide-in-from-right-4">

            {/* Global Pricing Config */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard size={16} className="text-indigo-500" />
                <h3 className="text-xs font-black uppercase text-zinc-500 tracking-widest">Global Pricing</h3>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-2xl space-y-1">
                  <label className="text-[8px] font-bold text-zinc-500 uppercase">Pass Base Price (₹)</label>
                  <input
                    type="number"
                    value={pricingConfig.BASE_PRICE}
                    onChange={(e) => setPricingConfig({ ...pricingConfig, BASE_PRICE: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-transparent text-xl font-black text-white outline-none"
                  />
                </div>
                <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-2xl space-y-1">
                  <label className="text-[8px] font-bold text-zinc-500 uppercase">Down Payment (₹)</label>
                  <input
                    type="number"
                    value={pricingConfig.DOWN_PAYMENT}
                    onChange={(e) => setPricingConfig({ ...pricingConfig, DOWN_PAYMENT: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-transparent text-xl font-black text-white outline-none"
                  />
                </div>
                <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-2xl space-y-1">
                  <label className="text-[8px] font-bold text-zinc-500 uppercase">Processing Fee (₹)</label>
                  <input
                    type="number"
                    value={pricingConfig.FINANCE_FEE}
                    onChange={(e) => setPricingConfig({ ...pricingConfig, FINANCE_FEE: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-transparent text-xl font-black text-white outline-none"
                  />
                </div>
                <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-2xl space-y-1">
                  <label className="text-[8px] font-bold text-zinc-500 uppercase">Referral Discount (₹)</label>
                  <input
                    type="number"
                    value={pricingConfig.REFERRAL_DISCOUNT}
                    onChange={(e) => setPricingConfig({ ...pricingConfig, REFERRAL_DISCOUNT: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-transparent text-xl font-black text-white outline-none"
                  />
                </div>
              </div>

              {/* AI Subscription Pricing */}
              <div className="space-y-4 pt-4 border-t border-zinc-800">
                <div className="flex items-center gap-2 mb-2">
                  <Bot size={16} className="text-emerald-500" />
                  <h3 className="text-xs font-black uppercase text-zinc-500 tracking-widest">AI Coach Subscriptions</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-2xl space-y-1">
                    <label className="text-[8px] font-bold text-zinc-500 uppercase">Starter (1 Mo)</label>
                    <input
                      type="number"
                      value={pricingConfig.PLAN_STARTER}
                      onChange={(e) => setPricingConfig({ ...pricingConfig, PLAN_STARTER: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-transparent text-lg font-black text-white outline-none"
                    />
                  </div>
                  <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-2xl space-y-1">
                    <label className="text-[8px] font-bold text-zinc-500 uppercase">Momentum (3 Mo)</label>
                    <input
                      type="number"
                      value={pricingConfig.PLAN_MOMENTUM}
                      onChange={(e) => setPricingConfig({ ...pricingConfig, PLAN_MOMENTUM: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-transparent text-lg font-black text-white outline-none"
                    />
                  </div>
                  <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-2xl space-y-1">
                    <label className="text-[8px] font-bold text-zinc-500 uppercase">Transform (6 Mo)</label>
                    <input
                      type="number"
                      value={pricingConfig.PLAN_TRANSFORMATION}
                      onChange={(e) => setPricingConfig({ ...pricingConfig, PLAN_TRANSFORMATION: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-transparent text-lg font-black text-white outline-none"
                    />
                  </div>
                  <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-2xl space-y-1">
                    <label className="text-[8px] font-bold text-zinc-500 uppercase">Champion (12 Mo)</label>
                    <input
                      type="number"
                      value={pricingConfig.PLAN_CHAMPION}
                      onChange={(e) => setPricingConfig({ ...pricingConfig, PLAN_CHAMPION: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-transparent text-lg font-black text-white outline-none"
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={handleUpdatePricing}
                className="w-full bg-indigo-600 text-white rounded-2xl py-4 font-black text-[10px] uppercase tracking-widest flex items-center justify-center shadow-lg active:scale-95"
              >
                Save Global Changes
              </button>
            </div>

            {/* Coupons Management */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Tag size={16} className="text-emerald-500" />
                <h3 className="text-xs font-black uppercase text-zinc-500 tracking-widest">Discount & Reward Registry</h3>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-[2rem] space-y-4 shadow-xl">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[7px] font-black text-zinc-600 uppercase tracking-widest ml-1">Unique Code</label>
                    <input
                      value={newCouponCode}
                      onChange={(e) => setNewCouponCode(e.target.value.toUpperCase())}
                      placeholder="e.g. MEGA50"
                      className="w-full bg-black/50 border border-zinc-800 p-3 rounded-xl text-xs font-black text-white outline-none focus:border-indigo-500 uppercase"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[7px] font-black text-zinc-600 uppercase tracking-widest ml-1">Discount (₹)</label>
                    <input
                      type="number"
                      value={newCouponAmount}
                      onChange={(e) => setNewCouponAmount(e.target.value)}
                      placeholder="0"
                      className="w-full bg-black/50 border border-zinc-800 p-3 rounded-xl text-xs font-black text-white outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[7px] font-black text-zinc-600 uppercase tracking-widest ml-1">Creator Commission (₹)</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={newCommissionAmount}
                      onChange={(e) => setNewCommissionAmount(e.target.value)}
                      placeholder="e.g. 500"
                      className="w-full bg-black/50 border border-zinc-800 p-3 pl-10 rounded-xl text-[11px] font-bold text-amber-400 outline-none focus:border-amber-500 placeholder:text-zinc-700"
                    />
                    <Coins size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-500" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[7px] font-black text-zinc-600 uppercase tracking-widest ml-1">Gift Hamper / Add-on Reward</label>
                  <div className="relative">
                    <input
                      value={newHamper}
                      onChange={(e) => setNewHamper(e.target.value)}
                      placeholder="e.g. Free Shaker Bottle + Gym Bag"
                      className="w-full bg-black/50 border border-zinc-800 p-3 pl-10 rounded-xl text-[11px] font-bold text-emerald-400 outline-none focus:border-emerald-500 placeholder:text-zinc-700"
                    />
                    <Gift size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-500" />
                  </div>
                </div>

                <button
                  onClick={handleAddCoupon}
                  className="w-full bg-white text-black py-3.5 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Plus size={14} strokeWidth={3} /> Register Promotion
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="text-[8px] font-black text-zinc-600 uppercase tracking-widest ml-1 mb-2 block">Active Promotions</label>
                  <div className="space-y-3">
                    {activeCoupons.map((coupon) => (
                      <div key={coupon.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-[2rem] flex justify-between items-center group relative overflow-hidden transition-all hover:border-emerald-500/30">
                        <div className="flex items-center gap-4 relative z-10">
                          <div className="w-10 h-10 bg-black/50 rounded-2xl flex items-center justify-center text-zinc-500 border border-zinc-800">
                            <Tag size={18} />
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-white uppercase tracking-tight">{coupon.code}</h4>
                            <div className="flex flex-wrap gap-2 mt-1">
                              <span className="text-[8px] font-black text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/10">₹{coupon.discountAmount} OFF</span>
                              {coupon.usages && coupon.usages.length > 0 && (
                                <span className="text-[8px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/10 flex items-center gap-1">
                                  <TrendingUp size={8} /> {coupon.usages.length} Uses
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 relative z-10">
                          <button onClick={() => setSelectedCouponStats(coupon)} className="p-3 text-indigo-400 hover:text-white transition-colors bg-black/40 rounded-xl border border-zinc-800" title="Analytics">
                            <TrendingUp size={16} />
                          </button>
                          <button onClick={() => handleDeleteCoupon(coupon.id!)} className="p-3 text-zinc-700 hover:text-rose-500 transition-colors bg-black/40 rounded-xl border border-zinc-800" title="Deactivate">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {activeCoupons.length === 0 && (
                      <div className="py-10 text-center border-2 border-dashed border-zinc-800 rounded-[2.5rem] bg-zinc-900/20">
                        <p className="text-[9px] font-black text-zinc-700 uppercase italic tracking-widest">No Active Promotions</p>
                      </div>
                    )}
                  </div>
                </div>

                {inactiveCoupons.length > 0 && (
                  <div>
                    <label className="text-[8px] font-black text-zinc-600 uppercase tracking-widest ml-1 mb-2 block">Inactive Promotions</label>
                    <div className="space-y-3">
                      {inactiveCoupons.map((coupon) => (
                        <div key={coupon.id} className="bg-black/40 border border-zinc-800/50 p-4 rounded-[2rem] flex justify-between items-center group relative overflow-hidden transition-all">
                          <div className="flex items-center gap-4 relative z-10 opacity-50">
                            <div className="w-10 h-10 bg-black/50 rounded-2xl flex items-center justify-center text-zinc-600 border border-zinc-800">
                              <Tag size={18} />
                            </div>
                            <div>
                              <h4 className="text-sm font-black text-zinc-500 uppercase tracking-tight line-through">{coupon.code}</h4>
                              <div className="flex flex-wrap gap-2 mt-1">
                                <span className="text-[8px] font-black text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded-full border border-zinc-800">₹{coupon.discountAmount} OFF</span>
                                {coupon.usages && coupon.usages.length > 0 && (
                                  <span className="text-[8px] font-black text-emerald-500/50 bg-emerald-900/20 px-2 py-0.5 rounded-full border border-emerald-900/30 flex items-center gap-1">
                                    <TrendingUp size={8} /> {coupon.usages.length} Uses
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2 relative z-10">
                            <button onClick={() => handleRestoreCoupon(coupon.id!)} className="p-3 text-emerald-400 hover:text-white transition-colors bg-zinc-900 rounded-xl border border-zinc-800" title="Reactivate Promotion">
                              <RefreshCcw size={16} />
                            </button>
                            <button onClick={() => setSelectedCouponStats(coupon)} className="p-3 text-indigo-400/70 hover:text-white transition-colors bg-zinc-900 rounded-xl border border-zinc-800" title="Analytics">
                              <TrendingUp size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* --- Pass Included Items Section --- */}
            <div className="pt-6 border-t border-zinc-800">
              <div className="flex items-center gap-2 mb-4">
                <Package size={16} className="text-amber-500" />
                <h3 className="text-xs font-black uppercase text-zinc-500 tracking-widest">Transformix Pass "Included" Items</h3>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-[2rem] space-y-4 shadow-xl mb-6">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 space-y-1">
                    <label className="text-[7px] font-black text-zinc-600 uppercase tracking-widest ml-1">Feature Text</label>
                    <input
                      value={newPassFeatureText}
                      onChange={(e) => setNewPassFeatureText(e.target.value)}
                      placeholder="e.g. Access to 10,000+ gyms"
                      className="w-full bg-black/50 border border-zinc-800 p-3 rounded-xl text-xs font-black text-white outline-none focus:border-amber-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[7px] font-black text-zinc-600 uppercase tracking-widest ml-1">Icon Name (Lucide)</label>
                    <select
                      value={newPassFeatureIcon}
                      onChange={(e) => setNewPassFeatureIcon(e.target.value)}
                      className="w-full bg-black/50 border border-zinc-800 p-3 rounded-xl text-xs font-black text-white outline-none focus:border-amber-500 appearance-none"
                    >
                      <option value="Map">Map</option>
                      <option value="Bot">Bot</option>
                      <option value="Package">Package</option>
                      <option value="ShoppingBag">ShoppingBag</option>
                      <option value="Zap">Zap</option>
                      <option value="Star">Star</option>
                      <option value="ShieldCheck">ShieldCheck</option>
                      <option value="Dumbbell">Dumbbell</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={handleAddPassFeature}
                  disabled={!newPassFeatureText}
                  className="w-full bg-white text-black py-3.5 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Plus size={14} strokeWidth={3} /> Add Feature
                </button>
              </div>

              <div className="space-y-3">
                {passFeatures.map(feat => {
                  // Dynamic Icon Rendering Helper
                  const IconComp =
                    feat.icon === 'Map' ? Map :
                      feat.icon === 'Bot' ? Bot :
                        feat.icon === 'Package' ? Package :
                          feat.icon === 'ShoppingBag' ? ShoppingBag :
                            feat.icon === 'Zap' ? Zap :
                              feat.icon === 'Star' ? Star :
                                feat.icon === 'ShieldCheck' ? ShieldCheck :
                                  feat.icon === 'Dumbbell' ? Dumbbell : MapPin;

                  return (
                    <div key={feat.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex justify-between items-center group">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-black/50 rounded-xl flex items-center justify-center text-indigo-400 border border-zinc-800">
                          <IconComp size={14} />
                        </div>
                        <span className="text-[10px] font-black text-zinc-300 uppercase tracking-tight">{feat.text}</span>
                      </div>
                      <button onClick={() => handleDeletePassFeature(feat.id!)} className="p-2 text-zinc-700 hover:text-rose-500 transition-colors bg-black/40 rounded-xl border border-zinc-800" title="Remove Feature">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>

          </div>
        )}

        {/* Coupon Analytics Modal */}
        {selectedCouponStats && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in pb-24">
            <div className="bg-zinc-950 border border-zinc-800 w-full max-w-sm rounded-[2rem] p-6 shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[80vh]">
              <div className="flex justify-between items-start mb-6 shrink-0">
                <div>
                  <h3 className="text-lg font-black uppercase text-white tracking-tighter">{selectedCouponStats.code} Stats</h3>
                  <p className="text-[9px] font-bold text-amber-500 uppercase tracking-widest mt-0.5">Promotion Usage Analytics</p>
                </div>
                <button onClick={() => setSelectedCouponStats(null)} className="p-2 bg-zinc-900 rounded-full text-zinc-500 hover:text-white"><X size={14} /></button>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-6 shrink-0">
                <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-xl flex flex-col items-center justify-center">
                  <span className="text-xl font-black italic text-emerald-500">{selectedCouponStats.usages?.length || 0}</span>
                  <span className="text-[7px] font-black uppercase text-zinc-500 tracking-widest mt-1">Total Uses</span>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-xl flex flex-col items-center justify-center">
                  <span className="text-xl font-black italic text-white">₹{selectedCouponStats.usages?.reduce((sum: number, u: any) => sum + (u.amount || 0), 0).toLocaleString() || 0}</span>
                  <span className="text-[7px] font-black uppercase text-zinc-500 tracking-widest mt-1 text-center">Direct Rev. Tracked</span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 space-y-3 scrollbar-hide">
                {selectedCouponStats.usages && selectedCouponStats.usages.length > 0 ? (
                  selectedCouponStats.usages.slice().reverse().map((usage: any, idx: number) => (
                    <div key={idx} className="bg-zinc-900/50 p-3 rounded-xl border border-zinc-800/50 flex flex-col gap-2 relative">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <UserCheck size={12} className="text-zinc-400" />
                          <span className="text-[10px] font-black uppercase text-white">{usage.buyerName}</span>
                        </div>
                        <span className="text-[8px] font-bold bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded border border-emerald-500/10 uppercase">
                          ₹{usage.amount?.toLocaleString()} Paid
                        </span>
                      </div>
                      <div className="text-[8px] font-bold text-zinc-500 uppercase">
                        {new Date(usage.timestamp).toLocaleString()}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-[10px] font-bold text-zinc-600 uppercase py-6">No tracking data available</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* FEEDBACK TAB */}
        {tab === 'FEEDBACK' && (
          <div className="px-4 py-6 space-y-4 animate-in slide-in-from-right-4">
            <h3 className="text-xs font-black uppercase text-zinc-500 tracking-widest flex items-center gap-2 border-b border-zinc-800 pb-2 mb-4">
              <MessageSquare size={14} className="text-amber-500" /> User Suggestions & Feedback ({suggestions.filter(s => s.status === 'pending').length} Pending)
            </h3>

            {suggestions.length === 0 ? (
              <p className="text-[9px] font-bold text-zinc-700 uppercase italic text-center py-6">No suggestions received yet</p>
            ) : (
              <div className="space-y-3">
                {suggestions.map((s) => (
                  <div key={s.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <div className="flex gap-3">
                        <div className={`p-2 rounded-xl mt-1 ${s.type === 'bug' ? 'bg-rose-500/10 text-rose-500' : s.type === 'feature' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-zinc-800 text-zinc-400'}`}>
                          <MessageSquare size={16} />
                        </div>
                        <div>
                          <h4 className="font-black text-sm text-white uppercase tracking-tight">{s.title}</h4>
                          <p className="text-[9px] font-bold text-zinc-500 uppercase flex items-center gap-1.5 mt-0.5">
                            By {s.userName} • {new Date(s.timestamp).toLocaleDateString()}
                            <span className={`px-1.5 py-0.5 rounded ${s.status === 'pending' ? 'bg-amber-500/10 text-amber-500' :
                              s.status === 'implemented' ? 'bg-emerald-500/10 text-emerald-500' :
                                'bg-zinc-800 text-zinc-400'
                              }`}>{s.status}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                    <p className="text-[10px] text-zinc-400 italic bg-black/40 p-3 rounded-xl border border-zinc-800/50">"{s.description}"</p>

                    {s.status === 'pending' && (
                      <div className="flex gap-2">
                        <button onClick={() => handleReviewSuggestion(s.id, 'reviewed')} className="flex-1 bg-indigo-600/20 text-indigo-400 py-2 rounded-lg text-[9px] font-black uppercase hover:bg-indigo-600 hover:text-white transition-all">Mark Reviewed</button>
                        <button onClick={() => handleReviewSuggestion(s.id, 'implemented')} className="flex-1 bg-emerald-600/20 text-emerald-500 py-2 rounded-lg text-[9px] font-black uppercase hover:bg-emerald-600 hover:text-white transition-all">Implemented</button>
                        <button onClick={() => handleReviewSuggestion(s.id, 'rejected')} className="flex-1 bg-zinc-800 text-zinc-500 py-2 rounded-lg text-[9px] font-black uppercase hover:bg-rose-500/20 hover:text-rose-500 transition-all">Reject</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TASKS TAB (Reviews + Updates) */}
        {tab === 'TASKS' && (
          <div className="px-4 py-6 space-y-6 animate-in slide-in-from-right-4">

            {/* Trophy Applications Section */}
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase text-zinc-500 tracking-widest flex items-center gap-2 border-b border-zinc-800 pb-2">
                <Trophy size={14} className="text-amber-500" /> Trophy Applications ({allUsers.filter(u => u.trophyStatus === 'applied').length})
              </h3>
              {allUsers.filter(u => u.trophyStatus === 'applied').length === 0 ? (
                <p className="text-[9px] font-bold text-zinc-700 uppercase italic">No applications pending</p>
              ) : (
                allUsers.filter(u => u.trophyStatus === 'applied').map((user) => (
                  <div key={user.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex justify-between items-center group relative overflow-hidden transition-all">
                    <div className="flex items-center gap-4 relative z-10">
                      <div className="w-10 h-10 bg-black/50 rounded-2xl flex items-center justify-center text-amber-500 border border-zinc-800">
                        <Trophy size={18} />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-white uppercase tracking-tight">{user.name}</h4>
                        <div className="flex flex-col gap-0.5 mt-1">
                          <span className="text-[9px] font-black text-emerald-400 uppercase">{user.uploads} Links Synced</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 relative z-10">
                      <button
                        onClick={async () => {
                          try {
                            await ApiService.approveReelsTrophy(user.id!);
                            loadData();
                            showToast("Trophy Approved", "success");
                          } catch (e: any) { showToast(e.message, "error") }
                        }}
                        className="px-4 bg-emerald-600/20 text-emerald-500 py-2 rounded-lg text-[9px] font-black uppercase hover:bg-emerald-600 hover:text-white transition-all"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          const reason = prompt("Enter rejection reason:");
                          if (reason) {
                            ApiService.rejectReelsTrophy(user.id!, reason).then(() => {
                              showToast("Application Rejected", "info");
                              loadData();
                            });
                          }
                        }}
                        className="px-4 bg-zinc-800 text-rose-500 py-2 rounded-lg text-[9px] font-black uppercase hover:bg-rose-500/20 transition-all"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Trophy Shipments Section */}
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase text-zinc-500 tracking-widest flex items-center gap-2 border-b border-zinc-800 pb-2">
                <Package size={14} className="text-emerald-500" /> Trophy Shipments ({allUsers.filter(u => u.trophyStatus === 'awarded' && u.trophyDelivery).length})
              </h3>
              {allUsers.filter(u => u.trophyStatus === 'awarded' && u.trophyDelivery).length === 0 ? (
                <p className="text-[9px] font-bold text-zinc-700 uppercase italic">No shipments pending</p>
              ) : (
                allUsers.filter(u => u.trophyStatus === 'awarded' && u.trophyDelivery).map((user) => (
                  <div key={user.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex flex-col gap-3 group relative overflow-hidden transition-all">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500 border border-emerald-500/20">
                          <Package size={14} />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-white uppercase tracking-tight">{user.trophyDelivery.fullName}</h4>
                          <span className="text-[9px] font-black text-zinc-500 uppercase">{user.trophyDelivery.phone}</span>
                        </div>
                      </div>
                      <div className="bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded text-[8px] font-black uppercase">Pending Dispatch</div>
                    </div>
                    <div className="bg-black/40 p-3 rounded-xl border border-zinc-800/50">
                      <p className="text-[10px] font-bold text-zinc-400 leading-relaxed">{user.trophyDelivery.address}</p>
                      <div className="flex gap-4 mt-2">
                        {user.trophyDelivery.landmark && <p className="text-[8px] font-black text-amber-500/80 uppercase"><span className="text-zinc-600">Landmark:</span> {user.trophyDelivery.landmark}</p>}
                        <p className="text-[8px] font-black text-indigo-400/80 uppercase"><span className="text-zinc-600">PIN:</span> {user.trophyDelivery.pincode}</p>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          await ApiService.shipReelsTrophy(user.id!);
                          loadData();
                          showToast("Trophy Marked as Dispatched", "success");
                        } catch (e: any) { showToast(e.message, "error") }
                      }}
                      className="w-full bg-emerald-600 text-white py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-500 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/10"
                    >
                      <CheckCircle2 size={14} /> Mark as Dispatched
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Referral Refunds Section */}
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase text-zinc-500 tracking-widest flex items-center gap-2 border-b border-zinc-800 pb-2">
                <Percent size={14} className="text-indigo-500" /> Referral Refunds ({pendingRefunds.length})
              </h3>
              {pendingRefunds.length === 0 ? (
                <p className="text-[9px] font-bold text-zinc-700 uppercase italic">No refund requests pending</p>
              ) : (
                pendingRefunds.map((ref) => (
                  <div key={ref.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex flex-col gap-3 group relative overflow-hidden transition-all text-left">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-500 border border-indigo-500/20">
                          <Zap size={14} />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-white uppercase tracking-tight">{ref.userName}</h4>
                          <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Milestone: {ref.milestone} Refs</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-black text-emerald-400 italic">₹{ref.amount.toLocaleString()}</div>
                        <div className="text-[7px] font-bold text-zinc-600 uppercase tracking-widest">Amount Due</div>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-1">
                      <button
                        onClick={async () => {
                          if (confirm(`Approve ₹${ref.amount} refund for ${ref.userName}?`)) {
                            try {
                              await ApiService.updateReferralRefundStatus(ref.id, 'completed');
                              loadData();
                              showToast("Refund Approved", "success");
                            } catch (e: any) { showToast(e.message, "error") }
                          }
                        }}
                        className="flex-1 bg-emerald-600/20 text-emerald-500 py-2 rounded-lg text-[9px] font-black uppercase hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                      >
                        Approve
                      </button>

                      <button
                        onClick={async () => {
                          const reason = prompt("Enter rejection reason (optional):");
                          if (reason !== null) {
                            try {
                              await ApiService.updateReferralRefundStatus(ref.id, 'rejected');
                              loadData();
                              showToast("Refund Rejected", "info");
                            } catch (e: any) { showToast(e.message, "error") }
                          }
                        }}
                        className="flex-1 bg-zinc-800 text-rose-500 py-2 rounded-lg text-[9px] font-black uppercase hover:bg-rose-500/20 transition-all shadow-sm"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Equipment Updates Section */}
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase text-zinc-500 tracking-widest flex items-center gap-2 border-b border-zinc-800 pb-2">
                <Settings size={14} className="text-amber-500" /> Equipment Requests ({pendingEquipment.length})
              </h3>
              {pendingEquipment.length === 0 ? (
                <p className="text-[9px] font-bold text-zinc-700 uppercase italic">No requests pending</p>
              ) : (
                pendingEquipment.map((req) => (
                  <div key={req.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl space-y-3 relative overflow-hidden">
                    <div className="relative z-10">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="text-xs font-black text-white italic uppercase">{req.equipmentName}</h4>
                          <p className="text-[9px] font-bold text-zinc-500 uppercase mt-0.5">Gym: {req.gymName} • By: {req.userName}</p>
                        </div>
                        {req.proofImage && (
                          <div className="bg-zinc-800 p-1 rounded-lg border border-zinc-700">
                            <Camera size={14} className="text-indigo-400" />
                          </div>
                        )}
                      </div>

                      {/* Photo Evidence Display */}
                      {req.proofImage && (
                        <div className="mt-3 mb-1 w-full h-32 bg-black rounded-xl overflow-hidden border border-zinc-700 relative group">
                          <img src={`data:image/jpeg;base64,${req.proofImage}`} className="w-full h-full object-cover" alt="proof" />
                          <div className="absolute bottom-2 right-2 bg-black/60 px-2 py-0.5 rounded text-[8px] font-black uppercase text-white backdrop-blur-sm">User Evidence</div>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 mt-2 relative z-10">
                      <button onClick={() => handleReviewEquipment(req.id!, 'approved')} className="flex-1 bg-emerald-600/20 text-emerald-500 py-2 rounded-lg text-[9px] font-black uppercase hover:bg-emerald-600 hover:text-white transition-all">Add to DB</button>
                      <button onClick={() => handleReviewEquipment(req.id!, 'rejected')} className="flex-1 bg-zinc-800 text-rose-500 py-2 rounded-lg text-[9px] font-black uppercase hover:bg-rose-500/20 transition-all">Reject</button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Redemptions Management (Moved from Commerce) */}
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase text-zinc-500 tracking-widest flex items-center gap-2 border-b border-zinc-800 pb-2">
                <Landmark size={14} className="text-amber-500" /> Pending Payouts ({pendingRedemptions.length})
              </h3>
              {pendingRedemptions.length === 0 ? (
                <p className="text-[9px] font-bold text-zinc-700 uppercase italic">No pending payouts</p>
              ) : (
                pendingRedemptions.map((req) => (
                  <div key={req.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex justify-between items-center group relative overflow-hidden transition-all">
                    <div className="flex items-center gap-4 relative z-10">
                      <div className="w-10 h-10 bg-black/50 rounded-2xl flex items-center justify-center text-amber-500 border border-zinc-800">
                        <Landmark size={18} />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-white uppercase tracking-tight">₹{req.amount}</h4>
                        <div className="flex flex-col gap-0.5 mt-1">
                          <span className="text-[9px] font-black text-zinc-400 uppercase">Creator: {req.creatorName}</span>
                          <span className="text-[9px] font-black text-emerald-400 uppercase">UPI: {req.upiId || 'Not Provided'}</span>
                          <span className="text-[7px] font-bold text-zinc-600 uppercase tracking-widest mt-0.5">{new Date(req.timestamp).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 relative z-10">
                      <button onClick={() => handleReviewRedemption(req.id!, 'completed')} className="px-4 bg-emerald-600/20 text-emerald-500 py-2 rounded-lg text-[9px] font-black uppercase hover:bg-emerald-600 hover:text-white transition-all">Approve</button>
                      <button onClick={() => handleReviewRedemption(req.id!, 'rejected')} className="px-4 bg-zinc-800 text-rose-500 py-2 rounded-lg text-[9px] font-black uppercase hover:bg-rose-500/20 transition-all">Reject</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* AI CORE (PROMPTS) TAB */}
        {tab === 'PROMPTS' && (
          <div className="px-4 py-6 space-y-6 animate-in slide-in-from-right-4">

            {/* AI Limits Manager */}
            <div className="bg-gradient-to-br from-indigo-900/30 to-black p-5 rounded-[2rem] border border-indigo-500/20 shadow-xl space-y-4">
              <div className="flex items-center gap-2 text-indigo-400">
                <BrainCircuit size={16} />
                <h3 className="text-xs font-black uppercase tracking-widest">Plan & Tier AI Quotas</h3>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {['WORKOUT', 'NUTRITION', 'VISION', 'SYSTEM'].map(cat => (
                  <div key={cat} className="space-y-2">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-800 pb-1">{cat} Category Limits</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {['limit_free', 'limit_1_month', 'limit_3_month', 'limit_6_month', 'limit_12_month', 'limit_pass'].map((baseKey) => {
                        const key = `${baseKey}_${cat.toLowerCase()}`;
                        const val = aiLimits[key] !== undefined ? aiLimits[key] : 0;
                        return (
                          <div key={key} className="bg-black/50 p-2.5 rounded-xl border border-zinc-800 flex flex-col items-center justify-between text-center gap-1.5 focus-within:border-indigo-500/50 transition-colors">
                            <span className="text-[7px] font-black uppercase tracking-widest text-zinc-500">{baseKey.replace('limit_', '').replace(/_/g, ' ')}</span>
                            <input
                              type="number"
                              value={val}
                              onChange={e => setAiLimits({ ...aiLimits, [key]: parseInt(e.target.value) || 0 })}
                              onBlur={() => handleSaveAILimit(key, val)}
                              className="w-full bg-zinc-900 border border-zinc-700 text-center rounded-lg text-[10px] font-black text-white py-1.5 focus:border-indigo-500 outline-none"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {['ALL', 'WORKOUT', 'NUTRITION', 'VISION', 'SYSTEM'].map(cat => (
                <button
                  key={cat}
                  onClick={() => setPromptCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest border transition-all shrink-0 ${promptCategory === cat ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              {filteredPrompts.map((prompt) => (
                <div key={prompt.id} className="bg-zinc-900 border border-zinc-800 p-5 rounded-[2.2rem] space-y-4 shadow-xl group relative">
                  <div className="flex justify-between items-start pr-8">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl text-black shadow-lg ${prompt.category === 'WORKOUT' ? 'bg-indigo-500' : prompt.category === 'NUTRITION' ? 'bg-emerald-500' : prompt.category === 'VISION' ? 'bg-purple-500' : 'bg-zinc-500'}`}>
                        {prompt.category === 'WORKOUT' ? <Zap size={16} /> : prompt.category === 'NUTRITION' ? <Star size={16} /> : prompt.category === 'VISION' ? <Video size={16} /> : <Settings size={16} />}
                      </div>
                      <div>
                        <h3 className="font-black text-xs text-white uppercase italic tracking-tight">{prompt.title}</h3>
                        <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5">{prompt.category} • {prompt.model.split('-')[1]}</p>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setEditingPrompt(prompt)}
                    className="absolute top-5 right-5 p-2 bg-zinc-800 text-amber-500 rounded-xl hover:bg-amber-500 hover:text-white transition-all"
                  >
                    <Settings size={14} />
                  </button>

                  <p className="text-[10px] font-bold text-zinc-400 leading-relaxed italic border-l-2 border-zinc-800 pl-3">"{prompt.description}"</p>

                  <div className="bg-black/50 p-3 rounded-xl border border-zinc-800 relative group/code overflow-hidden">
                    <div className="absolute top-2 right-2 opacity-0 group-hover/code:opacity-100 transition-opacity">
                      <Copy size={12} className="text-zinc-500 cursor-pointer hover:text-white" onClick={() => { navigator.clipboard.writeText(prompt.template); showToast("Template Copied", "info") }} />
                    </div>
                    <pre className="text-[9px] text-zinc-500 font-mono whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto scrollbar-hide">
                      {prompt.template}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Prompt Edit Modal */}
        {editingPrompt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-zinc-950 border border-zinc-800 w-full max-w-md rounded-[2.5rem] p-6 space-y-6 shadow-2xl animate-in zoom-in-95 relative overflow-hidden">
              <div className="flex justify-between items-center relative z-10">
                <div className="flex items-center gap-2 text-amber-500">
                  <Settings size={16} />
                  <h3 className="text-xs font-black uppercase tracking-widest">Edit Prompt</h3>
                </div>
                <button onClick={() => setEditingPrompt(null)} className="p-2 text-zinc-500 hover:text-white"><X size={16} /></button>
              </div>

              <div className="space-y-4 relative z-10">
                <div>
                  <label className="text-[8px] font-black uppercase text-zinc-500 tracking-widest mb-1 block">Prompt Title</label>
                  <input
                    type="text"
                    value={editingPrompt.title}
                    onChange={(e) => setEditingPrompt({ ...editingPrompt, title: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 p-3 rounded-xl text-xs font-black text-white focus:border-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[8px] font-black uppercase text-zinc-500 tracking-widest mb-1 block">Description</label>
                  <input
                    type="text"
                    value={editingPrompt.description}
                    onChange={(e) => setEditingPrompt({ ...editingPrompt, description: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 p-3 rounded-xl text-xs font-black text-white focus:border-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[8px] font-black uppercase text-amber-500 tracking-widest mb-1 block">System Instructions (Template)</label>
                  <textarea
                    value={editingPrompt.template}
                    onChange={(e) => setEditingPrompt({ ...editingPrompt, template: e.target.value })}
                    className="w-full bg-black/50 border border-amber-500/30 p-4 rounded-2xl text-[10px] text-zinc-300 font-mono focus:border-amber-500 outline-none h-48 focus:ring-4 ring-amber-500/10 transition-all font-medium leading-relaxed"
                  />
                </div>

                <button
                  onClick={handleSavePrompt}
                  className="w-full bg-amber-500 text-black py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg flex justify-center items-center gap-2 hover:bg-amber-400 transition-all active:scale-95"
                >
                  <Save size={14} /> Update System Prompt
                </button>
              </div>
            </div>
          </div>
        )}


        {/* NETWORK (GYMS) TAB */}
        {tab === 'NETWORK' && (
          <div className="px-4 py-6 space-y-4 animate-in slide-in-from-right-4">
            <button
              onClick={() => setShowGymForm(!showGymForm)}
              className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              {showGymForm ? <X size={16} /> : <Plus size={16} />}
              {showGymForm ? 'Cancel' : 'Add Location'}
            </button>

            {showGymForm && (
              <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-[2rem] space-y-3 animate-in fade-in slide-in-from-top-4">
                <input value={gymName} onChange={e => setGymName(e.target.value)} className="w-full bg-black/50 border border-zinc-800 p-3 rounded-xl text-xs font-bold text-white focus:border-indigo-500 outline-none" placeholder="Gym Name" />
                <input value={gymLocation} onChange={e => setGymLocation(e.target.value)} className="w-full bg-black/50 border border-zinc-800 p-3 rounded-xl text-xs font-bold text-white focus:border-indigo-500 outline-none" placeholder="City / Location" />

                <div className="space-y-2 pt-2">
                  <div className="flex gap-2">
                    <input
                      value={gymEquipmentInput}
                      onChange={e => setGymEquipmentInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddEquipmentToForm()}
                      className="flex-1 bg-black/50 border border-zinc-800 p-3 rounded-xl text-xs font-bold text-white focus:border-indigo-500 outline-none"
                      placeholder="Add Machine (e.g. Leg Press)"
                    />
                    <button onClick={handleAddEquipmentToForm} className="bg-zinc-800 p-3 rounded-xl text-zinc-400 hover:text-white border border-zinc-700">
                      <Plus size={16} />
                    </button>
                  </div>

                  {gymEquipmentList.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 p-2 bg-black/30 rounded-xl border border-zinc-800/50">
                      {gymEquipmentList.map((eq, i) => (
                        <div key={i} className="flex items-center gap-1 bg-zinc-800 text-zinc-300 px-2 py-1 rounded-lg text-[8px] font-black uppercase">
                          {eq}
                          <button onClick={() => setGymEquipmentList(prev => prev.filter((_, idx) => idx !== i))} className="hover:text-rose-500">
                            <X size={8} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button onClick={handleAddGym} className="w-full bg-white text-black py-3 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg mt-2">Confirm</button>
              </div>
            )}

            <div className="space-y-3">
              {gyms.map((gym) => (
                <div key={gym.id} className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-[2rem] flex flex-col gap-3 group">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="bg-zinc-800 p-2.5 rounded-xl text-zinc-500"><Building2 size={16} /></div>
                      <div>
                        <h4 className="font-black text-xs text-white italic uppercase tracking-tight">{gym.name}</h4>
                        <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">{gym.location}</p>
                      </div>
                    </div>
                    <button onClick={() => handleDeleteGym(gym.id!)} className="p-2.5 bg-zinc-800/50 text-zinc-600 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"><Trash2 size={14} /></button>
                  </div>

                  {gym.equipment.length > 0 && (
                     <div className="flex flex-wrap gap-1 px-1">
                      {gym.equipment.slice(0, 6).map((eq, i) => (
                        <span key={i} className="text-[7px] font-black uppercase bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded">{eq}</span>
                      ))}
                      {gym.equipment.length > 6 && <span className="text-[7px] text-zinc-600 px-1">+{gym.equipment.length - 6} more</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FEEDBACK TAB */}
        {tab === 'FEEDBACK' && (
          <div className="px-4 py-6 space-y-4 animate-in slide-in-from-right-4">
            <h3 className="text-xl font-black italic uppercase tracking-tighter text-white mb-4 flex items-center gap-2">
              <MessageSquare className="text-amber-500" /> Developer Feedback
            </h3>
            
            <div className="space-y-3">
              {suggestions.length === 0 && (
                <div className="bg-zinc-900/50 p-6 rounded-[2rem] border border-zinc-800 text-center">
                  <p className="text-xs font-bold text-zinc-500 uppercase">No feedback submitted yet</p>
                </div>
              )}
              {suggestions.map((suggestion) => (
                <div key={suggestion.id} className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-[2rem] flex flex-col gap-3 group">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                          suggestion.type === 'bug' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' :
                          suggestion.type === 'feature' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                          'bg-zinc-800 text-zinc-400 border border-zinc-700'
                        }`}>
                          {suggestion.type}
                        </span>
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase ${
                          suggestion.status === 'pending' ? 'bg-amber-500/10 text-amber-500' :
                          suggestion.status === 'reviewed' ? 'bg-blue-500/10 text-blue-400' :
                          suggestion.status === 'implemented' ? 'bg-emerald-500/10 text-emerald-500' :
                          'bg-rose-500/10 text-rose-500'
                        }`}>
                          {suggestion.status}
                        </span>
                      </div>
                      <h4 className="font-black text-sm text-white">{suggestion.title}</h4>
                      <p className="text-[10px] text-zinc-400 mt-1 break-words">{suggestion.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-zinc-800/50 pt-3 mt-1">
                    <div className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">
                      {suggestion.userName || 'Anonymous'} • {new Date(suggestion.timestamp).toLocaleDateString()}
                    </div>
                    {suggestion.status === 'pending' && (
                      <div className="flex items-center gap-2">
                         <button 
                           onClick={() => handleReviewSuggestion(suggestion.id, 'reviewed')}
                           className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-xl text-[8px] font-black uppercase transition-colors"
                         >
                           Reviewed
                         </button>
                         <button 
                           onClick={() => handleReviewSuggestion(suggestion.id, 'implemented')}
                           className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 rounded-xl text-[8px] font-black uppercase transition-colors"
                         >
                           Implement
                         </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Admin Bottom Navigation */}
      <nav className="flex-none bg-zinc-950/95 backdrop-blur-xl border-t border-amber-500/20 flex justify-around items-center py-4 px-2 z-50 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {[
          { id: 'OVERVIEW', icon: LayoutDashboard, label: 'Overview' },
          { id: 'USERS', icon: UserCheck, label: 'Users' },
          { id: 'TASKS', icon: ListChecks, label: 'Tasks', count: pendingEquipment.length + pendingRedemptions.length },
          { id: 'COMMERCE', icon: CreditCard, label: 'Commerce' },
          { id: 'NETWORK', icon: Network, label: 'Network' },
          { id: 'PROMPTS', icon: Bot, label: 'Prompts' },
          { id: 'FEEDBACK', icon: MessageSquare, label: 'Feedback', count: suggestions.filter(s => s.status === 'pending').length },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id as any)}
            className={`flex-col items-center gap-1.5 transition-all active:scale-90 relative ${tab === item.id ? 'text-amber-500 scale-105' : 'text-zinc-600 hover:text-zinc-400'
              }`}
          >
            <item.icon size={22} strokeWidth={tab === item.id ? 2.5 : 2} />
            <span className="text-[9px] font-black uppercase tracking-wider">{item.label}</span>
            {item.count ? (
              <span className="absolute -top-1 right-2 w-3.5 h-3.5 bg-rose-500 text-white rounded-full text-[8px] flex items-center justify-center font-bold">{item.count}</span>
            ) : null}
          </button>
        ))}
      </nav>
    </div >
  );
};
