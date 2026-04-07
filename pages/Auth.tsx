
import React, { useState } from 'react';
import { UserProfile } from '../types';
import { ApiService } from '../services/api';
import { Loader2, Lock, Mail, User, Smartphone, LogIn, UserPlus } from 'lucide-react';

interface Props {
  onLogin: (profile: UserProfile) => void;
  onRegisterStart: (partialProfile: Partial<UserProfile>) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const Auth: React.FC<Props> = ({ onLogin, onRegisterStart, showToast }) => {
  const [isLogin, setIsLogin] = useState(true);
  
  // Forgot Password State
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetStep, setResetStep] = useState<'request' | 'verifyPhone'>('request');
  const [resetOtp, setResetOtp] = useState('');
  const [resetPhone, setResetPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  // Login State
  const [identifier, setIdentifier] = useState(''); // Unified Email or Phone input
  
  // Sign Up State
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  
  // Common
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    setIsLoading(true);

    try {
      if (isLogin) {
        // LOGIN FLOW
        if (!identifier) { showToast("Enter Email or Phone", "error"); setIsLoading(false); return; }
        if (!password) { showToast("Password is required", "error"); setIsLoading(false); return; }

        const user = await ApiService.loginUser(identifier, password);
        if (user) {
          showToast("Welcome back!", "success");
          onLogin(user);
        } else {
          showToast("Invalid credentials", "error");
        }
      } else {
        // SIGN UP FLOW
        if (!name.trim()) { showToast("Name is required", "error"); setIsLoading(false); return; }

        // Strict email validation (matches Supabase/GoTrue rules)
        // local part must be at least 2 chars, valid domain required
        const emailRegex = /^[^\s@]{2,}@[^\s@]+\.[^\s@]{2,}$/;
        if (!email.trim() || !emailRegex.test(email.trim())) { 
          showToast("Invalid email — please use a real address (e.g. yourname@gmail.com)", "error"); 
          setIsLoading(false); 
          return; 
        }

        if (!phone.trim() || phone.replace(/[^\d+]/g, '').length < 10) { 
          showToast("Please enter a valid phone number", "error"); 
          setIsLoading(false); 
          return; 
        }

        if (!password || password.length < 6) { 
          showToast("Password must be at least 6 characters", "error"); 
          setIsLoading(false); 
          return; 
        }

        // Check if email/phone already exists
        const existingUser = await ApiService.checkUserExists(email, phone);
        if (existingUser) {
          if (existingUser.email === email) {
            showToast("Email already registered. Please Login.", "error");
          } else if (existingUser.phone && existingUser.phone === phone) {
            showToast("Phone number already registered. Please Login.", "error");
          } else {
            showToast("Account already exists. Please Login.", "error");
          }
          setIsLoading(false);
          return;
        }

        // Sign Up Flow
        const partial: Partial<UserProfile> = {
          name,
          email,
          phone,
          password,
        };
        onRegisterStart(partial);
      }
    } catch (e) {
      showToast("Connection error", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!identifier) { showToast("Please enter your Email or Phone", "error"); return; }
    setIsLoading(true);
    try {
      const res = await ApiService.sendPasswordReset(identifier);
      if (res.type === 'phone') {
        setResetPhone(res.phone);
        setResetStep('verifyPhone');
        showToast("OTP sent to your phone. Please verify.", "success");
      } else {
        showToast("Password reset link sent to your email!", "success");
        setIsForgotPassword(false);
      }
    } catch (e: any) {
      showToast(e.message || "Failed to send reset link", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!resetOtp || resetOtp.length < 6) { showToast("Enter a valid 6-digit OTP", "error"); return; }
    if (!newPassword || newPassword.length < 6) { showToast("New password must be 6+ chars", "error"); return; }
    setIsLoading(true);
    try {
      const user = await ApiService.resetPasswordWithPhone(resetPhone, resetOtp, newPassword);
      if (user) {
        showToast("Password reset successfully!", "success");
        onLogin(user);
      } else {
        showToast("Reset successful, but please login again", "info");
        setIsForgotPassword(false);
        setResetStep('request');
      }
    } catch (e: any) {
      showToast(e.message || "Failed to verify OTP", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 relative overflow-y-auto">
      {/* Background Ambience */}
      <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-indigo-900/20 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-900/10 blur-[100px] rounded-full pointer-events-none"></div>

      <div className="w-full max-w-sm space-y-4 relative z-10 animate-in fade-in zoom-in-95 duration-500">
        
        {/* Header */}
        <div className="text-center space-y-1">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center shadow-2xl mx-auto mb-2">
            <span className="text-2xl font-black italic text-white">T</span>
          </div>
          <h1 className="text-xl font-black tracking-tight uppercase text-white">Transformix</h1>
          <p className="text-[10px] font-medium text-zinc-500">Your Personal AI Fitness Coach</p>
        </div>

        {/* Auth Card */}
        <div className="bg-zinc-900/90 backdrop-blur-md border border-zinc-800 p-5 rounded-[1.5rem] shadow-2xl space-y-4">
          
          {/* Main Toggle: Login vs Sign Up */}
          {!isForgotPassword && (
            <div className="flex bg-black/50 p-1 rounded-lg border border-zinc-800/50">
              <button 
                onClick={() => setIsLogin(true)}
                className={`flex-1 py-2 rounded-md text-[9px] font-black uppercase tracking-widest transition-all ${isLogin ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                Login
              </button>
              <button 
                onClick={() => setIsLogin(false)}
                className={`flex-1 py-2 rounded-md text-[9px] font-black uppercase tracking-widest transition-all ${!isLogin ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                Sign Up
              </button>
            </div>
          )}

          <div className="space-y-3">
             {/* FORGOT PASSWORD FORM */}
             {isForgotPassword ? (
               resetStep === 'request' ? (
                 <div className="space-y-3 animate-in fade-in">
                   <div className="space-y-1.5">
                     <label className="text-zinc-500 text-[9px] font-black uppercase tracking-widest ml-1">Email or Phone</label>
                     <div className="relative group">
                        <div className="absolute inset-y-0 left-4 flex items-center text-zinc-500 group-focus-within:text-indigo-500 transition-colors"><User size={16} /></div>
                        <input 
                         type="text" 
                         value={identifier}
                         onChange={e => setIdentifier(e.target.value)}
                         className="w-full bg-black/40 border border-zinc-800 rounded-lg py-2.5 pl-12 pr-4 text-xs font-bold text-white focus:border-indigo-500 outline-none transition-all placeholder:text-zinc-700"
                         placeholder="name@email.com or 999..."
                        />
                     </div>
                   </div>
                   <button 
                     onClick={handleForgotPassword}
                     disabled={isLoading}
                     className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-lg font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all"
                   >
                     {isLoading ? <Loader2 className="animate-spin" size={16}/> : <Mail size={16}/>}
                     Send Reset Link / OTP
                   </button>
                   <button 
                     onClick={() => setIsForgotPassword(false)}
                     className="w-full text-zinc-500 hover:text-white py-2 text-[10px] uppercase font-bold tracking-wider transition-colors"
                   >
                     Back to Login
                   </button>
                 </div>
               ) : (
                 <div className="space-y-3 animate-in slide-in-from-right-2">
                   <div className="space-y-1.5">
                     <label className="text-zinc-500 text-[9px] font-black uppercase tracking-widest ml-1">6-Digit OTP</label>
                     <div className="relative group">
                        <div className="absolute inset-y-0 left-4 flex items-center text-zinc-500 group-focus-within:text-indigo-500 transition-colors"><Smartphone size={16} /></div>
                        <input 
                         type="text" 
                         value={resetOtp}
                         onChange={e => setResetOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                         className="w-full bg-black/40 border border-zinc-800 rounded-lg py-2.5 pl-12 pr-4 text-xs font-bold text-white focus:border-indigo-500 outline-none transition-all placeholder:text-zinc-700 tracking-[0.5em] text-center"
                         placeholder="000000"
                        />
                     </div>
                   </div>
                   <div className="space-y-1.5">
                     <label className="text-zinc-500 text-[9px] font-black uppercase tracking-widest ml-1">New Password</label>
                     <div className="relative group">
                        <div className="absolute inset-y-0 left-4 flex items-center text-zinc-500 group-focus-within:text-indigo-500 transition-colors"><Lock size={16} /></div>
                        <input 
                         type="password" 
                         value={newPassword}
                         onChange={e => setNewPassword(e.target.value)}
                         className="w-full bg-black/40 border border-zinc-800 rounded-lg py-2.5 pl-12 pr-4 text-xs font-bold text-white focus:border-indigo-500 outline-none transition-all placeholder:text-zinc-700"
                         placeholder="••••••••"
                        />
                     </div>
                   </div>
                   <button 
                     onClick={handleVerifyOtp}
                     disabled={isLoading}
                     className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-lg font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all"
                   >
                     {isLoading ? <Loader2 className="animate-spin" size={16}/> : <Lock size={16}/>}
                     Verify & Reset
                   </button>
                   <button 
                     onClick={() => { setIsForgotPassword(false); setResetStep('request'); }}
                     className="w-full text-zinc-500 hover:text-white py-2 text-[10px] uppercase font-bold tracking-wider transition-colors"
                   >
                     Cancel
                   </button>
                 </div>
               )
             ) : (
               <>
                 {/* Existing Login/Signup forms */}
                 {isLogin && (
                   <div className="space-y-1.5 animate-in fade-in">
                     <label className="text-zinc-500 text-[9px] font-black uppercase tracking-widest ml-1">Email or Phone</label>
                     <div className="relative group">
                        <div className="absolute inset-y-0 left-4 flex items-center text-zinc-500 group-focus-within:text-indigo-500 transition-colors"><User size={16} /></div>
                        <input 
                         type="text" 
                         value={identifier}
                         onChange={e => setIdentifier(e.target.value)}
                         className="w-full bg-black/40 border border-zinc-800 rounded-lg py-2.5 pl-12 pr-4 text-xs font-bold text-white focus:border-indigo-500 outline-none transition-all placeholder:text-zinc-700"
                         placeholder="name@email.com or 999..."
                        />
                     </div>
                   </div>
                 )}

                 {!isLogin && (
                  <>
                    <div className="space-y-1.5 animate-in slide-in-from-left-2">
                      <label className="text-zinc-500 text-[9px] font-black uppercase tracking-widest ml-1">Full Name</label>
                      <div className="relative group">
                         <div className="absolute inset-y-0 left-4 flex items-center text-zinc-500 group-focus-within:text-indigo-500 transition-colors"><User size={16} /></div>
                         <input 
                          type="text" 
                          value={name}
                          onChange={e => setName(e.target.value)}
                          className="w-full bg-black/40 border border-zinc-800 rounded-lg py-2.5 pl-12 pr-4 text-xs font-bold text-white focus:border-indigo-500 outline-none transition-all placeholder:text-zinc-700"
                          placeholder="Your Name"
                         />
                      </div>
                    </div>

                    <div className="space-y-1.5 animate-in slide-in-from-left-2">
                      <label className="text-zinc-500 text-[9px] font-black uppercase tracking-widest ml-1">Email Address</label>
                      <div className="relative group">
                         <div className="absolute inset-y-0 left-4 flex items-center text-zinc-500 group-focus-within:text-indigo-500 transition-colors"><Mail size={16} /></div>
                         <input 
                          type="email" 
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          className="w-full bg-black/40 border border-zinc-800 rounded-lg py-2.5 pl-12 pr-4 text-xs font-bold text-white focus:border-indigo-500 outline-none transition-all placeholder:text-zinc-700"
                          placeholder="name@example.com"
                         />
                      </div>
                    </div>

                    <div className="space-y-1.5 animate-in slide-in-from-left-2">
                      <label className="text-zinc-500 text-[9px] font-black uppercase tracking-widest ml-1">Phone Number</label>
                      <div className="relative group">
                         <div className="absolute inset-y-0 left-4 flex items-center text-zinc-500 group-focus-within:text-indigo-500 transition-colors"><Smartphone size={16} /></div>
                         <input 
                          type="tel" 
                          value={phone}
                          onChange={e => setPhone(e.target.value.replace(/[^\d+]/g, ''))}
                          className="w-full bg-black/40 border border-zinc-800 rounded-lg py-2.5 pl-12 pr-4 text-xs font-bold text-white focus:border-indigo-500 outline-none transition-all placeholder:text-zinc-700"
                          placeholder="9999900000"
                          maxLength={15}
                         />
                      </div>
                    </div>
                  </>
                 )}

                 {/* Password Input (Common) */}
                 <div className="space-y-1.5 animate-in fade-in">
                   <div className="flex justify-between items-center pr-1">
                     <label className="text-zinc-500 text-[9px] font-black uppercase tracking-widest ml-1">Password</label>
                     {isLogin && (
                       <button 
                         onClick={() => setIsForgotPassword(true)}
                         className="text-[9px] text-indigo-400 hover:text-indigo-300 font-bold uppercase tracking-widest transition-colors"
                       >
                         Forgot?
                       </button>
                     )}
                   </div>
                   <div className="relative group">
                      <div className="absolute inset-y-0 left-4 flex items-center text-zinc-500 group-focus-within:text-indigo-500 transition-colors"><Lock size={16} /></div>
                      <input 
                       type="password" 
                       value={password}
                       onChange={e => setPassword(e.target.value)}
                       onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                       className="w-full bg-black/40 border border-zinc-800 rounded-lg py-2.5 pl-12 pr-4 text-xs font-bold text-white focus:border-indigo-500 outline-none transition-all placeholder:text-zinc-700"
                       placeholder="••••••••"
                      />
                   </div>
                 </div>

                 <button 
                   onClick={handleSubmit}
                   disabled={isLoading}
                   className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 mt-2 rounded-lg font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all"
                 >
                   {isLoading ? <Loader2 className="animate-spin" size={16}/> : (isLogin ? <LogIn size={16}/> : <UserPlus size={16}/>)}
                   {isLogin ? 'Login' : 'Create Account'}
                 </button>
               </>
             )}
          </div>


        </div>
        
        <p className="text-center text-[9px] text-zinc-600 font-bold uppercase tracking-widest">
          Secured by Transformix
        </p>
      </div>
    </div>
  );
};
