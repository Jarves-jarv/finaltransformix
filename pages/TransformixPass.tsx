
import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { ApiService } from '../services/api';
import { MapPin, Search, Filter, Star, Navigation2, QrCode, CreditCard, Gift, ShieldCheck, Map as MapIcon } from 'lucide-react';

interface Props {
  profile: UserProfile;
  setActiveTab: (tab: string) => void;
}

const PARTNER_GYMS = [
  { name: 'Elite Gym Mumbai', distance: '0.8 km', rating: 4.9, type: 'Gym', img: 'g1' },
  { name: 'Soul Yoga Sanctuary', distance: '1.5 km', rating: 4.7, type: 'Yoga', img: 'g2' },
  { name: 'The Iron Box', distance: '2.4 km', rating: 4.8, type: 'Gym', img: 'g3' },
];

export const TransformixPass: React.FC<Props> = ({ profile, setActiveTab }) => {
  const [showQR, setShowQR] = useState(false);
  const [gymHistory, setGymHistory] = useState(0);

  useEffect(() => {
    const loadStats = async () => {
      const history = await ApiService.getWorkoutHistory();
      setGymHistory(history.length);
    };
    loadStats();
  }, []);

  if (showQR) return (
    <div className="flex flex-col items-center justify-center h-full space-y-12 px-8 animate-in zoom-in-95">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-black italic uppercase">PASS SCAN</h2>
        <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Valid for 59:59 minutes</p>
      </div>
      <div className="bg-white p-8 rounded-[3rem] shadow-[0_0_80px_rgba(79,70,229,0.3)]">
        <div className="w-64 h-64 bg-zinc-100 flex items-center justify-center rounded-2xl overflow-hidden">
          <QrCode size={200} className="text-black" strokeWidth={1.5} />
        </div>
      </div>
      <div className="bg-zinc-900/50 p-6 rounded-3xl border border-zinc-800 text-center w-full">
        <p className="text-sm font-bold mb-1">Elite Fitness Pro</p>
        <p className="text-xs text-zinc-500">Nearby Center Detected</p>
      </div>
      <button onClick={() => setShowQR(false)} className="text-zinc-500 font-bold uppercase text-xs tracking-widest border-b border-zinc-800 pb-1">Cancel Check-in</button>
    </div>
  );

  return (
    <div className="space-y-6 pb-24 max-w-md mx-auto relative w-full">
      <div className="flex justify-between items-end px-2">
        <div className="space-y-1">
          <span className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Global Network</span>
          <h2 className="text-4xl font-black italic tracking-tighter uppercase">Pass Access</h2>
        </div>
        <button
          onClick={() => profile.isPassActive ? setShowQR(true) : setActiveTab('pricing')}
          className="bg-indigo-600 p-4 rounded-3xl text-white shadow-xl shadow-indigo-600/30 active:scale-95 transition-all"
        >
          <QrCode size={24} />
        </button>
      </div>

      {!profile.isPassActive ? (
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-[2.5rem] space-y-4">
          <h3 className="font-black text-xl italic uppercase">Upgrade Your Access</h3>
          <p className="text-xs text-zinc-500 leading-relaxed">Unlock 8,100+ gyms and specialized studios nationwide with a single pass.</p>
          <button
            onClick={() => setActiveTab('pricing')}
            className="w-full bg-white text-black py-4 rounded-2xl font-black text-xs uppercase tracking-widest"
          >
            Activate Now
          </button>
        </div>
      ) : (
        <div className="bg-gradient-to-br from-indigo-900/40 to-black p-6 rounded-[2.5rem] border border-indigo-500/30 relative overflow-hidden">
          <div className="flex justify-between items-start mb-6">
            <h3 className="text-xl font-black uppercase italic">Pro Membership</h3>
            <span className="bg-emerald-500 text-black text-[10px] font-black px-2 py-1 rounded">ACTIVE</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-[10px] text-zinc-500 font-bold uppercase">Membership Type</p>
              <p className="text-sm font-black">Unlimited Pro</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] text-zinc-500 font-bold uppercase">Total Visits</p>
              <p className="text-sm font-black">{gymHistory} Sessions</p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex justify-between items-center px-2">
          <h3 className="text-xs font-black uppercase text-zinc-600 tracking-widest">Nearby Centers</h3>
          <button className="text-indigo-500 text-[10px] font-black uppercase flex items-center gap-1"><MapIcon size={12} /> View Map</button>
        </div>
        {PARTNER_GYMS.map((gym, i) => (
          <div key={i} className="bg-zinc-900/50 p-4 rounded-[2rem] border border-zinc-800 flex items-center gap-4 group cursor-pointer hover:border-indigo-500/30 transition-all">
            <div className="w-16 h-16 bg-zinc-800 rounded-2xl overflow-hidden shrink-0">
              <img src={`https://picsum.photos/seed/${gym.img}/200/200`} className="w-full h-full object-cover grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-500" alt="gym" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex justify-between items-start">
                <h4 className="font-bold text-sm">{gym.name}</h4>
                <div className="flex items-center gap-0.5 text-amber-500 text-[10px] font-black"><Star size={10} fill="currentColor" /> {gym.rating}</div>
              </div>
              <p className="text-[10px] text-zinc-500 font-bold uppercase">{gym.distance} • {gym.type}</p>
            </div>
            <button className="bg-zinc-800 p-2.5 rounded-xl text-zinc-500 group-hover:text-indigo-400 group-hover:bg-indigo-500/10"><Navigation2 size={16} /></button>
          </div>
        ))}
      </div>
    </div>
  );
};
