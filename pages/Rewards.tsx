
import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { ApiService } from '../services/api';
import { Gift, Video, Award, Trophy, ChevronRight, Share2, Upload, Star, Zap, Percent, ShieldCheck, Instagram, X, Link as LinkIcon, Loader2, History, Check, ExternalLink, Clock, ListFilter, Sparkles, Copy, Tag, Coins, User, Users, TrendingUp, CheckCircle2, Edit3, Save, AlertCircle, IndianRupee, ArrowRight, RefreshCw, Landmark, ArrowUpRight, AlertTriangle, Package } from 'lucide-react';

interface Props {
  profile: UserProfile;
  setProfile: (profile: UserProfile) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  setActiveTab: (tab: string) => void;
}

export const Rewards: React.FC<Props> = ({ profile, setProfile, showToast, setActiveTab }) => {
  const VIDEO_TARGET = 100;
  const progressPercent = Math.min((profile.videoUploads / VIDEO_TARGET) * 100, 100);

  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [reelLink, setReelLink] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [videoHistory, setVideoHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [linkError, setLinkError] = useState('');

  // Creator & Referral State
  const [coupons, setCoupons] = useState<any[]>([]);
  const [personalMappings, setPersonalMappings] = useState<any[]>([]);
  const [referralRefunds, setReferralRefunds] = useState<any[]>([]);
  const [isClaimingRefund, setIsClaimingRefund] = useState(false);
  const [referralLogs, setReferralLogs] = useState<any[]>([]);
  const [creatorEarnings, setCreatorEarnings] = useState<any[]>([]);
  const [redemptionHistory, setRedemptionHistory] = useState<any[]>([]);
  const [referralDiscount, setReferralDiscount] = useState(7000);
  const [isRefreshingCoupons, setIsRefreshingCoupons] = useState(false);

  // Hub View State
  const [creatorHubView, setCreatorHubView] = useState<'CONVERSIONS' | 'TRANSACTIONS'>('CONVERSIONS');

  // Modal UI State
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [activeRenameCoupon, setActiveRenameCoupon] = useState<any>(null);
  const [vanityInput, setVanityInput] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameError, setRenameError] = useState('');

  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [redeemAmount, setRedeemAmount] = useState('');
  const [upiId, setUpiId] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);

  // Trophy Delivery State
  const [deliveryDetails, setDeliveryDetails] = useState(
    profile.trophyDelivery || { fullName: '', phone: '', address: '', landmark: '', pincode: '' }
  );
  const [isSavingDelivery, setIsSavingDelivery] = useState(false);

  useEffect(() => {
    loadData();
  }, [profile.videoUploads, profile.id]);

  const loadData = async () => {
    loadVideoHistory();
    const config = await ApiService.getPricingConfig();
    setReferralDiscount(config.REFERRAL_DISCOUNT);

    if (profile.id) {
      const refs = await ApiService.getReferralSuccessLog(profile.id);
      setReferralLogs(refs);

      const earnings = await ApiService.getCreatorEarningsLog(profile.id);
      setCreatorEarnings(earnings);

      const redemptions = await ApiService.getRedemptionHistory(profile.id);
      setRedemptionHistory(redemptions);

      const mappings = await ApiService.getCreatorPersonalMappings(profile.id);
      setPersonalMappings(mappings);

      const refunds = await ApiService.getReferralRefunds(profile.id);
      setReferralRefunds(refunds);
    }

    if (profile.videoUploads > 0) {
      loadCoupons();
    }
  };

  const handleRefreshHub = async () => {
    setIsRefreshingCoupons(true);
    try {
      await loadData();
    } finally {
      setIsRefreshingCoupons(false);
    }
  };

  const loadVideoHistory = async () => {
    setIsLoadingHistory(true);
    try {
      if (profile.id) {
        const links = await ApiService.getVideoLinks(profile.id, 100);
        setVideoHistory(links);
      }
    } catch (error) {
      console.error("Failed to load history:", error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const loadCoupons = async () => {
    setIsRefreshingCoupons(true);
    try {
      const list = await ApiService.getCoupons();
      setCoupons(list.filter(c => c.active).reverse());
      if (profile.id) {
        const mappings = await ApiService.getCreatorPersonalMappings(profile.id);
        setPersonalMappings(mappings);
      }
    } catch (error) {
      console.error("Failed to fetch coupons:", error);
      showToast("Sync Error: Failed to fetch protocols", "error");
    } finally {
      setIsRefreshingCoupons(false);
    }
  };

  const totalCreatorEarnings = creatorEarnings.reduce((acc, curr) => acc + (curr.commissionEarned || 0), 0);
  const totalRedeemed = redemptionHistory.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const currentBalance = totalCreatorEarnings - totalRedeemed;

  const handleSubmitLink = async () => {
    setLinkError('');
    const trimmedLink = reelLink.trim();
    if (!trimmedLink.includes('instagram.com')) {
      const err = "Please provide a valid Instagram link";
      setLinkError(err);
      showToast(err, "error");
      return;
    }
    if (!profile.id) {
      const err = "User profile not found";
      setLinkError(err);
      showToast(err, "error");
      return;
    }
    setIsSubmitting(true);
    try {
      const newCount = await ApiService.submitVideoLink(trimmedLink, profile.id);
      setProfile({ ...profile, videoUploads: newCount });
      setReelLink('');
      setLinkError('');
      setShowLinkModal(false);
      showToast("Protocol Link Synced!", "success");
      loadVideoHistory();
    } catch (e: any) {
      const err = e.message || "Submission failed";
      setLinkError(err);
      showToast(err, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const [isApplyingTrophy, setIsApplyingTrophy] = useState(false);

  const handleApplyTrophy = async () => {
    if (!profile.id) return;
    setIsApplyingTrophy(true);
    try {
      await ApiService.applyForReelsTrophy(profile.id);
      setProfile({ ...profile, trophyStatus: 'applied' });
      showToast("Trophy Application Submitted", "success");
    } catch (e: any) {
      showToast("Failed to apply for trophy", "error");
    } finally {
      setIsApplyingTrophy(false);
    }
  };

  const handleCopyCode = (coupon: any) => {
    const mapping = personalMappings.find(m => m.baseCouponId === coupon.id);
    const codeToCopy = mapping ? mapping.customCode : `${coupon.code}-${profile.id || 'AGENT'}`;
    navigator.clipboard.writeText(codeToCopy);
    showToast(`Code Copied: ${codeToCopy}`, "success");
  };

  const openRenameModal = (coupon: any) => {
    const mapping = personalMappings.find(m => m.baseCouponId === coupon.id);
    setActiveRenameCoupon(coupon);
    setVanityInput(mapping ? mapping.customCode : `${coupon.code}-${profile.id || '1'}`);
    setRenameError('');
    setShowRenameModal(true);
  };

  const handleRenameSubmit = async () => {
    if (!vanityInput.trim() || !profile.id) return;
    setIsRenaming(true);
    setRenameError('');
    try {
      await ApiService.updateCreatorVanityCode(profile.id, activeRenameCoupon.id, vanityInput);
      await loadData();
      setShowRenameModal(false);
      showToast("Vanity Rebrand Successful", "success");
    } catch (e: any) {
      setRenameError(e.message || "Rebrand failed");
    } finally {
      setIsRenaming(false);
    }
  };

  const handleRedeemSubmit = async () => {
    const amt = parseFloat(redeemAmount);
    if (isNaN(amt) || amt < 500) {
      showToast("Minimum redemption is ₹500", "error");
      return;
    }
    if (amt > currentBalance) {
      showToast("Insufficient Balance", "error");
      return;
    }
    if (!upiId.trim()) {
      showToast("Please enter a valid UPI ID", "error");
      return;
    }

    setIsRedeeming(true);
    try {
      if (profile.id) {
        await ApiService.requestRedemption(profile.id, amt, upiId.trim());
        showToast("Redemption request logged for verification.", "success");
        setShowRedeemModal(false);
        setRedeemAmount('');
        setUpiId('');
        loadData();
      }
    } catch (e: any) {
      showToast(e.message || "Request failed", "error");
    } finally {
      setIsRedeeming(false);
    }
  };

  const handleCopyReferral = () => {
    const code = `TRFX-${profile.id || 'ALPHA'}`;
    navigator.clipboard.writeText(code);
    showToast(`Referral Code Copied: ${code}`, "success");
  };

  const handleSaveDelivery = async () => {
    if (!profile.id) return;
    if (!deliveryDetails.fullName || !deliveryDetails.phone || !deliveryDetails.address || !deliveryDetails.pincode) {
      showToast("Please complete all required fields", "error");
      return;
    }

    setIsSavingDelivery(true);
    try {
      await ApiService.saveTrophyDeliveryDetails(profile.id, deliveryDetails);
      setProfile({ ...profile, trophyDelivery: deliveryDetails });
      showToast("Delivery details secure. Dispatch pending.", "success");
    } catch (e: any) {
      showToast(e.message || "Failed to save details", "error");
    } finally {
      setIsSavingDelivery(false);
    }
  };

  const handleClaimRefund = async (milestone: number) => {
    if (!profile.id) return;
    setIsClaimingRefund(true);
    try {
      await ApiService.requestReferralRefund(profile.id, milestone);
      const updated = await ApiService.getReferralRefunds(profile.id);
      setReferralRefunds(updated);
      showToast(`Refund request for ${milestone} referrals submitted!`, "success");
    } catch (e: any) {
      showToast(e.message || "Failed to claim refund", "error");
    } finally {
      setIsClaimingRefund(false);
    }
  };

  const totalReferrals = referralLogs.length;
  const status = (() => {
    if (profile.trophyStatus === 'shipped') return { label: 'DISPATCHED', color: 'text-amber-400', bg: 'bg-amber-400/10' };
    if (profile.trophyStatus === 'awarded') return { label: 'AWARDED', color: 'text-emerald-400', bg: 'bg-emerald-400/10' };
    if (profile.trophyStatus === 'rejected') return { label: 'REJECTED', color: 'text-rose-400', bg: 'bg-rose-500/10' };
    if (profile.trophyStatus === 'applied') return { label: 'PENDING REVIEW', color: 'text-amber-400', bg: 'bg-amber-400/10' };
    return profile.videoUploads >= VIDEO_TARGET
      ? { label: 'TARGET REACHED', color: 'text-amber-400', bg: 'bg-amber-400/10' }
      : { label: 'IN PROGRESS', color: 'text-emerald-400', bg: 'bg-emerald-400/10' };
  })();

  return (
    <div className="space-y-8 pb-32 animate-in fade-in duration-500 px-1 max-w-md mx-auto relative w-full">
      <header className="space-y-1 mt-4">
        <span className="text-amber-500 text-[10px] font-black uppercase tracking-[0.3em]">Achievements Hub</span>
        <h2 className="text-4xl font-black italic uppercase tracking-tighter text-white leading-none">Rewards</h2>
      </header>

      {/* REFERRAL PROTOCOL */}
      <section className="bg-[#121212] border border-[#222] p-6 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform duration-700 -rotate-12">
          <Zap size={140} className="text-indigo-500" />
        </div>
        <div className="relative z-10 space-y-8">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="bg-[#1A1A1A] p-3 rounded-2xl text-indigo-500 shadow-xl border border-[#333]">
                <Zap size={24} fill="currentColor" />
              </div>
              <div>
                <h3 className="font-black text-xl italic uppercase tracking-tight text-white leading-none">Referral Protocol</h3>
                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mt-1">Protocol: Network Expansion</p>
              </div>
            </div>
            <div className="bg-[#1A1A1A] px-4 py-2 rounded-xl border border-[#333] flex flex-col items-center">
              <span className="text-[14px] font-black text-white leading-none">{totalReferrals}</span>
              <span className="text-[7px] font-black text-indigo-500 uppercase mt-1">Total Refs</span>
            </div>
          </div>
          <div className="space-y-3">
            {[
              { count: 3, reward: '25% Refund', color: 'text-indigo-400' },
              { count: 5, reward: '45% Refund', color: 'text-indigo-400' },
              { count: 10, reward: '100% Refund + Free Membership', color: 'text-indigo-500' },
            ].map((slab, i) => {
              const isAchieved = totalReferrals >= slab.count;
              const refundRequest = referralRefunds.find(r => r.milestone === slab.count);

              const getStatusText = () => {
                if (refundRequest?.status === 'completed') return 'Claimed';
                if (refundRequest?.status === 'pending') return 'Pending Approval';
                if (refundRequest?.status === 'rejected') return 'Claim'; // Allow re-claim if rejected
                return 'Claim';
              };

              const isPending = refundRequest?.status === 'pending';
              const isCompleted = refundRequest?.status === 'completed';

              return (
                <div key={i} className={`flex items-center justify-between p-5 rounded-2xl border transition-all duration-500 ${isAchieved ? 'bg-indigo-600/10 border-indigo-500/40 shadow-lg' : 'bg-black/20 border-[#222] opacity-60'}`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm border-2 ${isAchieved ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-[#1A1A1A] border-[#333] text-zinc-600'}`}>
                      {isAchieved ? <Check size={18} strokeWidth={4} /> : slab.count}
                    </div>
                    <div>
                      <h5 className={`text-[12px] font-black uppercase italic tracking-tight ${isAchieved ? 'text-white' : 'text-zinc-500'}`}>{slab.count} Referrals</h5>
                      {refundRequest && (
                        <p className={`text-[6px] font-bold uppercase tracking-widest mt-0.5 ${isCompleted ? 'text-emerald-500' : isPending ? 'text-amber-500' : 'text-rose-500'}`}>
                          Status: {refundRequest.status}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-black uppercase italic ${isAchieved ? slab.color : 'text-zinc-700'}`}>{slab.reward}</span>
                    {isAchieved && (
                      <button
                        onClick={() => !isPending && !isCompleted && handleClaimRefund(slab.count)}
                        disabled={isClaimingRefund || isPending || isCompleted}
                        className={`px-3 py-1.5 rounded-lg font-black text-[8px] uppercase active:scale-95 transition-all ${isCompleted ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/20' :
                            isPending ? 'bg-amber-500/20 text-amber-500 border border-amber-500/20 animate-pulse' :
                              'bg-white text-black hover:bg-indigo-50'
                          }`}
                      >
                        {isClaimingRefund ? <Loader2 className="animate-spin" size={10} /> : getStatusText()}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="space-y-3 pt-2">
            {!profile.isPassActive ? (
              <button
                onClick={() => setActiveTab('pricing')}
                className="w-full bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 active:scale-95 transition-all p-5 rounded-2xl flex flex-col items-center justify-center gap-2 group"
              >
                <div className="bg-rose-500/20 p-2 rounded-xl text-rose-500 group-hover:scale-110 transition-transform">
                  <Zap size={20} />
                </div>
                <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest leading-relaxed">
                  Purchase Transformix Pass to activate your referral code
                </p>
                <p className="text-[8px] font-black italic text-rose-400/70 uppercase">Tap to Power Up <ArrowRight size={10} className="inline" /></p>
              </button>
            ) : (
              <>
                <div className="bg-black/40 border border-[#222] p-4 rounded-2xl flex items-center justify-between group/code hover:border-indigo-500/30 transition-all">
                  <div className="flex flex-col">
                    <span className="text-[7px] font-black text-zinc-600 uppercase tracking-widest mb-1">Your Referral Code</span>
                    <span className="text-xl font-black italic text-white tracking-tighter uppercase">TRFX-{profile.id || 'ALPHA'}</span>
                  </div>
                  <button onClick={handleCopyReferral} className="bg-[#1A1A1A] border border-[#333] p-3 rounded-xl text-indigo-500 hover:text-white hover:bg-indigo-600 transition-all active:scale-90"><Copy size={18} /></button>
                </div>
                <button
                  onClick={() => {
                    const url = `https://transformix.ai/join/TRFX-${profile.id || 'ALPHA'}`;
                    navigator.clipboard.writeText(url);
                    showToast("Referral link copied", "success");
                  }}
                  className="w-full bg-white text-black py-5 rounded-[2rem] font-black text-[11px] italic tracking-[0.2em] flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all uppercase"
                >
                  <Share2 size={16} /> Copy Referral Link
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* CREATOR HUB */}
      {profile.videoUploads > 0 && (
        <section className="bg-indigo-600 p-6 rounded-[2.5rem] shadow-[0_20px_50px_rgba(79,70,229,0.3)] relative overflow-hidden group border border-white/10">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-700">
            <Star size={100} fill="currentColor" />
          </div>

          <div className="relative z-10 space-y-6">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2.5 rounded-2xl text-white shadow-lg"><Zap size={20} fill="currentColor" /></div>
                <div>
                  <h3 className="font-black text-lg italic uppercase tracking-tight text-white leading-tight">Creator Hub</h3>
                  <p className="text-[8px] font-black text-indigo-100 uppercase tracking-widest">Partner Performance</p>
                </div>
              </div>
              <div className="bg-white/20 px-3 py-1 rounded-full border border-white/20 backdrop-blur-md">
                <span className="text-[8px] font-black text-white uppercase tracking-widest flex items-center gap-1.5">
                  <ShieldCheck size={10} /> Verified Creator
                </span>
              </div>
            </div>

            {/* Earnings Stats with Redeem */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/10 backdrop-blur-md p-4 rounded-3xl border border-white/10 relative overflow-hidden group/wallet">
                <span className="text-[7px] font-black text-indigo-100 uppercase tracking-widest block mb-1">Balance Available</span>
                <div className="flex flex-col items-start gap-1">
                  <span className="text-2xl font-black italic text-white leading-none">₹{currentBalance.toLocaleString()}</span>
                  {currentBalance >= 500 && (
                    <button
                      onClick={() => { setRedeemAmount(currentBalance.toString()); setShowRedeemModal(true); }}
                      className="mt-2 flex items-center gap-1 bg-white text-indigo-600 px-2 py-1 rounded-lg text-[7px] font-black uppercase shadow-lg active:scale-95 transition-all"
                    >
                      <ArrowUpRight size={10} /> Redeem
                    </button>
                  )}
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-md p-4 rounded-3xl border border-white/10">
                <span className="text-[7px] font-black text-indigo-100 uppercase tracking-widest block mb-1">Total Conversions</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black italic text-white leading-none">{creatorEarnings.length}</span>
                  <span className="text-[7px] font-bold text-indigo-100 uppercase">Sales</span>
                </div>
              </div>
            </div>

            {/* Protocols Scroll */}
            <div className="space-y-3">
              <div className="flex justify-between items-center px-1">
                <p className="text-[9px] font-black text-indigo-100 uppercase tracking-[0.2em]">Promotion Protocols</p>
                <button onClick={handleRefreshHub} disabled={isRefreshingCoupons} className="p-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-all active:rotate-180 duration-500 disabled:opacity-30">
                  <RefreshCw size={14} className={isRefreshingCoupons ? "animate-spin" : ""} />
                </button>
              </div>

              {coupons.length === 0 ? (
                <div className="bg-black/20 p-8 rounded-[2rem] border border-white/10 text-center space-y-2">
                  <div className="bg-white/5 w-10 h-10 rounded-full flex items-center justify-center mx-auto"><Tag size={16} className="text-white/30" /></div>
                  <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest italic">Registry empty. Contact Admin.</p>
                </div>
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide px-1">
                  {coupons.map((coupon) => {
                    const mapping = personalMappings.find(m => m.baseCouponId === coupon.id);
                    const displayCode = mapping ? mapping.customCode : `${coupon.code}-${profile.id || 'X'}`;
                    return (
                      <div key={coupon.id} className="min-w-[250px] bg-white p-5 rounded-3xl space-y-4 shadow-xl border border-indigo-100/50 flex flex-col justify-between animate-in fade-in zoom-in-95">
                        <div className="flex justify-between items-start">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="bg-indigo-600/10 text-indigo-600 px-2 py-0.5 rounded-lg text-[7px] font-black uppercase tracking-widest">Personal ID</div>
                              <button onClick={() => openRenameModal(coupon)} className="p-1 hover:bg-zinc-100 rounded text-zinc-400 hover:text-indigo-600 transition-colors"><Edit3 size={10} /></button>
                            </div>
                            <h4 className="text-xl font-black italic text-zinc-900 leading-none truncate max-w-[170px] uppercase">{displayCode}</h4>
                          </div>
                          <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600"><Tag size={16} /></div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-emerald-50 flex items-center justify-center"><Check size={8} className="text-emerald-600" strokeWidth={4} /></div><span className="text-[10px] font-black text-zinc-700 uppercase">₹{coupon.discountAmount} DISCOUNT</span></div>
                          {coupon.creatorCommission && (<div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-amber-50 flex items-center justify-center"><Coins size={8} className="text-amber-600" strokeWidth={4} /></div><span className="text-[10px] font-black text-amber-600 uppercase italic">EARN ₹{coupon.creatorCommission} / SALE</span></div>)}
                          {coupon.giftHamper && (<div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-indigo-50 flex items-center justify-center"><Gift size={8} className="text-indigo-600" strokeWidth={4} /></div><span className="text-[10px] font-black text-indigo-600 uppercase italic">FREE {coupon.giftHamper}</span></div>)}
                        </div>
                        <button onClick={() => handleCopyCode(coupon)} className="w-full bg-zinc-900 text-white py-3 rounded-xl font-black text-[9px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg hover:bg-black mt-2"><Copy size={12} /> Copy My Code</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Logs: Conversions vs Redemptions */}
            <div className="space-y-3 px-1">
              <div className="flex items-center bg-black/20 p-1 rounded-xl border border-white/10 shadow-inner">
                <button
                  onClick={() => setCreatorHubView('CONVERSIONS')}
                  className={`flex-1 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${creatorHubView === 'CONVERSIONS' ? 'bg-white text-indigo-600 shadow-md' : 'text-white/50'}`}
                >
                  Conversions ({creatorEarnings.length})
                </button>
                <button
                  onClick={() => setCreatorHubView('TRANSACTIONS')}
                  className={`flex-1 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${creatorHubView === 'TRANSACTIONS' ? 'bg-white text-indigo-600 shadow-md' : 'text-white/50'}`}
                >
                  Payouts ({redemptionHistory.length})
                </button>
              </div>

              <div className="max-h-52 overflow-y-auto scrollbar-hide space-y-2">
                {creatorHubView === 'CONVERSIONS' ? (
                  creatorEarnings.length === 0 ? (
                    <div className="py-8 text-center text-[8px] font-black text-white/30 uppercase italic tracking-widest">No conversions logged</div>
                  ) : (
                    creatorEarnings.map((earn, i) => (
                      <div key={i} className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10 flex justify-between items-center animate-in slide-in-from-bottom-1">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-white/20 rounded-lg text-white"><User size={12} /></div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-[9px] font-black text-white uppercase italic">{earn.buyerName}</p>
                              <span className="bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded text-[6px] font-black uppercase border border-indigo-500/10">{earn.codeUsed}</span>
                            </div>
                            <p className="text-[7px] font-bold text-indigo-200 uppercase tracking-widest">{new Date(earn.timestamp).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-black text-emerald-400">+₹{earn.commissionEarned}</span>
                      </div>
                    ))
                  )
                ) : (
                  redemptionHistory.length === 0 ? (
                    <div className="py-8 text-center text-[8px] font-black text-white/30 uppercase italic tracking-widest">No payout history</div>
                  ) : (
                    redemptionHistory.map((redeem, i) => (
                      <div key={i} className="bg-black/20 p-4 rounded-2xl border border-white/10 flex justify-between items-center group">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${redeem.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                            {redeem.status === 'completed' ? <CheckCircle2 size={14} /> : <Clock size={14} />}
                          </div>
                          <div>
                            <p className="text-[9px] font-black text-white uppercase tracking-widest">
                              {redeem.status === 'completed' ? 'Redemption Done' : 'Redemption Request'}
                            </p>
                            <p className="text-[7px] font-bold text-zinc-500 uppercase">{new Date(redeem.timestamp).toLocaleDateString()} • {redeem.status}</p>
                          </div>
                        </div>
                        <span className="text-[11px] font-black text-rose-400">-₹{redeem.amount}</span>
                      </div>
                    ))
                  )
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* CONTENT CHALLENGE */}
      <section className="bg-zinc-900 p-6 rounded-[2.5rem] border border-zinc-800 shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform duration-700">
          <Trophy size={120} className="text-emerald-500" />
        </div>
        <div className="relative z-10 space-y-6">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-600/20 p-2.5 rounded-2xl text-emerald-500 shadow-lg"><Video size={20} /></div>
              <div>
                <h3 className="font-black text-lg italic uppercase tracking-tight text-white leading-tight">Content Challenge</h3>
                <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5">Protocol: 100 Training Reels</p>
              </div>
            </div>
            <div className="flex gap-2">

              <button onClick={() => setShowHistoryModal(true)} className="bg-zinc-800 p-3 rounded-2xl text-zinc-400 hover:text-white border border-zinc-700 active:scale-95 transition-all flex items-center gap-2">
                <History size={16} />
                <span className="text-[8px] font-black uppercase tracking-widest">{videoHistory.length}</span>
              </button>
            </div>
          </div>
          <div className="bg-black/40 p-5 rounded-[2.2rem] border border-zinc-800/50 space-y-5">
            <div className="flex justify-between items-end">
              <div>
                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-1">Global Progress</span>
                <span className="text-2xl font-black italic text-emerald-500 tracking-tighter">{profile.videoUploads} <span className="text-zinc-700">/ {VIDEO_TARGET}</span></span>
              </div>
              <div className={`${status.bg} ${status.color} px-3 py-1.5 rounded-xl text-[8px] font-black tracking-widest border border-current/10`}>{status.label}</div>
            </div>
            <div className="w-full h-3 bg-zinc-800/50 rounded-full overflow-hidden p-0.5 border border-zinc-800">
              <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000 shadow-[0_0_15px_rgba(16,185,129,0.5)]" style={{ width: `${progressPercent}%` }}></div>
            </div>
          </div>
          {/* Trophy Status UI */}
          <div className="mb-4">
            {(!profile.trophyStatus || profile.trophyStatus === 'none' || profile.trophyStatus === 'rejected') && (
              <div className="space-y-3">
                {profile.trophyStatus === 'rejected' && profile.trophyRejectionReason && (
                  <div className="bg-rose-500/10 border border-rose-500/30 p-4 rounded-2xl flex items-start gap-4 animate-in zoom-in-95 shadow-xl">
                    <div className="bg-rose-500/20 p-2 rounded-xl text-rose-500 shrink-0"><AlertTriangle size={16} /></div>
                    <div>
                      <h4 className="text-[10px] font-black text-rose-500 uppercase tracking-[0.2em]">Application Rejected</h4>
                      <p className="text-[9px] font-bold text-zinc-400 mt-1 italic leading-relaxed">Reason: {profile.trophyRejectionReason}</p>
                      <p className="text-[8px] font-black text-rose-500/80 uppercase tracking-widest mt-2">You may re-apply once resolved.</p>
                    </div>
                  </div>
                )}
                <button
                  onClick={handleApplyTrophy}
                  disabled={isApplyingTrophy || profile.videoUploads < VIDEO_TARGET}
                  className={`w-full py-4 rounded-2xl font-black text-xs italic tracking-[0.2em] flex items-center justify-center gap-3 shadow-xl transition-all uppercase ${profile.videoUploads >= VIDEO_TARGET
                    ? 'bg-amber-500 hover:bg-amber-400 text-black active:scale-95 disabled:opacity-50'
                    : 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700'
                    }`}
                >
                  {isApplyingTrophy ? <Loader2 className="animate-spin" size={20} /> : <Trophy size={20} />}
                  APPLY FOR 100 REELS TROPHY
                </button>
              </div>
            )}

            {profile.trophyStatus === 'applied' && (
              <div className="bg-amber-500/10 border border-amber-500/30 p-5 rounded-2xl flex items-center gap-4 animate-in zoom-in-95 shadow-xl">
                <div className="bg-amber-500 p-2.5 rounded-xl text-black shadow-lg shadow-amber-500/20"><Clock size={20} /></div>
                <div>
                  <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em]">Application Under Review</h4>
                  <p className="text-[9px] font-bold text-zinc-400 mt-1 italic leading-relaxed">Verifying 100 content instances. Neural Core will dispatch rewards post-sync.</p>
                </div>
              </div>
            )}

            {profile.trophyStatus === 'shipped' && (
              <div className="bg-amber-500/10 border border-amber-500/30 p-5 rounded-2xl flex items-center gap-4 animate-in zoom-in-95 shadow-xl shadow-amber-500/5">
                <div className="bg-amber-500 p-2.5 rounded-xl text-black shadow-lg shadow-amber-500/20"><Package size={20} /></div>
                <div>
                  <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em]">Trophy Dispatched</h4>
                  <p className="text-[9px] font-bold text-zinc-400 mt-1 italic leading-relaxed">Your reward has been shipped. Secure landing imminent.</p>
                </div>
              </div>
            )}

            {profile.trophyStatus === 'awarded' && (
              <div className="space-y-4">
                <div className="bg-emerald-500/10 border border-emerald-500/30 p-5 rounded-2xl flex items-center gap-4 animate-in zoom-in-95 shadow-xl">
                  <div className="bg-emerald-500 p-2.5 rounded-xl text-black shadow-lg shadow-emerald-500/20"><Trophy size={20} /></div>
                  <div>
                    <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">Trophy Awarded</h4>
                    <p className="text-[9px] font-bold text-zinc-400 mt-1 italic leading-relaxed">Congratulations on completing the 100 Reels Challenge.</p>
                  </div>
                </div>

                {!profile.trophyDelivery ? (
                  <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl space-y-4 animate-in slide-in-from-top-4">
                    <h4 className="text-[10px] font-black text-white uppercase tracking-widest border-b border-zinc-800 pb-2">Dispatch Information Required</h4>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[7px] font-black text-zinc-500 uppercase tracking-widest ml-1">Full Name</label>
                        <input value={deliveryDetails.fullName} onChange={e => setDeliveryDetails({ ...deliveryDetails, fullName: e.target.value })} className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-xs font-bold text-white outline-none focus:border-amber-500" placeholder="Agent Name" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[7px] font-black text-zinc-500 uppercase tracking-widest ml-1">Phone Number</label>
                        <input value={deliveryDetails.phone} onChange={e => setDeliveryDetails({ ...deliveryDetails, phone: e.target.value })} className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-xs font-bold text-white outline-none focus:border-amber-500" placeholder="+91" type="tel" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[7px] font-black text-zinc-500 uppercase tracking-widest ml-1">Full Address</label>
                        <textarea value={deliveryDetails.address} onChange={e => setDeliveryDetails({ ...deliveryDetails, address: e.target.value })} className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-xs font-bold text-white outline-none focus:border-amber-500 h-20 resize-none" placeholder="Door No, Street, Area, City" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[7px] font-black text-zinc-500 uppercase tracking-widest ml-1">Landmark (Optional)</label>
                          <input value={deliveryDetails.landmark} onChange={e => setDeliveryDetails({ ...deliveryDetails, landmark: e.target.value })} className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-xs font-bold text-white outline-none focus:border-amber-500" placeholder="Near..." />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[7px] font-black text-zinc-500 uppercase tracking-widest ml-1">Pincode</label>
                          <input value={deliveryDetails.pincode} onChange={e => setDeliveryDetails({ ...deliveryDetails, pincode: e.target.value })} className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-xs font-bold text-white outline-none focus:border-amber-500" placeholder="000000" type="text" />
                        </div>
                      </div>
                      <button onClick={handleSaveDelivery} disabled={isSavingDelivery} className="w-full bg-amber-500 text-black py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-50">
                        {isSavingDelivery ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />} Confirm Dispatch Details
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-black/40 border border-zinc-800 p-4 rounded-2xl flex items-center justify-between">
                    <div>
                      <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Delivery Status</p>
                      <p className="text-xs font-black text-white uppercase mt-0.5">Details Locked. Dispatch Pending.</p>
                    </div>
                    <div className="bg-zinc-800 p-2 rounded-xl text-emerald-500"><CheckCircle2 size={16} /></div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Video Upload Button (Always Available if Active) */}
          {(!profile.isPassActive && !profile.plan) ? (
            <button
              onClick={() => setActiveTab('pricing')}
              className="w-full bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 active:scale-95 transition-all p-5 rounded-2xl flex flex-col items-center justify-center gap-2 group"
            >
              <div className="bg-rose-500/20 p-2 rounded-xl text-rose-500 group-hover:scale-110 transition-transform">
                <Video size={20} />
              </div>
              <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest leading-relaxed">
                Purchase any service to unlock content upload
              </p>
              <p className="text-[8px] font-black italic text-rose-400/70 uppercase">Tap to View Plans <ArrowRight size={10} className="inline" /></p>
            </button>
          ) : (
            <button onClick={() => setShowLinkModal(true)} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-5 rounded-2xl font-black text-xs italic tracking-[0.2em] flex items-center justify-center gap-3 shadow-xl shadow-emerald-600/20 active:scale-95 transition-all uppercase">
              <Instagram size={18} /> SYNC INSTAGRAM LINK
            </button>
          )}
        </div>
      </section>

      {/* REDEEM EARNING MODAL */}
      {showRedeemModal && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/95 backdrop-blur-md p-6 animate-in fade-in duration-300">
          <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 space-y-8 relative shadow-2xl animate-in slide-in-from-bottom-10">
            <button onClick={() => !isRedeeming && setShowRedeemModal(false)} className="absolute top-6 right-6 text-zinc-500 hover:text-white p-2 bg-zinc-800 rounded-full transition-colors"><X size={16} /></button>

            <div className="flex flex-col items-center text-center space-y-4">
              <div className="bg-indigo-600 p-4 rounded-3xl text-white shadow-2xl">
                <Landmark size={32} />
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-black italic uppercase text-white tracking-tighter">Request Payout</h3>
                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mt-1">Earnings Redemption Protocol</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-black/60 p-5 rounded-3xl border border-zinc-800 space-y-1">
                <label className="text-[8px] font-black text-zinc-500 uppercase tracking-[0.2em] block">Redemption Amount (₹)</label>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black italic text-indigo-500">₹</span>
                  <input
                    type="number"
                    value={redeemAmount}
                    onChange={e => setRedeemAmount(e.target.value)}
                    className="bg-transparent border-none focus:ring-0 text-4xl font-black italic tracking-tighter text-white w-full outline-none"
                    placeholder="0"
                  />
                </div>
                <p className="text-[7px] font-bold text-zinc-700 uppercase tracking-widest">Available: ₹{currentBalance.toLocaleString()}</p>
              </div>

              <div className="bg-black/60 p-5 rounded-3xl border border-zinc-800 space-y-2">
                <label className="text-[8px] font-black text-zinc-500 uppercase tracking-[0.2em] block">Payout UPI ID</label>
                <input
                  type="text"
                  value={upiId}
                  onChange={e => setUpiId(e.target.value)}
                  className="bg-transparent border-none focus:ring-0 text-sm font-bold tracking-widest text-white w-full outline-none"
                  placeholder="name@okbank"
                />
              </div>

              <div className="bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-2xl flex gap-3">
                <ShieldCheck size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                <p className="text-[8px] font-bold text-zinc-400 uppercase leading-relaxed">
                  Payouts are verified within <span className="text-white">48-72 hours</span>. Ensure your bank details are linked in System Settings.
                </p>
              </div>
            </div>

            <button
              onClick={handleRedeemSubmit}
              disabled={isRedeeming || !redeemAmount}
              className="w-full bg-white text-black py-6 rounded-[2rem] font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-2xl active:scale-95 transition-all disabled:opacity-50"
            >
              {isRedeeming ? <Loader2 className="animate-spin" size={18} /> : <ArrowUpRight size={18} strokeWidth={3} />}
              {isRedeeming ? 'Validating Request...' : 'Confirm Redemption'}
            </button>
          </div>
        </div>
      )}

      {/* SYNC MODAL */}
      {showLinkModal && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-[3rem] p-8 space-y-8 animate-in slide-in-from-bottom-10 duration-500 shadow-2xl relative overflow-hidden">
            <div className="flex justify-between items-center">
              <div className="space-y-1">
                <h3 className="text-2xl font-black italic uppercase tracking-tighter leading-none text-white">Neural Sync</h3>
                <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">Submit Training Content URL</p>
              </div>
              <button onClick={() => setShowLinkModal(false)} className="bg-zinc-800 p-2 rounded-full text-zinc-500 transition-colors hover:bg-zinc-700 hover:text-white"><X size={20} /></button>
            </div>
            <div className="space-y-6">
              {linkError && (
                <div className="bg-rose-500/10 border border-rose-500/30 p-4 rounded-2xl flex items-start gap-3 animate-in fade-in">
                  <AlertCircle size={16} className="text-rose-500 shrink-0 mt-0.5" />
                  <p className="text-[10px] font-bold text-rose-400 leading-relaxed">{linkError}</p>
                </div>
              )}
              <div className="space-y-2">
                <label className="text-[8px] font-black uppercase text-zinc-500 tracking-widest">Instagram Link</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-4 flex items-center text-indigo-500 group-focus-within:text-white transition-colors"><LinkIcon size={18} /></div>
                  <input type="text" autoFocus value={reelLink} onChange={(e) => setReelLink(e.target.value)} placeholder="Paste Reel URL here..." className="w-full bg-black border border-zinc-800 rounded-2xl py-5 pl-12 pr-6 text-sm font-bold text-white outline-none focus:border-indigo-500 transition-all placeholder:text-zinc-800 shadow-inner" />
                </div>
              </div>
              <button onClick={handleSubmitLink} disabled={isSubmitting || !reelLink.trim()} className="w-full bg-indigo-600 text-white py-6 rounded-[2.5rem] font-black text-xs italic tracking-[0.2em] shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all uppercase disabled:opacity-30">
                {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />} BROADCAST LINK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VANITY MODAL */}
      {showRenameModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-md p-6 animate-in fade-in duration-300">
          <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 space-y-6 relative shadow-2xl animate-in slide-in-from-bottom-10">
            <button onClick={() => setShowRenameModal(false)} className="absolute top-6 right-6 text-zinc-500 hover:text-white p-2 bg-zinc-800 rounded-full transition-colors"><X size={16} /></button>
            <div className="flex items-center gap-3"><div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-lg shadow-indigo-600/30"><Edit3 size={20} /></div><div><h3 className="text-xl font-black italic uppercase text-white tracking-tight">Identity Sync</h3><p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Rebrand Promotion Code</p></div></div>
            <div className="space-y-4">
              <div className="space-y-1.5"><label className="text-[9px] font-black uppercase text-zinc-500 tracking-widest ml-1">Custom Vanity Code</label><input value={vanityInput} onChange={e => setVanityInput(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))} placeholder="e.g. ALPHA-POWER" className="w-full bg-black border border-zinc-800 rounded-2xl py-4 px-5 text-lg font-black italic text-white outline-none focus:border-indigo-500 transition-all placeholder:text-zinc-800" /><p className="text-[7px] text-zinc-600 font-bold uppercase tracking-widest leading-relaxed px-1">Identity must be unique. System identifiers cannot be used.</p></div>
              {renameError && (
                <div className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-2xl flex items-start gap-2">
                  <AlertCircle size={14} className="text-rose-500 shrink-0 mt-0.5" />
                  <p className="text-[9px] font-bold text-rose-400 leading-relaxed">{renameError}</p>
                </div>
              )}
              <div className="bg-indigo-600/5 border border-indigo-500/20 p-4 rounded-2xl flex gap-3"><AlertCircle size={14} className="text-indigo-500 shrink-0 mt-0.5" /><p className="text-[9px] font-bold text-zinc-400 uppercase leading-relaxed">Tracking remains persistent. Users entering <span className="text-white">"{vanityInput || '...'}"</span> sync to your wallet.</p></div>
            </div>
            <button onClick={handleRenameSubmit} disabled={isRenaming || !vanityInput.trim()} className="w-full bg-white text-black py-5 rounded-[2rem] font-black text-xs italic tracking-[0.2em] flex items-center justify-center gap-3 shadow-2xl active:scale-95 transition-all disabled:opacity-50">{isRenaming ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}{isRenaming ? 'Securing Identity...' : 'Confirm Rebrand'}</button>
          </div>
        </div>
      )}

      {/* HISTORY MODAL */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-[210] bg-black flex flex-col animate-in slide-in-from-right duration-500 px-4 max-w-md mx-auto border-x border-zinc-900">
          <header className="flex-none py-6 flex items-center justify-between border-b border-zinc-900"><div className="flex items-center gap-4"><button onClick={() => setShowHistoryModal(false)} className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-colors"><X size={20} /></button><div className="space-y-0.5"><h3 className="text-xl font-black italic uppercase tracking-tighter text-white leading-none">Protocol Log</h3><p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest mt-1">{videoHistory.length} Submissions Logged</p></div></div></header>
          <div className="flex-1 overflow-y-auto py-8 space-y-4 scrollbar-hide px-1">
            {isLoadingHistory ? (<div className="flex flex-col items-center justify-center h-48 gap-3"><Loader2 className="animate-spin text-indigo-500" size={24} /><p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Accessing Neural History...</p></div>) : videoHistory.length === 0 ? (<div className="text-center py-24 opacity-30"><History size={48} className="mx-auto mb-4 text-zinc-700" /><p className="text-[10px] font-black uppercase tracking-[0.2em]">Log Empty</p></div>) : (videoHistory.map((link, idx) => { const sequenceNumber = videoHistory.length - idx; return (<button key={link.id} onClick={() => window.open(link.url, '_blank')} className="w-full flex items-center justify-between p-5 bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-800 rounded-3xl transition-all active:scale-[0.98] group relative overflow-hidden"><div className="absolute top-0 right-0 p-2 opacity-5"><Instagram size={40} /></div><div className="flex items-center gap-4 relative z-10"><div className="w-12 h-12 bg-indigo-600/10 rounded-2xl flex items-center justify-center text-indigo-500 border border-indigo-500/10 shadow-lg"><span className="text-xs font-black italic">#{String(sequenceNumber).padStart(2, '0')}</span></div><div className="text-left"><p className="text-base font-black text-white italic tracking-tighter uppercase leading-none">Reel {sequenceNumber}</p><p className="text-[7px] font-black text-zinc-600 uppercase tracking-widest mt-1">Synced {new Date(link.timestamp).toLocaleDateString()}</p></div></div><div className="flex items-center gap-3 relative z-10"><div className="bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-lg"><span className="text-[7px] font-black text-emerald-500 uppercase tracking-widest">SYNCED</span></div><ExternalLink size={14} className="text-zinc-700 group-hover:text-white transition-colors" /></div></button>); }))}
          </div>
          <div className="flex-none py-8"><button onClick={() => setShowHistoryModal(false)} className="w-full bg-zinc-900 border border-zinc-800 text-zinc-500 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 hover:text-white transition-colors">Close History</button></div>
        </div>
      )}
    </div>
  );
};
