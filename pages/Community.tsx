
import React, { useState, useEffect } from 'react';
import { UserProfile, FitnessGoal, Gender } from '../types';
import { ApiService } from '../services/api';
import { supabase } from '../services/supabase';
import { Users, UserPlus, MessageSquare, MessageCircle, MapPin, Zap, Filter, X, Check, Trash2, Search, Clock, Sun, Sunrise, Sunset, Moon, Sparkles, Info, ArrowUpRight, ArrowDownLeft, Plus, Loader2, Target, Smartphone, ChevronLeft } from 'lucide-react';

const getAvatarUrl = (imgSrc: string | undefined, seed: string) => {
  if (!imgSrc) return `https://picsum.photos/seed/${seed}/150/150`;
  if (imgSrc.startsWith('http') || imgSrc.startsWith('data:')) return imgSrc;
  return `https://picsum.photos/seed/${imgSrc}/150/150`;
};

interface PartnerCard {
  id: string;
  name: string;
  gender: Gender;
  goal: string;
  distance: string;
  preferredTime: 'Morning' | 'Afternoon' | 'Evening' | 'Night';
  bio: string;
  img: string;
}



interface Props {
  profile: UserProfile;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  setActiveTab: (tab: string) => void;
}

export const Community: React.FC<Props> = ({ profile, showToast, setActiveTab }) => {
  const [activeTab, setActiveTabLocal] = useState<'DISCOVER' | 'REQUESTS' | 'SQUAD'>('DISCOVER');
  const [requestSubTab, setRequestSubTab] = useState<'SENT' | 'RECEIVED'>('RECEIVED');

  const [sentRequests, setSentRequests] = useState<any[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [myPost, setMyPost] = useState<any>(null);
  const [globalFeed, setGlobalFeed] = useState<PartnerCard[]>([]);

  const [goalFilter, setGoalFilter] = useState<string>('All');
  const [genderFilter, setGenderFilter] = useState<string>('All');

  const [showPostModal, setShowPostModal] = useState(false);
  const [postGoal, setPostGoal] = useState(profile.goal);
  const [postTime, setPostTime] = useState<'Morning' | 'Afternoon' | 'Evening' | 'Night'>('Morning');
  const [postBio, setPostBio] = useState('');
  const [isSubmittingPost, setIsSubmittingPost] = useState(false);

  useEffect(() => {
    refreshAllData();

    const channel = supabase
      .channel('public:community_posts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_posts' }, () => {
        refreshAllData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile.email]);

  const refreshAllData = async () => {
    const [reqs, my_post, my_partners, all_posts, all_profiles] = await Promise.all([
      ApiService.getRequests(profile.email),
      ApiService.getMyCommunityPost(profile.email),
      ApiService.getPartners(profile.email),
      ApiService.getAllCommunityPosts(profile.email),
      ApiService.getAllProfiles()
    ]);
    
    const imageMap: Record<string, string> = {};
    if (all_profiles) {
      all_profiles.forEach(p => {
        if (p.email && p.profileImage) {
          imageMap[p.email] = p.profileImage;
        }
      });
    }

    setSentRequests(reqs.sent.map(r => ({ ...r, receiverImg: imageMap[r.receiverEmail] || r.receiverImg })));
    setIncomingRequests(reqs.received.map(r => ({ ...r, senderImg: imageMap[r.senderEmail] || r.senderImg })));
    setMyPost(my_post);
    setPartners(my_partners.map(p => ({ ...p, partnerImg: imageMap[p.partnerEmail] || p.img })));

    const livePosts: PartnerCard[] = all_posts.map(p => ({
      id: p.userEmail!, // Using email as the ID ensures target routing works
      name: p.name || 'Agent User',
      gender: (p.gender as Gender) || Gender.MALE,
      goal: p.goal,
      distance: 'Live Agent',
      preferredTime: p.preferredTime as any,
      bio: p.bio,
      img: imageMap[p.userEmail!] || (p.id ? (p.id % 20).toString() : 'u1')
    }));

    setGlobalFeed(livePosts);
  };

  const handleSendRequest = async (partner: PartnerCard) => {
    if (sentRequests.some(r => r.receiverEmail === partner.id || r.partnerId === partner.id)) {
      showToast("Sync Request already active", "info");
      return;
    }
    await ApiService.createRequest(partner, profile.email, profile.name || 'Agent', profile.profileImage || 'u2');
    await refreshAllData();
    showToast(`Protocol sync sent to ${partner.name}`, "success");
  };

  const handleAcceptRequest = async (request: any) => {
    await ApiService.acceptPartner(request, profile.email, profile.name || 'Agent', profile.profileImage || 'u3');
    setIncomingRequests(prev => prev.filter(r => r.id !== request.id));
    await refreshAllData();
    showToast(`Handshake complete! ${request.senderName || request.name || request.partnerName} added to Squad.`, "success");
    setActiveTabLocal('SQUAD');
  };

  const handleDeclineRequest = (id: string) => {
    setIncomingRequests(prev => prev.filter(r => r.id !== id));
    showToast("Request declined", "info");
  };

  const handleDeleteSentRequest = async (id: number) => {
    await ApiService.deleteRequest(id);
    await refreshAllData();
    showToast("Request revoked", "info");
  };

  const handleCreatePost = async () => {
    if (!postBio.trim()) {
      showToast("Brief bio required for synchronization", "error");
      return;
    }
    setIsSubmittingPost(true);
    try {
      await ApiService.createCommunityPost({
        goal: postGoal,
        preferredTime: postTime,
        bio: postBio,
        name: profile.name,
        gender: profile.gender
      }, profile.email);
      setShowPostModal(false);
      await refreshAllData();
      showToast("Protocol listing published live", "success");
    } catch (e) {
      showToast("Publishing failed", "error");
    } finally {
      setIsSubmittingPost(false);
    }
  };

  const handleDeleteMyPost = async () => {
    await ApiService.deleteCommunityPost(profile.email);
    await refreshAllData();
    showToast("Listing retracted", "info");
  };

  const openWhatsApp = (phone?: string) => {
    const whatsappNumber = phone || '910000000000'; // Default placeholder
    const url = `https://wa.me/${whatsappNumber}?text=Hi! We connected via Transformix AI. Want to coordinate a training session?`;
    window.open(url, '_blank');
  };

  const filteredFeed = globalFeed.filter(p => {
    const matchesGoal = goalFilter === 'All' || p.goal === goalFilter;
    const matchesGender = genderFilter === 'All' || p.gender === genderFilter;
    return matchesGoal && matchesGender;
  });

  const isPassActive = profile.isPassActive && profile.passExpiryDate && profile.passExpiryDate >= Date.now();

  if (!isPassActive) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-6 text-center space-y-6 max-w-md mx-auto w-full">
        <div className="p-6 bg-indigo-500/10 rounded-[2rem] border border-indigo-500/20 shadow-[0_0_40px_rgba(99,102,241,0.1)]">
          <Users size={48} className="text-indigo-400 mx-auto mb-4" />
          <h2 className="text-xl font-black uppercase italic tracking-tighter text-white mb-2">Community Access</h2>
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Transformix Pass Required</p>
          <p className="text-xs text-zinc-400 leading-relaxed mt-3">
            The Community Hub — gym partner matching, squad sync and live discovery — is an exclusive benefit for <span className="text-indigo-400 font-black">Transformix Pass</span> holders.
          </p>
        </div>
        <button
          onClick={() => setActiveTab('pass')}
          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <Zap size={16} /> Unlock with Transformix Pass
        </button>
        <button
          onClick={() => setActiveTab('home')}
          className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest hover:text-zinc-400 transition-colors"
        >
          ← Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 relative max-w-md mx-auto w-full">
      <header className="px-1 space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setActiveTab('home')}
            className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 active:scale-90 transition-all shadow-lg"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex-1 flex justify-between items-center">
            <div className="space-y-0.5">
              <span className="text-indigo-500 text-[10px] font-bold uppercase tracking-widest">Network v3.2</span>
              <h2 className="text-3xl font-black italic tracking-tighter uppercase leading-none">Squads</h2>
            </div>
            <div className="flex bg-zinc-900 p-1 rounded-2xl border border-zinc-800 shadow-inner shrink-0">
              <button
                onClick={() => setActiveTabLocal('DISCOVER')}
                className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${activeTab === 'DISCOVER' ? 'bg-indigo-600 text-white shadow-lg' : 'text-zinc-500'}`}
              >
                Feed
              </button>
              <button
                onClick={() => setActiveTabLocal('REQUESTS')}
                className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase transition-all relative ${activeTab === 'REQUESTS' ? 'bg-indigo-600 text-white shadow-lg' : 'text-zinc-500'}`}
              >
                Inbox
                {(sentRequests.length > 0 || incomingRequests.length > 0) && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-rose-500 text-white flex items-center justify-center rounded-full text-[7px] border-2 border-black font-black">
                    {sentRequests.length + incomingRequests.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTabLocal('SQUAD')}
                className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${activeTab === 'SQUAD' ? 'bg-indigo-600 text-white shadow-lg' : 'text-zinc-500'}`}
              >
                Squad
              </button>
            </div>
          </div>
        </div>

        {activeTab === 'DISCOVER' && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button onClick={() => setShowPostModal(true)} className="flex items-center gap-2 bg-indigo-600 px-4 py-2.5 rounded-full text-[9px] font-black uppercase text-white shadow-lg shadow-indigo-600/20 active:scale-95 shrink-0">
              <Plus size={14} /> Publish My Post
            </button>
            {['All', ...Object.values(FitnessGoal)].map(g => (
              <button
                key={g}
                onClick={() => setGoalFilter(g)}
                className={`px-4 py-2.5 rounded-full text-[9px] font-black uppercase transition-all border shrink-0 ${goalFilter === g ? 'bg-zinc-800 border-indigo-500 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}
              >
                {g}
              </button>
            ))}
          </div>
        )}
      </header>

      {activeTab === 'DISCOVER' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
          {myPost && (
            <div className="mx-1 bg-indigo-600/10 border border-indigo-500/30 p-5 rounded-[2.5rem] space-y-3 relative overflow-hidden group">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg"><Sparkles size={16} className="text-white" /></div>
                  <div>
                    <h4 className="text-[10px] font-black uppercase italic text-indigo-400">Your Broadcast</h4>
                    <p className="text-[7px] font-black text-zinc-500 uppercase tracking-widest mt-1">Status: Discoverable</p>
                  </div>
                </div>
                <button onClick={handleDeleteMyPost} className="p-2 bg-zinc-900 rounded-xl text-rose-500 border border-zinc-800 hover:bg-rose-500 hover:text-white transition-all">
                  <Trash2 size={14} />
                </button>
              </div>
              <p className="text-[10px] text-zinc-300 font-bold italic bg-black/40 p-3 rounded-2xl">"{myPost.bio}"</p>
              <div className="flex gap-2">
                <span className="text-[7px] font-black uppercase px-2 py-1 bg-indigo-600/20 rounded-lg text-indigo-400 border border-indigo-500/10">{myPost.goal}</span>
                <span className="text-[7px] font-black uppercase px-2 py-1 bg-indigo-600/20 rounded-lg text-indigo-400 border border-indigo-500/10">{myPost.preferredTime}</span>
              </div>
            </div>
          )}

          <div className="space-y-4 px-1">
            {filteredFeed.map((p) => {
              const isRequested = sentRequests.some(r => r.receiverEmail === p.id || r.partnerId === p.id);
              const isPartner = partners.some(pt => pt.partnerEmail === p.id || pt.partnerId === p.id);
              return (
                <div key={p.id} className="bg-zinc-900 p-5 rounded-[2.5rem] border border-zinc-800 space-y-4 shadow-xl transition-all hover:border-indigo-500/30 group">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-zinc-800 rounded-2xl overflow-hidden border-2 border-zinc-800">
                        <img src={getAvatarUrl(p.img, p.id)} className="w-full h-full object-cover grayscale opacity-40 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700" alt={p.name} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-lg italic uppercase tracking-tighter leading-none">{p.name}</h4>
                          <span className="text-[7px] font-black text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded uppercase">{p.gender}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[8px] font-black text-zinc-500 uppercase tracking-widest mt-2">
                          <span className="flex items-center gap-0.5 bg-zinc-800 px-2 py-0.5 rounded-full"><MapPin size={8} className="text-indigo-500" /> {p.distance}</span>
                        </div>
                      </div>
                    </div>
                    {!isPartner && (
                      <button
                        onClick={() => handleSendRequest(p)}
                        disabled={isRequested}
                        className={`p-3.5 rounded-2xl transition-all active:scale-95 shadow-xl ${isRequested ? 'bg-zinc-800 text-emerald-500' : 'bg-indigo-600 text-white'}`}
                      >
                        {isRequested ? <Check size={20} /> : <UserPlus size={20} />}
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-400 italic font-medium bg-black/20 p-3 rounded-2xl border border-zinc-800/40">"{p.bio}"</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'REQUESTS' && (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-500 px-1">
          <div className="flex bg-zinc-900 p-1.5 rounded-2xl border border-zinc-800 shadow-inner mx-1">
            <button
              onClick={() => setRequestSubTab('RECEIVED')}
              className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${requestSubTab === 'RECEIVED' ? 'bg-zinc-800 text-indigo-500' : 'text-zinc-600'}`}
            >
              Received ({incomingRequests.length})
            </button>
            <button
              onClick={() => setRequestSubTab('SENT')}
              className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${requestSubTab === 'SENT' ? 'bg-zinc-800 text-indigo-500' : 'text-zinc-600'}`}
            >
              Sent ({sentRequests.length})
            </button>
          </div>

          {requestSubTab === 'RECEIVED' ? (
            <div className="space-y-4">
              {incomingRequests.length === 0 ? (
                <div className="py-20 text-center text-[10px] font-black uppercase text-zinc-700">No pending syncs</div>
              ) : (
                incomingRequests.map(req => (
                  <div key={req.id} className="bg-zinc-900 p-5 rounded-[2.2rem] border border-zinc-800 space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-zinc-800 rounded-2xl overflow-hidden">
                        <img src={getAvatarUrl(req.senderImg || req.img, 'u1')} className="w-full h-full object-cover" alt="partner" />
                      </div>
                      <div>
                        <h4 className="font-black text-base uppercase italic tracking-tighter leading-tight">{req.senderName || req.name || req.partnerName}</h4>
                        <p className="text-[8px] font-black text-indigo-500 uppercase tracking-widest mt-1">Goal: {req.goal}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAcceptRequest(req)}
                        className="flex-1 bg-indigo-600 text-white py-3 rounded-2xl text-[9px] font-black uppercase flex items-center justify-center gap-2 active:scale-95 transition-all"
                      >
                        <Check size={14} /> Accept Sync
                      </button>
                      <button
                        onClick={() => handleDeclineRequest(req.id)}
                        className="px-4 bg-zinc-800 text-rose-500 py-3 rounded-2xl active:scale-95"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {sentRequests.map((req, i) => (
                <div key={i} className="bg-zinc-900 p-5 rounded-[2.2rem] border border-zinc-800 flex justify-between items-center group">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-zinc-800 rounded-2xl overflow-hidden">
                      <img src={getAvatarUrl(req.receiverImg || req.img, req.partnerId || 'u1')} className="w-full h-full object-cover grayscale opacity-80" alt="partner" />
                    </div>
                    <div>
                      <h4 className="font-black text-base uppercase italic tracking-tighter leading-tight">{req.receiverName || req.partnerName}</h4>
                      <p className="text-[8px] font-black text-amber-500 uppercase tracking-widest mt-1">Awaiting Response</p>
                    </div>
                  </div>
                  <button onClick={() => handleDeleteSentRequest(req.id)} className="bg-rose-500/10 p-3 rounded-xl text-rose-500 hover:bg-rose-500 hover:text-white transition-all">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'SQUAD' && (
        <div className="space-y-6 animate-in slide-in-from-left-4 duration-500 px-1">
          <div className="bg-indigo-600/5 p-4 rounded-3xl border border-indigo-500/10 flex items-center gap-3">
            <Info size={16} className="text-indigo-500 shrink-0" />
            <p className="text-[8px] font-bold text-zinc-500 leading-relaxed uppercase">These users have accepted your sync protocol. You can now coordinate training sessions.</p>
          </div>

          {partners.length === 0 ? (
            <div className="py-20 text-center space-y-4">
              <div className="w-16 h-16 bg-zinc-900 rounded-full border border-zinc-800 flex items-center justify-center mx-auto opacity-30">
                <Users size={32} className="text-zinc-500" />
              </div>
              <p className="text-[10px] font-black text-zinc-700 uppercase tracking-widest">Your squad is empty. Start discovering.</p>
              <button onClick={() => setActiveTabLocal('DISCOVER')} className="bg-indigo-600/10 text-indigo-500 px-4 py-2 rounded-xl text-[9px] font-black uppercase border border-indigo-500/20">Find Partners</button>
            </div>
          ) : (
            <div className="space-y-4">
              {partners.map((pt) => (
                <div key={pt.id} className="bg-zinc-900 p-6 rounded-[2.5rem] border border-zinc-800 space-y-4 relative overflow-hidden group transition-all hover:border-indigo-500/30 shadow-2xl">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform"><Check size={60} className="text-indigo-500" /></div>
                  <div className="flex justify-between items-center relative z-10">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-zinc-800 rounded-2xl overflow-hidden border-2 border-indigo-500/30">
                        <img src={getAvatarUrl(pt.partnerImg || pt.img, pt.partnerEmail || pt.partnerId || pt.id || 'u1')} className="w-full h-full object-cover" alt={pt.partnerName || pt.name} />
                      </div>
                      <div>
                        <h4 className="font-black text-xl italic uppercase tracking-tighter leading-none">{pt.partnerName || pt.name}</h4>
                        <span className="text-[8px] font-black text-indigo-400 bg-indigo-400/10 px-2 py-0.5 rounded-full mt-2 inline-block">Handshake Protocol Active</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 relative z-10">
                    <div className="bg-black/30 p-4 rounded-2xl border border-zinc-800 group-hover:border-zinc-700 transition-colors">
                      <span className="text-[7px] font-black uppercase text-zinc-600 block mb-1">Focus</span>
                      <span className="text-[10px] font-black text-white italic">{pt.goal}</span>
                    </div>
                    <div className="bg-black/30 p-4 rounded-2xl border border-zinc-800 group-hover:border-zinc-700 transition-colors">
                      <span className="text-[7px] font-black uppercase text-zinc-600 block mb-1">Status</span>
                      <span className="text-[10px] font-black text-emerald-500 italic">Sync Ready</span>
                    </div>
                  </div>

                  {/* WHATSAPP ACTION - MORE COMPACT */}
                  <div className="relative z-10 pt-1">
                    <button
                      onClick={() => openWhatsApp(pt.whatsapp)}
                      className="w-full bg-emerald-600/10 border border-emerald-500/20 text-emerald-500 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all hover:bg-emerald-600 hover:text-white group/wa"
                    >
                      <MessageCircle size={16} className="group-hover/wa:animate-pulse" /> Message on WhatsApp
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Broadcast Modal */}
      {showPostModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-[3rem] p-8 space-y-8 animate-in slide-in-from-bottom-10 duration-500 shadow-2xl relative overflow-hidden">
            <div className="flex justify-between items-center">
              <h3 className="text-2xl font-black italic uppercase tracking-tighter leading-none">Global Broadcast</h3>
              <button onClick={() => setShowPostModal(false)} className="bg-zinc-800 p-2 rounded-full text-zinc-500"><X size={20} /></button>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[8px] font-black uppercase text-zinc-500 tracking-widest">Protocol Goal</label>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {Object.values(FitnessGoal).map(g => (
                    <button
                      key={g}
                      onClick={() => setPostGoal(g)}
                      className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase border shrink-0 ${postGoal === g ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-500'}`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[8px] font-black uppercase text-zinc-500 tracking-widest">Time Window</label>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {['Morning', 'Afternoon', 'Evening', 'Night'].map(t => (
                    <button
                      key={t}
                      onClick={() => setPostTime(t as any)}
                      className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase border shrink-0 ${postTime === t ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-500'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[8px] font-black uppercase text-zinc-500 tracking-widest">Your Requirements</label>
                <textarea
                  value={postBio}
                  onChange={(e) => setPostBio(e.target.value)}
                  placeholder="e.g. Training for hypertrophy. Need a spotter for heavy bench days."
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl p-4 text-xs font-bold text-white outline-none focus:border-indigo-500 h-24 resize-none"
                />
              </div>

              <button
                onClick={handleCreatePost}
                disabled={isSubmittingPost}
                className="w-full bg-white text-black py-5 rounded-[2.5rem] font-black text-xs italic tracking-[0.2em] shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all uppercase disabled:opacity-30"
              >
                {isSubmittingPost ? <Loader2 className="animate-spin" size={18} /> : <Zap size={18} />} BROADCAST LIVE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
