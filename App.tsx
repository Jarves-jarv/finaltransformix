
import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { Onboarding } from './pages/Onboarding';
import { Dashboard } from './pages/Dashboard';
import { WorkoutSystem } from './pages/WorkoutSystem';
import { DietSystem } from './pages/DietSystem';
import { ProgressTracking } from './pages/ProgressTracking';
import { TransformixPass } from './pages/TransformixPass';
import { Assistant } from './pages/Assistant';
import { Community } from './pages/Community';
import { Pricing } from './pages/Pricing';
import { Rewards } from './pages/Rewards';
import { Settings } from './pages/Settings';
import { Auth } from './pages/Auth';
// AdminPanel is 108KB — lazy loaded so regular users never download it
const AdminPanel = lazy(() => import('./pages/AdminPanel').then(m => ({ default: m.AdminPanel })));
import { UserProfile, Gender, BodyType, FitnessGoal, ExperienceLevel, DietPreference } from './types';
import { Layout } from './components/Layout';
import { ApiService } from './services/api';
import { Toast, ToastType } from './components/Toast';

const DEFAULT_PROFILE: UserProfile = {
  gender: Gender.MALE,
  age: 25,
  height: 175,
  weight: 75,
  bodyType: BodyType.MESOMORPH,
  goal: FitnessGoal.MUSCLE_GAIN,
  experience: ExperienceLevel.INTERMEDIATE,
  dietPreference: DietPreference.VEGETARIAN,
  typicalMeals: ['Oats', 'Milk', 'Eggs'],
  equipment: ['Dumbbells', 'Bench', 'Barbell'],
  isPassActive: false,
  referrals: 2,
  videoUploads: 27,
  injuries: []
};

// Minimal loading screen for Suspense fallback while AdminPanel chunk downloads
const AdminLoadingScreen = () => (
  <div className="min-h-screen bg-black flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
  </div>
);

const App: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState<'auth' | 'onboarding' | 'main'>('auth');
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [activeTab, setActiveTab] = useState('home');
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  // Temporary state to hold partial registration data passed to Onboarding
  const [authData, setAuthData] = useState<Partial<UserProfile> | undefined>(undefined);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    const initData = async () => {
      try {
        const savedProfile = await ApiService.getProfile();
        if (savedProfile) {
          setProfile(savedProfile);
          setCurrentStep('main');
          if (savedProfile.role === 'admin') {
            setActiveTab('admin');
          }
        } else {
          setCurrentStep('auth');
        }
      } catch (e) {
        console.error("Critical DB Load Error:", e);
        showToast("Session failed to load. Resetting storage.", "error");
      } finally {
        setTimeout(() => setLoading(false), 800);
      }
    };
    initData();
  }, [showToast]);

  const handleLogin = async (user: UserProfile) => {
    setProfile(user);
    if (user.role === 'admin') {
      setActiveTab('admin');
    }
    setCurrentStep('main');
  };

  const handleLogout = async () => {
    try {
      await ApiService.logout();
    } catch (e) {
      console.error("Logout failed", e);
    } finally {
      window.location.reload();
    }
  };

  const handleRegisterStart = (partialProfile: Partial<UserProfile>) => {
    setAuthData(partialProfile);
    setCurrentStep('onboarding');
  };

  const handleOnboardingComplete = async (newProfile: UserProfile) => {
    try {
      setLoading(true);

      let redirectTarget = 'home';
      if (newProfile.isPassActive) {
        newProfile.isPassActive = false;
        localStorage.setItem('openPassTab', 'true');
        redirectTarget = 'pricing';
      }

      const result = await ApiService.registerUser(newProfile);

      if (result && result.id) {
        setProfile(result);
      } else {
        setProfile(newProfile);
      }

      setActiveTab(redirectTarget);
      setCurrentStep('main');
      showToast("Transformation Profile Synced", "success");
    } catch (e: any) {
      showToast(e.message || "Account creation failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center space-y-8 animate-in fade-in duration-700">
        <div className="relative">
          <div className="w-20 h-20 bg-indigo-600 rounded-2xl rotate-12 flex items-center justify-center shadow-[0_0_40px_rgba(79,70,229,0.4)]">
            <span className="text-4xl font-black italic -rotate-12 text-white">T</span>
          </div>
          <div className="absolute -inset-4 bg-indigo-600/20 blur-3xl rounded-full animate-pulse"></div>
        </div>
        <div className="text-center space-y-2 relative z-10">
          <h1 className="text-xl font-black tracking-[0.3em] uppercase italic text-white/90">TRANSFORMIX</h1>
          <div className="flex items-center justify-center gap-2">
            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"></div>
            <p className="text-zinc-500 font-black text-[8px] uppercase tracking-widest">Synchronizing Neural Core...</p>
          </div>
        </div>
      </div>
    );
  }

  if (currentStep === 'auth') {
    return (
      <>
        <Auth
          onLogin={handleLogin}
          onRegisterStart={handleRegisterStart}
          showToast={showToast}
        />
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </>
    );
  }

  if (currentStep === 'onboarding') {
    return (
      <>
        <Onboarding onComplete={handleOnboardingComplete} initialData={authData} />
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </>
    );
  }

  // Admin View — wrapped in Suspense; chunk only downloaded for admin users
  if (activeTab === 'admin' && profile.role === 'admin') {
    return (
      <>
        <Suspense fallback={<AdminLoadingScreen />}>
          <AdminPanel setActiveTab={setActiveTab} showToast={showToast} logout={handleLogout} />
        </Suspense>
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </>
    );
  }

  // User View (Layout Wrapped)
  const renderContent = () => {
    const commonProps = { profile, showToast, setProfile, setActiveTab };
    switch (activeTab) {
      case 'home':      return <Dashboard {...commonProps} />;
      case 'workout':   return <WorkoutSystem {...commonProps} />;
      case 'diet':      return <DietSystem {...commonProps} />;
      case 'progress':  return <ProgressTracking {...commonProps} />;
      case 'pass':      return <TransformixPass {...commonProps} />;
      case 'community': return <Community {...commonProps} />;
      case 'assistant': return <Assistant {...commonProps} />;
      case 'pricing':   return <Pricing {...commonProps} />;
      case 'rewards':   return <Rewards {...commonProps} />;
      case 'settings':  return <Settings {...commonProps} logout={handleLogout} />;
      default:          return <Dashboard {...commonProps} />;
    }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab} profile={profile}>
      {renderContent()}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </Layout>
  );
};

export default App;
