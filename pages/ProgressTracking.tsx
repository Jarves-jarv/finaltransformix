
import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, WeightUnit } from '../types';
import { ApiService } from '../services/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Award, Calendar, ChevronRight, TrendingUp, TrendingDown, Scale, History, Plus, X, BrainCircuit, Sparkles, Ruler, Edit2, CheckCircle2, Loader2, Check, Trash2, Camera, Image as ImageIcon } from 'lucide-react';

interface Props {
  profile: UserProfile;
  setProfile: (profile: UserProfile) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const ProgressTracking: React.FC<Props> = ({ profile, setProfile, showToast }) => {
  const [weightHistory, setWeightHistory] = useState<any[]>([]);
  const [currentMetrics, setCurrentMetrics] = useState<any>(null);
  const [previousMetrics, setPreviousMetrics] = useState<any>(null);
  const [photos, setPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal State
  const [selectedPart, setSelectedPart] = useState<'weight' | 'biceps' | 'waist' | 'chest' | 'thighs' | 'bodyFat'>('biceps');
  const [modalValues, setModalValues] = useState<Record<string, number>>({});
  const [modifiedParts, setModifiedParts] = useState<Set<string>>(new Set());

  const weightMultiplier = profile.weightUnit === WeightUnit.LBS ? 2.20462 : 1;
  const unitLabel = profile.weightUnit || WeightUnit.KG;

  useEffect(() => {
    loadProgress();
    loadPhotos();
  }, [profile.weight]);

  const loadProgress = async () => {
    setLoading(true);
    const history = await ApiService.getWeightHistory();
    const current = await ApiService.getLatestMetrics();
    const prev = await ApiService.getPreviousMetrics();

    setCurrentMetrics(current);
    setPreviousMetrics(prev);

    if (history.length === 0) {
      setWeightHistory([{ date: 'Start', weight: profile.weight * weightMultiplier }]);
    } else {
      setWeightHistory(history.map(h => ({
        ...h,
        weight: h.weight * weightMultiplier,
        displayDate: new Date(h.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
      })));
    }
    setLoading(false);
  };

  const loadPhotos = async () => {
    const data = await ApiService.getProgressPhotos();
    setPhotos(data);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        await ApiService.saveProgressPhoto(base64);
        showToast("Visual record locked.", "success");
        loadPhotos();
      };
      reader.readAsDataURL(file);
    } catch (err) {
      showToast("Sync failed.", "error");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const deletePhoto = async (id: number) => {
    await ApiService.deleteProgressPhoto(id);
    loadPhotos();
    showToast("Record purged.", "info");
  };

  const openModal = (startPart: any = 'biceps') => {
    const initialValues: any = {};
    bodyParts.forEach(p => {
      let val = currentMetrics?.[p.id] || p.default;
      if (p.id === 'weight') val *= weightMultiplier;
      initialValues[p.id] = val;
    });
    setModalValues(initialValues);
    setModifiedParts(new Set([startPart]));
    setSelectedPart(startPart);
    setShowAddModal(true);
  };

  const handleModalValueChange = (val: number) => {
    setModalValues(prev => ({ ...prev, [selectedPart]: val }));
    setModifiedParts(prev => new Set(prev).add(selectedPart));
  };

  const handleSaveBatch = async () => {
    if (modifiedParts.size === 0) {
      setShowAddModal(false);
      return;
    }
    setIsSaving(true);
    try {
      const metricsToSave: any = {};
      modifiedParts.forEach(part => {
        let val = modalValues[part];
        if (part === 'weight') val /= weightMultiplier;
        metricsToSave[part] = val;
      });
      await ApiService.logMetrics(metricsToSave);
      
      if (metricsToSave.weight !== undefined) {
        setProfile({ ...profile, weight: metricsToSave.weight });
      }

      setShowAddModal(false);
      loadProgress();
      showToast(`${modifiedParts.size} metrics updated.`, "success");
    } catch (e) {
      showToast("Update failed", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const getDiff = (key: string) => {
    if (!currentMetrics?.[key] || !previousMetrics?.[key]) return null;
    let diff = currentMetrics[key] - previousMetrics[key];
    if (key === 'weight') diff *= weightMultiplier;
    return diff === 0 ? null : diff;
  };

  const latestWeight = (profile.weight * weightMultiplier).toFixed(1);
  const initialWeight = weightHistory[0]?.weight || profile.weight * weightMultiplier;
  const weightDiff = (parseFloat(latestWeight) - initialWeight);

  const bodyParts = [
    { id: 'weight', label: 'Weight', icon: '⚖️', unit: unitLabel, min: 30 * weightMultiplier, max: 200 * weightMultiplier, default: profile.weight },
    { id: 'biceps', label: 'Biceps', icon: '💪', unit: 'cm', min: 20, max: 60, default: 32 },
    { id: 'chest', label: 'Chest', icon: '🫁', unit: 'cm', min: 60, max: 150, default: 98 },
    { id: 'waist', label: 'Waist', icon: '🎯', unit: 'cm', min: 50, max: 130, default: 82 },
    { id: 'thighs', label: 'Thighs', icon: '🦵', unit: 'cm', min: 30, max: 90, default: 58 },
    { id: 'bodyFat', label: 'Body Fat', icon: '🔥', unit: '%', min: 3, max: 50, default: 15 },
  ];

  const currentPartConfig = bodyParts.find(p => p.id === selectedPart);

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-500 max-w-md mx-auto relative w-full">
      <header className="sticky top-0 z-30 bg-black/95 backdrop-blur-md -mx-4 px-5 py-4 border-b border-zinc-900/50 flex justify-between items-end">
        <div>
          <span className="text-indigo-500 text-[10px] font-bold uppercase tracking-widest">Performance Insights</span>
          <h2 className="text-3xl font-black italic uppercase tracking-tighter">Progress</h2>
        </div>
        <div className="bg-zinc-900 p-2 rounded-xl text-zinc-400"><History size={18} /></div>
      </header>

      <div className="px-1 space-y-6 pt-4">
        <div className="bg-zinc-900 p-6 rounded-[2.5rem] border border-zinc-800 shadow-xl">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-500/20 p-2.5 rounded-xl text-emerald-500"><Scale size={20} /></div>
              <div>
                <h3 className="font-black uppercase text-xs tracking-tight">Mass Trend</h3>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{latestWeight} {unitLabel}</p>
              </div>
            </div>
            <div className={`flex items-center gap-1 font-black text-xs italic ${weightDiff <= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {weightDiff <= 0 ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
              {Math.abs(weightDiff).toFixed(1)} {unitLabel}
            </div>
          </div>
          <div className="h-48 w-full -ml-4">
            <ResponsiveContainer width="110%" height="100%">
              <AreaChart data={weightHistory}>
                <defs>
                  <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="displayDate" hide />
                <Tooltip
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold' }}
                  itemStyle={{ color: '#fff' }}
                  labelStyle={{ color: '#52525b' }}
                />
                <Area type="monotone" dataKey="weight" stroke="#6366f1" fillOpacity={1} fill="url(#colorWeight)" strokeWidth={4} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-zinc-900/50 p-6 rounded-[2.5rem] border border-zinc-800 space-y-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Ruler size={16} className="text-zinc-500" />
              <h3 className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em]">Morphology Lab</h3>
            </div>
            <span className="text-[8px] font-black text-zinc-700 uppercase tracking-widest">Updated {currentMetrics?.date ? new Date(currentMetrics.date).toLocaleDateString() : 'Today'}</span>
          </div>

          <div className="space-y-3">
            {bodyParts.map((part) => {
              let val = part.id === 'weight' ? profile.weight : (currentMetrics?.[part.id] || null);
              if (part.id === 'weight' && val !== null) val = (val * weightMultiplier).toFixed(1);
              const diff = getDiff(part.id);
              return (
                <div
                  key={part.id}
                  onClick={() => openModal(part.id)}
                  className="flex items-center justify-between p-4 bg-black/40 rounded-2xl border border-zinc-800/50 group hover:border-indigo-500/30 transition-all cursor-pointer active:scale-[0.98]"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl opacity-60 group-hover:opacity-100 transition-opacity">{part.icon}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-300">{part.label}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {diff !== null && (
                      <span className={`text-[9px] font-black italic ${diff > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {diff > 0 ? '+' : ''}{diff.toFixed(1)}{part.unit}
                      </span>
                    )}
                    <span className="text-sm font-black italic text-zinc-100">
                      {val || '--'}
                      <span className="text-[8px] text-zinc-600 ml-0.5 uppercase tracking-tighter font-bold">{part.unit}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-2">
            <button
              onClick={() => openModal('biceps')}
              className="w-full bg-indigo-600 text-white py-5 rounded-[2rem] font-black text-[11px] tracking-[0.2em] uppercase flex items-center justify-center gap-3 active:scale-95 transition-all shadow-xl shadow-indigo-600/30"
            >
              <Plus size={16} /> New Entry Session
            </button>
          </div>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-[3rem] p-8 space-y-8 animate-in slide-in-from-bottom-10 duration-500 shadow-2xl relative overflow-hidden">
            <div className="flex justify-between items-center">
              <div className="space-y-1">
                <h3 className="text-2xl font-black italic uppercase tracking-tighter">Precision Log</h3>
                <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">Update Metrics</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="bg-zinc-800 p-2 rounded-full text-zinc-500 hover:text-white"><X size={20} /></button>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {bodyParts.map(p => {
                const isModified = modifiedParts.has(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => { setSelectedPart(p.id as any); setModifiedParts(prev => new Set(prev).add(p.id)); }}
                    className={`px-4 py-2.5 rounded-xl border whitespace-nowrap text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${selectedPart === p.id ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-zinc-800 border-zinc-700 text-zinc-500'} ${isModified && selectedPart !== p.id ? 'border-emerald-500/50' : ''}`}
                  >
                    {isModified && <Check size={10} className="text-emerald-400" />}
                    {p.icon} {p.label}
                  </button>
                );
              })}
            </div>

            <div className="space-y-6">
              <div className="flex justify-between items-end">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Adjusting {currentPartConfig?.label}</span>
                </div>
                <div className="flex items-baseline gap-1 bg-zinc-800/40 p-2 rounded-xl border border-zinc-800">
                  <input
                    type="number"
                    value={modalValues[selectedPart] || 0}
                    onChange={(e) => handleModalValueChange(parseFloat(e.target.value) || 0)}
                    className="w-32 bg-transparent text-5xl font-black italic tracking-tighter text-white border-none outline-none focus:ring-0 text-right"
                  />
                  <span className="text-xs font-black text-indigo-500 uppercase ml-1">{currentPartConfig?.unit}</span>
                </div>
              </div>
              <input
                type="range"
                min={currentPartConfig?.min}
                max={currentPartConfig?.max}
                step={selectedPart === 'weight' || selectedPart === 'bodyFat' ? 0.1 : 0.5}
                value={modalValues[selectedPart] || 0}
                onChange={(e) => handleModalValueChange(parseFloat(e.target.value))}
                className="w-full h-2 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-indigo-500 hover:bg-zinc-700 transition-all"
              />
            </div>

            <div className="space-y-3 pt-2">
              <button
                onClick={handleSaveBatch}
                disabled={isSaving || modifiedParts.size === 0}
                className="w-full bg-white text-black py-5 rounded-[2.5rem] font-black text-xs italic tracking-[0.2em] shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all uppercase disabled:opacity-30"
              >
                {isSaving ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />} Commit {modifiedParts.size} Measurements
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
