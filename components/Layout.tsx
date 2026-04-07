
import React from 'react';
import { Home, Dumbbell, Utensils, TrendingUp, CreditCard, MessageCircle, Users, Gift, ShoppingBag, Settings, User, ShieldCheck } from 'lucide-react';
import { UserProfile } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  profile?: UserProfile;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab, profile }) => {
  const navItems = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'workout', icon: Dumbbell, label: 'Work' },
    { id: 'diet', icon: Utensils, label: 'Diet' },
    { id: 'progress', icon: TrendingUp, label: 'Prog' },
    { id: 'pricing', icon: ShoppingBag, label: 'Shop' },
  ];

  if (profile?.role === 'admin') {
    navItems.push({ id: 'admin', icon: ShieldCheck, label: 'Admin' });
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-black text-white max-w-md mx-auto relative shadow-2xl overflow-hidden border-x border-zinc-800 pt-[env(safe-area-inset-top)]">
      {/* Main Branding Header */}
      <header className="flex-none z-[60] bg-black/95 backdrop-blur-xl border-b border-zinc-800 p-4 flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab('settings')}
            className={`w-8 h-8 rounded-lg overflow-hidden border bg-zinc-800 flex items-center justify-center transition-all active:scale-90 ${activeTab === 'settings' ? 'border-indigo-500 shadow-[0_0_10px_rgba(79,70,229,0.3)]' : 'border-zinc-700'}`}
            title="Profile & Settings"
          >
            {profile?.profileImage ? (
              <img src={profile.profileImage} className="w-full h-full object-cover" alt="Profile" />
            ) : (
              <User size={16} className="text-zinc-500" />
            )}
          </button>
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm italic shadow-lg ${profile?.isPassActive ? 'bg-amber-500 text-black shadow-amber-500/20' : 'bg-indigo-600 text-white shadow-indigo-600/20'}`}>
              T
            </div>
            <div className="flex flex-col">
              <h1 className="text-lg font-black tracking-tighter uppercase leading-none mt-1">Transformix</h1>
              <span className={`text-[8px] font-black uppercase tracking-[0.2em] mt-0.5 ${profile?.isPassActive ? 'text-amber-500' : 'text-indigo-400'}`}>
                {profile?.isPassActive ? 'PRO PASS' : profile?.plan ? profile.plan : 'Free Tier'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => setActiveTab('rewards')}
            className={`p-2 rounded-full transition-all ${activeTab === 'rewards' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'bg-zinc-900 text-amber-500 hover:bg-zinc-800'}`}
            title="Rewards"
          >
            <Gift size={16} />
          </button>
          <button
            onClick={() => setActiveTab('assistant')}
            className={`p-2 rounded-full transition-all ${activeTab === 'assistant' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-zinc-900 text-indigo-400 hover:bg-zinc-800'}`}
            title="AI Coach"
          >
            <MessageCircle size={16} />
          </button>
          <button
            onClick={() => setActiveTab('community')}
            className={`p-2 rounded-full transition-all ${activeTab === 'community' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}
            title="Community"
          >
            <Users size={16} />
          </button>
        </div>
      </header>

      {/* Scrollable Content Area */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col">
        <div className="p-4 flex-1 flex flex-col relative">
          {children}
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="flex-none bg-zinc-950/90 backdrop-blur-2xl border-t border-zinc-800/50 flex justify-around items-center py-4 px-2 z-50 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {navItems.slice(0, profile?.role === 'admin' ? 6 : 5).map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center gap-1.5 transition-all active:scale-90 ${activeTab === item.id
              ? (item.id === 'admin' ? 'text-amber-500 scale-105' : 'text-indigo-500 scale-105')
              : 'text-zinc-600 hover:text-zinc-400'
              }`}
          >
            <item.icon size={22} strokeWidth={activeTab === item.id ? 2.5 : 2} />
            <span className="text-[9px] font-black uppercase tracking-wider">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};
