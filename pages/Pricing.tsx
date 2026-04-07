
import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { ApiService } from '../services/api';
import { Gift, ShoppingBag, CreditCard, Percent, ChevronRight, Zap, Star, ShieldCheck, Sparkles, Crown, Package, Map, Headphones, MessageSquare, Bot, Tag, ArrowRight, Loader2, X, CheckCircle2, ShieldEllipsis, AlertCircle, Dumbbell, MapPin } from 'lucide-react';

interface Props {
  profile: UserProfile;
  setProfile: (profile: UserProfile) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const Pricing: React.FC<Props> = ({ profile, setProfile, showToast }) => {
  const [activeCategory, setActiveCategory] = useState<'COACH' | 'PASS'>('COACH');
  const [pricingConfig, setPricingConfig] = useState<any>({
    BASE_PRICE: 19999, DOWN_PAYMENT: 3999, FINANCE_FEE: 2000,
    PLAN_STARTER: 299, PLAN_MOMENTUM: 699, PLAN_TRANSFORMATION: 1099, PLAN_CHAMPION: 1799
  });
  const [couponCode, setCouponCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState(0);
  const [appliedHamper, setAppliedHamper] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [pendingItem, setPendingItem] = useState<{ name: string; price: number } | null>(null);

  // Dynamic Pass Features State
  const [passFeatures, setPassFeatures] = useState<any[]>([]);

  useEffect(() => {
    const loadConfig = async () => {
      const config = await ApiService.getPricingConfig();
      setPricingConfig(config);
      const dbFeatures = await ApiService.getPassFeatures();
      setPassFeatures(dbFeatures);
    };
    loadConfig();

    if (localStorage.getItem('openPassTab') === 'true') {
      setActiveCategory('PASS');
      localStorage.removeItem('openPassTab');
    }
  }, []);

  const handlePurchaseClick = (name: string, price: number) => {
    setPendingItem({ name, price });
    setShowPaymentModal(true);
  };

  const handleApplyCoupon = async () => {
    if (!couponCode) return;
    setIsValidating(true);
    try {
      const coupon = await ApiService.validateCoupon(couponCode);
      if (coupon) {
        setAppliedDiscount(coupon.discountAmount);
        setAppliedHamper(coupon.giftHamper || null);

        let msg = `Code Applied: ₹${coupon.discountAmount} OFF`;
        if (coupon.giftHamper) msg += ` + Free ${coupon.giftHamper}`;

        showToast(msg, "success");
      } else {
        setAppliedDiscount(0);
        setAppliedHamper(null);
        showToast("Invalid Coupon Code", "error");
      }
    } catch (e) {
      showToast("Verification failed", "error");
    } finally {
      setIsValidating(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedDiscount(0);
    setAppliedHamper(null);
    setCouponCode('');
    showToast("Promotion removed", "info");
  };

  const executeDummyPayment = async () => {
    if (!pendingItem) return;
    setIsProcessingPayment(true);

    // Simulate Gateway Delay
    await new Promise(r => setTimeout(r, 1500));

    try {
      const updatedProfile = await ApiService.completePurchase(profile, pendingItem.name, couponCode, pendingItem.price);
      setProfile(updatedProfile);
      setShowPaymentModal(false);
      showToast("Payment Successful! Protocol Activated.", "success");
    } catch (e) {
      showToast("Sync Error during attribution", "error");
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const finalPrice = Math.max(0, pricingConfig.BASE_PRICE - appliedDiscount);
  const loanAmount = Math.max(0, finalPrice - pricingConfig.DOWN_PAYMENT);
  const totalLoanWithFee = loanAmount + pricingConfig.FINANCE_FEE;
  const emiAmount = Math.ceil(totalLoanWithFee / 11);

  const aiPlans = [
    {
      id: 'starter',
      name: 'Starter',
      period: '1 Month',
      price: pricingConfig.PLAN_STARTER,
      pricePerMo: `₹${pricingConfig.PLAN_STARTER} / month`,
      features: ['AI workouts & diet', 'Progress tracking', 'AI chat support', 'Basic support'],
      icon: <Bot size={18} className="text-zinc-500" />,
      color: 'border-zinc-800'
    },
    {
      id: 'momentum',
      name: 'Momentum',
      period: '3 Months',
      price: pricingConfig.PLAN_MOMENTUM,
      pricePerMo: `₹${Math.round(pricingConfig.PLAN_MOMENTUM / 3)} / month`,
      features: ['AI workouts & diet', 'Progress tracking', 'AI chat support', 'Priority support'],
      icon: <Zap size={18} className="text-indigo-500" />,
      color: 'border-indigo-500/30',
      popular: true
    },
    {
      id: 'transformation',
      name: 'Transformation',
      period: '6 Months',
      price: pricingConfig.PLAN_TRANSFORMATION,
      pricePerMo: `₹${Math.round(pricingConfig.PLAN_TRANSFORMATION / 6)} / month`,
      features: ['AI workouts & diet', 'Progress tracking', 'AI chat support', 'Priority support', 'WhatsApp integration'],
      icon: <Sparkles size={18} className="text-emerald-500" />,
      color: 'border-emerald-500/30'
    },
    {
      id: 'champion',
      name: 'Yearly Champion',
      period: '12 Months',
      price: pricingConfig.PLAN_CHAMPION,
      pricePerMo: `₹${Math.round(pricingConfig.PLAN_CHAMPION / 12)} / month`,
      features: ['AI workouts & diet', 'Progress tracking', 'AI chat support', 'Priority support', 'WhatsApp integration', 'Free merchandise', '1-on-1 consultation'],
      icon: <Crown size={18} className="text-amber-500" />,
      color: 'border-amber-500/30'
    }
  ];

  // Default Icons mapping helper in UI below since DB only stores strings

  return (
    <div className="space-y-8 pb-32 px-1 animate-in fade-in duration-500 max-w-md mx-auto relative w-full">
      <header className="text-center space-y-2 px-4">
        <h2 className="text-4xl font-black italic tracking-tighter uppercase">Power Up</h2>
        <p className="text-zinc-500 text-[9px] font-black uppercase tracking-[0.3em]">Elite Subscription & Network Access</p>
      </header>

      {/* Category Toggle */}
      <div className="flex bg-zinc-900 p-1 rounded-2xl border border-zinc-800 mx-4">
        <button
          onClick={() => setActiveCategory('COACH')}
          className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeCategory === 'COACH' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-zinc-500'}`}
        >
          AI Coach
        </button>
        <button
          onClick={() => setActiveCategory('PASS')}
          className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeCategory === 'PASS' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-zinc-500'}`}
        >
          Transformix Pass
        </button>
      </div>

      {activeCategory === 'COACH' ? (
        <div className="space-y-6 animate-in slide-in-from-left-4 duration-500">
          <div className="px-4">
            <h3 className="text-xs font-black uppercase text-zinc-600 tracking-widest flex items-center gap-2 mb-2">
              <Bot size={14} className="text-indigo-500" /> AI Coach Service Plans
            </h3>
            <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-tight">Personalized coaching protocol</p>
          </div>

          <div className="space-y-4 px-2">
            {aiPlans.map((plan) => {
              const isPurchased = profile.plan === plan.name;
              return (
                <div
                  key={plan.id}
                  onClick={() => !isPurchased && handlePurchaseClick(plan.name, plan.price)}
                  className={`bg-zinc-900/40 p-5 rounded-[2.5rem] border transition-all relative overflow-hidden ${plan.color} ${isPurchased ? 'border-emerald-500/50 cursor-default' : 'cursor-pointer group hover:bg-zinc-900'}`}
                >
                  {plan.popular && !isPurchased && (
                    <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[6px] font-black uppercase px-3 py-1 rounded-bl-xl tracking-[0.2em]">
                      BEST VALUE
                    </div>
                  )}
                  {isPurchased && (
                    <div className="absolute top-0 right-0 bg-emerald-600 text-white text-[6px] font-black uppercase px-3 py-1 rounded-bl-xl tracking-[0.2em]">
                      ACTIVE
                    </div>
                  )}

                  <div className="flex justify-between items-start mb-5 gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-3 bg-zinc-800 rounded-2xl shrink-0 group-hover:bg-indigo-600/10 transition-colors">
                        {plan.icon}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-black text-lg italic uppercase tracking-tighter leading-tight text-white">{plan.name}</h4>
                        <p className="text-zinc-500 text-[8px] font-black uppercase tracking-widest mt-1">{plan.period}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xl font-black italic tracking-tighter text-white">₹{plan.price.toLocaleString()}</p>
                      <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-tighter mt-1">{plan.pricePerMo}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 mb-6 px-1">
                    {plan.features.map((feat, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <ShieldCheck size={10} className="text-emerald-500 shrink-0 mt-0.5" />
                        <span className="text-[8px] font-black text-zinc-400 uppercase tracking-tight leading-tight">{feat}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    disabled={isPurchased}
                    className={`w-full py-4 rounded-2xl font-black text-[9px] tracking-[0.2em] uppercase transition-all flex items-center justify-center gap-2 ${isPurchased ? 'bg-emerald-600/20 text-emerald-500 border border-emerald-500/30' : plan.popular ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20' : 'bg-white text-black'}`}>
                    {isPurchased ? (
                      <>Service Activated {profile.planExpiryDate ? `(Expires: ${new Date(profile.planExpiryDate).toLocaleDateString()})` : ''}</>
                    ) : (
                      <>Choose Plan <ChevronRight size={14} /></>
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-8 animate-in slide-in-from-right-4 duration-500 px-2 pb-10">
          <section className="bg-zinc-900 p-8 rounded-[3rem] border border-indigo-500/40 relative overflow-hidden shadow-2xl">
            <div className="absolute -top-10 -right-10 opacity-5 rotate-12">
              <Map size={180} className="text-indigo-500" />
            </div>

            <div className="relative z-10 space-y-6">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-600 p-4 rounded-2xl text-white shadow-xl shadow-indigo-600/20">
                  <Crown size={28} />
                </div>
                <div>
                  <h3 className="text-2xl font-black italic uppercase tracking-tighter">Transformix Pass</h3>
                  <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Global All-India Access</p>
                </div>
              </div>

              {/* Coupon Section */}
              {!profile.isPassActive && (
                <>
                  <div className="bg-black/40 p-4 rounded-2xl border border-zinc-800/50 flex gap-2">
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-3 flex items-center text-zinc-500"><Tag size={14} /></div>
                      <input
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        disabled={appliedDiscount > 0 || appliedHamper !== null}
                        placeholder="REFERRAL OR PROMO CODE"
                        className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl py-2.5 pl-9 pr-2 text-xs font-bold text-white uppercase placeholder:text-zinc-600 outline-none focus:border-indigo-500 disabled:opacity-50"
                      />
                    </div>
                    {appliedDiscount > 0 || appliedHamper !== null ? (
                      <button onClick={handleRemoveCoupon} className="bg-zinc-800 px-3 rounded-xl text-zinc-500 hover:text-white transition-all"><X size={16} /></button>
                    ) : (
                      <button
                        onClick={handleApplyCoupon}
                        disabled={isValidating || !couponCode}
                        className="bg-indigo-600 px-4 rounded-xl font-black text-[9px] uppercase tracking-widest text-white shadow-lg active:scale-95 disabled:opacity-50"
                      >
                        {isValidating ? <Loader2 size={12} className="animate-spin" /> : 'APPLY'}
                      </button>
                    )}
                  </div>

                  {/* Promotion Success Notifications */}
                  {(appliedDiscount > 0 || appliedHamper) && (
                    <div className="space-y-2 animate-in zoom-in-95 duration-500">
                      {appliedDiscount > 0 && (
                        <div className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 rounded-2xl flex justify-between items-center shadow-lg">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 size={14} className="text-emerald-500" />
                            <span className="text-[10px] font-black uppercase text-emerald-500 tracking-widest">Discount Applied</span>
                          </div>
                          <span className="text-[11px] font-black text-white italic">-₹{appliedDiscount.toLocaleString()}</span>
                        </div>
                      )}
                      {appliedHamper && (
                        <div className="bg-amber-500/10 border border-amber-500/20 px-4 py-3 rounded-2xl flex items-center gap-3 shadow-lg">
                          <div className="bg-amber-500 p-2 rounded-xl text-black shadow-lg"><Gift size={16} /></div>
                          <div className="flex-1">
                            <span className="text-[8px] font-black text-amber-500 uppercase tracking-widest block mb-0.5">Gift Secured</span>
                            <span className="text-[11px] font-black text-white italic leading-tight">{appliedHamper}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              <p className="text-[11px] text-zinc-400 leading-relaxed font-medium italic">Train at 8,100+ premium gyms across India with full flexibility and elite AI support.</p>

              <div className="space-y-4">
                {profile.isPassActive ? (
                  <div className="bg-emerald-600/10 p-5 rounded-[2rem] border border-emerald-500/30 text-center space-y-2">
                    <div className="bg-emerald-500/20 w-12 h-12 rounded-full flex items-center justify-center mx-auto text-emerald-500">
                      <ShieldCheck size={24} />
                    </div>
                    <h4 className="text-emerald-500 font-black italic uppercase tracking-widest text-lg">Pass Activated</h4>
                    {profile.passExpiryDate && (
                      <p className="text-[10px] font-black text-emerald-400/70 uppercase">
                        Expires: {new Date(profile.passExpiryDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Option A - Finance */}
                    <div
                      onClick={() => handlePurchaseClick(`Pass Installments`, pricingConfig.DOWN_PAYMENT)}
                      className="bg-black/60 p-5 rounded-[2rem] border border-zinc-800 hover:border-indigo-500/50 transition-all cursor-pointer group"
                    >
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.2em]">Option A: Finance</span>
                        <ShieldCheck size={16} className="text-indigo-500" />
                      </div>
                      <div className="space-y-1 mb-4">
                        <div className="flex items-baseline gap-2">
                          <h5 className="text-2xl font-black italic uppercase text-white">₹{pricingConfig.DOWN_PAYMENT.toLocaleString()}</h5>
                          <span className="text-[9px] font-bold text-zinc-500 uppercase">Down Payment</span>
                        </div>
                        <p className="text-[10px] font-bold text-zinc-400 uppercase">Then ₹{emiAmount.toLocaleString()} / Month × 11</p>
                      </div>
                      <div className="flex items-center gap-2 text-[8px] font-black text-emerald-500 bg-emerald-500/5 p-2 rounded-lg border border-emerald-500/10">
                        <Sparkles size={10} />
                        <span>INCLUDES 1-YEAR AI COACH FREE</span>
                      </div>
                      <div className="bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl flex gap-2 mt-4 items-start">
                        <ShieldCheck size={12} className="text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-amber-500 text-[8px] font-bold leading-tight uppercase tracking-widest">Our agent will contact you shortly to conduct KYC document verification and finalize your Gym Pass activation once payment done.</p>
                      </div>
                      <button className="w-full mt-4 bg-zinc-800 text-white py-3 rounded-xl text-[9px] font-black uppercase tracking-widest group-hover:bg-indigo-600 transition-colors">Select Finance</button>
                    </div>

                    {/* Option B - Full Payment */}
                    <div
                      onClick={() => handlePurchaseClick(`Pass Full Payment`, finalPrice)}
                      className="bg-indigo-600 p-5 rounded-[2rem] border border-indigo-400/50 shadow-xl shadow-indigo-600/30 cursor-pointer group relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 p-2 opacity-10"><Zap size={40} /></div>
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-[9px] font-black text-white uppercase tracking-[0.2em]">Option B: One-Time</span>
                        <Crown size={16} className="text-white" />
                      </div>
                      <div className="space-y-1 mb-4">
                        <div className="flex items-baseline gap-2">
                          <h5 className="text-3xl font-black italic uppercase text-white">₹{finalPrice.toLocaleString()}</h5>
                          {appliedDiscount > 0 && <span className="text-sm font-bold text-white/60 line-through">₹{pricingConfig.BASE_PRICE.toLocaleString()}</span>}
                        </div>
                        <p className="text-[10px] font-bold text-indigo-100 uppercase">Full Payment (Cash/UPI)</p>
                      </div>
                      <div className="flex items-center gap-2 text-[8px] font-black text-indigo-900 bg-white/20 p-2 rounded-lg">
                        <Sparkles size={10} className="text-white" />
                        <span className="text-white">INCLUDES 1-YEAR AI COACH + ELITE MERCH</span>
                      </div>
                      <div className="bg-black/20 p-2.5 rounded-xl flex gap-2 mt-4 items-start border border-white/10">
                        <ShieldCheck size={12} className="text-white/80 shrink-0 mt-0.5" />
                        <p className="text-white/80 text-[8px] font-bold leading-tight uppercase tracking-widest">Our agent will contact you shortly to conduct KYC document verification and finalize your Gym Pass activation once payment done.</p>
                      </div>
                      <button className="w-full mt-4 bg-white text-black py-3 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
                        Get Pass Now <ArrowRight size={12} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>

          {/* Perks Section */}
          <section className="bg-zinc-900 p-8 rounded-[3rem] border border-zinc-800 space-y-6">
            <h3 className="text-xs font-black uppercase text-amber-500 tracking-[0.2em] flex items-center gap-2">
              <Gift size={16} /> 🎁 What’s Included
            </h3>
            <div className="space-y-3">
              {passFeatures.map((feat) => {
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
                  <div key={feat.id} className="flex items-center gap-3 bg-black/40 p-4 rounded-2xl border border-zinc-800/50">
                    <div className="text-indigo-400 shrink-0"><IconComp size={14} /></div>
                    <span className="text-[10px] font-black uppercase tracking-tight text-zinc-300 leading-tight">{feat.text}</span>
                  </div>
                )
              })}
            </div>

            <div className="pt-2 text-center">
              <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest flex items-center justify-center gap-2">
                <ShieldCheck size={10} /> Fully Secured & Verified Enrollment
              </p>
            </div>
          </section>
        </div>
      )}

      {/* DUMMY PAYMENT MODAL */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-md p-6 animate-in fade-in duration-300">
          <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 space-y-8 relative shadow-2xl animate-in zoom-in-95">
            <button
              onClick={() => !isProcessingPayment && setShowPaymentModal(false)}
              className="absolute top-6 right-6 text-zinc-600 hover:text-white p-2"
            >
              <X size={20} />
            </button>

            <div className="flex flex-col items-center text-center space-y-4">
              <div className="bg-emerald-600/10 p-4 rounded-3xl text-emerald-500 border border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                <ShieldEllipsis size={40} />
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-black italic uppercase text-white tracking-tighter leading-none">Secure Sandbox</h3>
                <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mt-1">Testing Protocol Active</p>
              </div>
            </div>

            <div className="bg-black/40 border border-zinc-800 p-5 rounded-3xl space-y-4">
              <div className="flex justify-between items-end border-b border-zinc-800/50 pb-3">
                <div>
                  <span className="text-[7px] font-black text-zinc-600 uppercase tracking-widest block mb-1">Item</span>
                  <span className="text-xs font-black text-white uppercase italic">{pendingItem?.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-[7px] font-black text-zinc-600 uppercase tracking-widest block mb-1">Total Due</span>
                  <span className="text-lg font-black text-white italic">₹{pendingItem?.price.toLocaleString()}</span>
                </div>
              </div>

              {(appliedDiscount > 0 || appliedHamper !== null) && pendingItem?.name.includes('Pass') && (
                <div className="flex gap-3">
                  <div className="p-2 bg-indigo-600/20 rounded-xl text-indigo-400 shrink-0"><Tag size={16} /></div>
                  <div>
                    <span className="text-[7px] font-black text-zinc-500 uppercase tracking-widest block mb-0.5">Applied Code</span>
                    <span className="text-[10px] font-black text-white uppercase">{couponCode}</span>
                  </div>
                </div>
              )}
            </div>

            {pendingItem?.name.includes('Pass') && (
              <div className="space-y-3">
                <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-2xl flex gap-3">
                  <ShieldCheck size={16} className="text-amber-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest">Post-Payment Protocol</p>
                    <p className="text-[8px] font-bold text-zinc-400 leading-tight uppercase">Our agent will contact you shortly to conduct KYC document verification and finalize your Gym Pass activation once payment done.</p>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={executeDummyPayment}
              disabled={isProcessingPayment}
              className="w-full bg-white text-black py-6 rounded-[2rem] font-black text-xs italic tracking-[0.2em] shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all uppercase disabled:opacity-50"
            >
              {/* Fixed isProcessingProcessing to isProcessingPayment */}
              {isProcessingPayment ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
              {isProcessingPayment ? 'Processing...' : 'Confirm Dummy Payment'}
            </button>

            <p className="text-center text-[7px] font-black text-zinc-700 uppercase tracking-widest">
              ID: {Math.random().toString(36).substring(7).toUpperCase()} // DEV MODE
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
