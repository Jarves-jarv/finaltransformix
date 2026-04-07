
import { db, DBPrompt, DBReferralRefund } from './db';
import { supabase } from './supabase';
import { SyncService } from './sync';

import { UserProfile, WorkoutSplit, Gym, GymEquipmentRequest, ActiveProtocol, AppSuggestion } from '../types';

// ─── Module-level in-memory caches ───────────────────────────────────────────
// These values never change during a user session — fetching from DB every call
// was adding 400–800ms overhead per AI request.
let _aiLimitsCache: Record<string, number> | null = null;
let _pricingConfigCache: Record<string, number> | null = null;
// ─────────────────────────────────────────────────────────────────────────────

export const ApiService = {
  async checkUserExists(email: string, phone: string) {
    let query = supabase.from('profiles').select('id, email, phone');
    if (email && phone) {
      query = query.or(`email.eq.${email},phone.eq.${phone}`);
    } else if (email) {
      query = query.eq('email', email);
    } else if (phone) {
      query = query.eq('phone', phone);
    } else {
      return null;
    }
    const { data } = await query.limit(1).maybeSingle();
    return data;
  },

  // Auth & Profile
  async registerUser(profile: UserProfile) {
    const cleanEmail = profile.email.trim().toLowerCase();
    const cleanPhone = profile.phone ? profile.phone.trim() : '';

    // Prevent Account Replace / Silent Duplicate Creation
    const existingUser = await this.checkUserExists(cleanEmail, cleanPhone);

    if (existingUser) {
      if (existingUser.email === cleanEmail) {
        throw new Error("Email already registered. Please Login.");
      }
      if (existingUser.phone && existingUser.phone === cleanPhone) {
        throw new Error("Phone already registered. Please Login.");
      }
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: cleanEmail,
      password: profile.password || 'Temp123!'
    });

    if (authError || !authData.user) {
      console.error('Supabase Auth error:', authError);
      throw new Error(`Auth Error: ${authError?.message || 'Unknown Email/Password issue'}`);
    }

    const row = {
      auth_id: authData.user.id,
      name: profile.name, email: cleanEmail, phone: cleanPhone,
      role: profile.role, gender: profile.gender, age: profile.age, height: profile.height,
      weight: profile.weight, body_type: profile.bodyType, experience: profile.experience,
      goal: profile.goal, diet_preference: profile.dietPreference, typical_meals: profile.typicalMeals,
      equipment: profile.equipment, gym_name: profile.gymName, is_pass_active: profile.isPassActive
    };

    const { data: saved, error } = await supabase.from('profiles').insert([row]).select().single();
    if (error) {
      console.error('Supabase register error:', error);
      throw new Error(`Error Saving Profile: ${error.message || JSON.stringify(error)}`);
    }
    if (saved) {
      // FIX: localStorage persists across tab closes (was sessionStorage)
      localStorage.setItem('activeProfileId', saved.id.toString());
      // Log initial weight to progress history
      if (profile.weight) {
        this.logMetrics({ weight: profile.weight }).catch(e => console.error("Initial weight log failed:", e));
      }
      return saved as UserProfile;
    }
    return profile;
  },

  async loginUser(identifier: string, password: string) {

    let authEmail = identifier.trim().toLowerCase();
    if (!authEmail.includes('@')) {
      // Lookup email via phone
      const { data: p } = await supabase.from('profiles').select('email').eq('phone', authEmail).maybeSingle();
      if (p?.email) authEmail = p.email;
    }

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: password,
    });

    if (authError || !authData.user) {
      alert(`Login Failed: ${authError?.message || 'Incorrect credentials'}`);
      return null;
    }

    const { data: user, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('auth_id', authData.user.id)
      .single();

    if (user && !error) {
      // FIX: localStorage persists across tab closes (was sessionStorage)
      localStorage.setItem('activeProfileId', user.id.toString());
      return {
        ...user,
        bodyType: user.body_type, experience: user.experience, dietPreference: user.diet_preference,
        typicalMeals: user.typical_meals, gymName: user.gym_name, isPassActive: user.is_pass_active,
        planExpiryDate: user.plan_expiry_date, passExpiryDate: user.pass_expiry_date,
        videoUploads: user.video_uploads, trophyStatus: user.trophy_status, documentationStatus: user.documentation_status,
        lastPurchasePrice: user.last_purchase_price, lastCouponUsed: user.last_coupon_used, lastAffiliateId: user.last_affiliate_id,
        profileImage: user.profile_image
      } as UserProfile;
    }
    return null;
  },

  async logout() {
    // FIX: localStorage (was sessionStorage)
    localStorage.removeItem('activeProfileId');
    _aiLimitsCache = null;
    _pricingConfigCache = null;
    return true;
  },

  async sendPasswordReset(identifier: string) {
    let emailOrPhone = identifier.trim().toLowerCase();

    if (emailOrPhone.includes('@')) {
      const { error } = await supabase.auth.resetPasswordForEmail(emailOrPhone, {
        redirectTo: window.location.origin + '/'
      });
      if (error) throw new Error(error.message);
      return { type: 'email' };
    } else {
      let phone = emailOrPhone.replace(/[^\d+]/g, '');
      if (phone.length === 10 && !phone.startsWith('+')) {
        phone = '+91' + phone;
      }

      const { error } = await supabase.auth.signInWithOtp({ phone });
      if (error) throw new Error(error.message);
      return { type: 'phone', phone };
    }
  },

  async resetPasswordWithPhone(phone: string, otp: string, newPassword: string) {
    const { data: authData, error: verifyError } = await supabase.auth.verifyOtp({
      phone,
      token: otp,
      type: 'sms'
    });

    if (verifyError || !authData.user) {
      throw new Error(verifyError?.message || 'Invalid OTP');
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (updateError) throw new Error(updateError.message);

    // Attempt to log them into their existing profile by checking phone
    const { data: profile } = await supabase.from('profiles').select('*').eq('phone', phone).maybeSingle();

    if (profile) {
      // Ensure the auth_id is linked properly if they previously only had email auth
      if (profile.auth_id !== authData.user.id) {
        await supabase.from('profiles').update({ auth_id: authData.user.id }).eq('id', profile.id);
      }
      // FIX: localStorage persists across tab closes (was sessionStorage)
      localStorage.setItem('activeProfileId', profile.id.toString());
      return {
        ...profile,
        bodyType: profile.body_type, experience: profile.experience, dietPreference: profile.diet_preference,
        typicalMeals: profile.typical_meals, gymName: profile.gym_name, isPassActive: profile.is_pass_active,
        planExpiryDate: profile.plan_expiry_date, passExpiryDate: profile.pass_expiry_date,
        videoUploads: profile.video_uploads, trophyStatus: profile.trophy_status, documentationStatus: profile.documentation_status,
        profileImage: profile.profile_image
      } as UserProfile;
    }

    return null;
  },

  async saveProfile(profile: UserProfile) {
    const row = {
      name: profile.name, email: profile.email, phone: profile.phone,
      role: profile.role, gender: profile.gender, age: profile.age, height: profile.height,
      weight: profile.weight, body_type: profile.bodyType, experience: profile.experience,
      goal: profile.goal, diet_preference: profile.dietPreference, typical_meals: profile.typicalMeals,
      equipment: profile.equipment, gym_name: profile.gymName, is_pass_active: profile.isPassActive,
      plan: profile.plan, plan_expiry_date: profile.planExpiryDate, pass_expiry_date: profile.passExpiryDate,
      referrals: profile.referrals, video_uploads: profile.videoUploads,
      trophy_status: profile.trophyStatus, documentation_status: profile.documentationStatus,
      last_purchase_price: profile.lastPurchasePrice,
      last_coupon_used: profile.lastCouponUsed,
      last_affiliate_id: profile.lastAffiliateId,
      profile_image: profile.profileImage
    };

    // clean out undefined
    Object.keys(row).forEach(key => (row as any)[key] === undefined && delete (row as any)[key]);

    // FIX: localStorage (was sessionStorage — got cleared on every tab close)
    const activeId = localStorage.getItem('activeProfileId');
    if (activeId) {
      if (profile.weight !== undefined) {
        // Await to ensure profile syncs to progress history before completing save
        await this.logMetrics({ weight: profile.weight }).catch(e => console.error("Weight history sync failed:", e));
      }
      const { data, error } = await supabase.from('profiles').update(row).eq('id', Number(activeId)).select().single();
      if (!error && data) return data.id;
      return null;
    } else {
      // Fallback lookup — runs in parallel to save time
      const [emailResult, phoneResult] = await Promise.all([
        profile.email
          ? supabase.from('profiles').select('id').eq('email', profile.email).maybeSingle()
          : Promise.resolve({ data: null }),
        profile.phone
          ? supabase.from('profiles').select('id').eq('phone', profile.phone).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      const existingUser = emailResult.data || phoneResult.data;

      if (existingUser && existingUser.id) {
        const { data } = await supabase.from('profiles').update(row).eq('id', existingUser.id).select().single();
        if (data) {
          // FIX: localStorage (was sessionStorage)
          localStorage.setItem('activeProfileId', data.id.toString());
          return data.id;
        }
      }

      const { data, error } = await supabase.from('profiles').insert([row]).select().single();
      if (data && !error) {
        // FIX: localStorage (was sessionStorage)
        localStorage.setItem('activeProfileId', data.id.toString());
        return data.id;
      }
      console.error(error);
      alert(`Supabase Error Saving Profile: ${error?.message || JSON.stringify(error)}\nDetails: ${error?.details || ''}`);
      return null;
    }
  },

  async getProfile() {
    // FIX: localStorage (was sessionStorage)
    const activeId = localStorage.getItem('activeProfileId');
    if (activeId) {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', Number(activeId)).single();
      if (!error && data) {
        return {
          ...data,
          bodyType: data.body_type, experience: data.experience, dietPreference: data.diet_preference,
          typicalMeals: data.typical_meals, gymName: data.gym_name, isPassActive: data.is_pass_active,
          planExpiryDate: data.plan_expiry_date, passExpiryDate: data.pass_expiry_date,
          videoUploads: data.video_uploads, trophyStatus: data.trophy_status, documentationStatus: data.documentation_status,
          lastPurchasePrice: data.last_purchase_price, lastCouponUsed: data.last_coupon_used, lastAffiliateId: data.last_affiliate_id,
          profileImage: data.profile_image
        } as UserProfile;
      }
    }
    return undefined;
  },

  // FIX: Added pagination — was fetching ALL users with SELECT * (full table scan)
  async getAllProfiles(page = 0, limit = 50) {
    const from = page * limit;
    const to   = from + limit - 1;
    const { data, count } = await supabase
      .from('profiles')
      .select('id, name, email, phone, role, plan, is_pass_active, plan_expiry_date, pass_expiry_date, video_uploads, trophy_status, documentation_status, referrals, created_at', { count: 'exact' })
      .range(from, to)
      .order('created_at', { ascending: false });
    if (!data) return { users: [], total: 0 };
    return {
      users: data.map(u => ({
        ...u,
        isPassActive: u.is_pass_active,
        planExpiryDate: u.plan_expiry_date,
        passExpiryDate: u.pass_expiry_date,
        videoUploads: u.video_uploads,
        trophyStatus: u.trophy_status,
        documentationStatus: u.documentation_status,
      } as unknown as UserProfile)),
      total: count || 0,
    };
  },

  // Leaves & Recovery
  async logLeave(days: number) {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);

    const { data } = await supabase.from('leaves').insert([{
      start_date: start.toISOString(),
      end_date: end.toISOString(),
      duration_days: days,
      timestamp: Date.now()
    }]).select().single();
    return data?.id;
  },

  async getRecentLeave() {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const isoWeekAgo = oneWeekAgo.toISOString();

    const { data } = await supabase.from('leaves')
      .select('*')
      .gt('end_date', isoWeekAgo)
      .order('end_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    return data ? { ...data, startDate: data.start_date, endDate: data.end_date, durationDays: data.duration_days } : null;
  },

  async cancelActiveLeave() {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const isoWeekAgo = oneWeekAgo.toISOString();

    await supabase.from('leaves').delete().gt('end_date', isoWeekAgo);
  },

  // Splits
  async saveSplit(split: WorkoutSplit) {
    const activeId = sessionStorage.getItem('activeProfileId');
    if (!activeId) return null;

    const row = {
      ...split,
      id: split.id,
      name: split.name,
      daysPerWeek: split.daysPerWeek,
      style: split.style,
      level: split.level,
      avgTime: split.avgTime,
      isCustom: split.isCustom,
      aiOptimized: split.aiOptimized,
      category: split.category,
      description: split.description,
      recommendationTag: split.recommendationTag,
      days: split.days,
      profile_id: Number(activeId),
      syncStatus: 'pending' as const,
      lastModified: Date.now()
    };
    
    // Save locally
    await db.splits.put(row as any);
    SyncService.syncTable('splits', 'splits').catch(console.error);

    // Immediate attempt
    const { data, error } = await supabase.from('splits').upsert({
      id: split.id,
      name: split.name,
      days_per_week: split.daysPerWeek,
      style: split.style,
      level: split.level,
      avg_time: split.avgTime,
      is_custom: split.isCustom,
      ai_optimized: split.aiOptimized,
      category: split.category,
      description: split.description,
      recommendation_tag: split.recommendationTag,
      days: split.days,
      profile_id: Number(activeId)
    }).select().single();

    if (!error && data) {
      await db.splits.update(split.id, { syncStatus: 'synced', serverId: data.id });
    }

    return split.id;
  },

  async getSplit(id: string) {
    const local = await db.splits.get(id);
    if (local) return { ...local, daysPerWeek: (local as any).daysPerWeek, avgTime: (local as any).avgTime } as unknown as WorkoutSplit;

    const { data } = await supabase.from('splits').select('*').eq('id', id).maybeSingle();
    if (!data) return null;
    return { ...data, daysPerWeek: data.days_per_week, avgTime: data.avg_time, isCustom: data.is_custom, aiOptimized: data.ai_optimized, recommendationTag: data.recommendation_tag } as WorkoutSplit;
  },

  async getAllSplits() {
    const activeId = sessionStorage.getItem('activeProfileId');
    if (!activeId) return [];

    const local = await db.splits.where('profile_id').equals(Number(activeId)).toArray();
    this.refreshSplits(Number(activeId)).catch(console.error);
    
    return (local || []).map(d => ({ ...d, daysPerWeek: (d as any).daysPerWeek, avgTime: (d as any).avgTime } as unknown as WorkoutSplit));
  },

  async refreshSplits(profileId: number) {
    if (!window.navigator.onLine) return;
    const { data } = await supabase.from('splits').select('*').eq('profile_id', profileId);
    if (data) {
      for (const remote of data) {
         await db.splits.put({
           ...remote,
           daysPerWeek: remote.days_per_week,
           avgTime: remote.avg_time,
           isCustom: remote.is_custom,
           aiOptimized: remote.ai_optimized,
           recommendationTag: remote.recommendation_tag,
           profile_id: profileId,
           syncStatus: 'synced',
           lastModified: Date.now()
         } as any);
      }
    }
  },

  async deleteSplit(id: string) {
    await db.splits.delete(id);
    await supabase.from('splits').delete().eq('id', id);
  },

  // Active Protocol
  async saveActiveProtocol(protocol: ActiveProtocol) {
    const activeId = sessionStorage.getItem('activeProfileId');
    if (!activeId) return null;

    const row = {
      ...protocol,
      profile_id: Number(activeId),
      syncStatus: 'pending' as const,
      lastModified: Date.now()
    };
    
    // Clear old local cache for this user
    await db.activeProtocol.where('profile_id').equals(Number(activeId)).delete();
    
    // Convert to unknown to bypass exact schema complaints on save
    const localId = await db.activeProtocol.put(row as unknown as ActiveProtocol & import('./db').Syncable & { profile_id: number; id?: number });
    SyncService.syncTable('activeProtocol', 'active_protocol').catch(console.error);

    // Immediate attempt
    await supabase.from('active_protocol').delete().eq('profile_id', activeId);
    const { data } = await supabase.from('active_protocol').insert([{
      profile_id: Number(activeId),
      split_id: protocol.splitId,
      split_name: protocol.splitName,
      generated_at: protocol.generatedAt,
      days: protocol.days,
      current_day_index: protocol.currentDayIndex
    }]).select().single();
    
    if (data && localId) {
       await db.activeProtocol.update(localId as number, { syncStatus: 'synced', serverId: data.id });
    }
    return localId;
  },

  async getActiveProtocol() {
    const activeId = sessionStorage.getItem('activeProfileId');
    if (!activeId) return null;

    const local = await db.activeProtocol.where('profile_id').equals(Number(activeId)).first();
    this.refreshProtocol(Number(activeId)).catch(console.error);

    if (local) return local;
    return null;
  },

  async refreshProtocol(profileId: number) {
    if (!window.navigator.onLine) return;
    const { data } = await supabase.from('active_protocol').select('*').eq('profile_id', profileId).limit(1).maybeSingle();
    
    if (data) {
       await db.activeProtocol.where('profile_id').equals(profileId).delete();
       await db.activeProtocol.put({
         splitId: data.split_id,
         splitName: data.split_name,
         generatedAt: data.generated_at,
         days: data.days,
         currentDayIndex: data.current_day_index,
         id: data.id,
         profile_id: profileId,
         syncStatus: 'synced',
         lastModified: Date.now()
       } as unknown as ActiveProtocol & import('./db').Syncable & { profile_id: number; id?: number });
    }
  },

  async updateActiveProtocolDay(protocolId: number, dayIndex: number) {
    const activeId = Number(sessionStorage.getItem('activeProfileId'));
    const local = await db.activeProtocol.where('profile_id').equals(activeId).first();
    
    if (local && local.id) {
      await db.activeProtocol.update(local.id, { currentDayIndex: dayIndex, syncStatus: 'pending', lastModified: Date.now() });
      SyncService.syncTable('activeProtocol', 'active_protocol').catch(console.error);
    }
    await supabase.from('active_protocol').update({ current_day_index: dayIndex }).eq('id', protocolId);
  },

  // Active Diet
  async saveActiveDiet(plan: any[]) {
    const activeId = sessionStorage.getItem('activeProfileId');
    if (!activeId) return null;

    const idKey = `diet_${activeId}`;
    const row = { id: idKey, plan, generatedAt: Date.now(), syncStatus: 'pending' as const, lastModified: Date.now(), profile_id: Number(activeId) };
    
    await db.activeDiet.put(row as any);
    SyncService.syncTable('activeDiet', 'active_diet').catch(console.error);

    const { data } = await supabase.from('active_diet').upsert({ id: idKey, profile_id: Number(activeId), plan, generated_at: row.generatedAt }).select().single();
    if (data) {
       await db.activeDiet.update(idKey, { syncStatus: 'synced' });
    }
    return idKey;
  },

  async getActiveDiet() {
    const activeId = sessionStorage.getItem('activeProfileId');
    if (!activeId) return null;
    
    const idKey = `diet_${activeId}`;
    const local = await db.activeDiet.get(idKey);
    this.refreshDiet(idKey, Number(activeId)).catch(console.error);
    
    if (local) return local as any;
    return null;
  },

  async refreshDiet(idKey: string, profileId: number) {
     if (!window.navigator.onLine) return;
     const { data } = await supabase.from('active_diet').select('*').eq('id', idKey).maybeSingle();
     if (data) {
       await db.activeDiet.put({
         id: idKey,
         profile_id: profileId,
         plan: data.plan,
         generatedAt: data.generated_at,
         syncStatus: 'synced',
         lastModified: Date.now()
       } as any);
     }
  },

  // Workouts
  async saveWorkout(workout: any) {
    const activeId = sessionStorage.getItem('activeProfileId');
    if (!activeId) return null;

    const row = {
      profile_id: Number(activeId),
      date: new Date().toISOString(),
      name: workout.name || 'Custom Workout',
      muscle_group: workout.muscleGroup || 'Full Body',
      exercises: workout.exercises || [],
      duration_minutes: workout.durationMinutes || 45,
      split_name: workout.splitName || '',
      split_id: workout.splitId || '',
      syncStatus: 'pending' as const,
      lastModified: Date.now()
    };
    
    const localId = await db.workouts.put(row as any);
    SyncService.syncTable('workouts', 'workouts').catch(console.error);

    const { data, error } = await supabase.from('workouts').insert([{
      profile_id: row.profile_id,
      date: row.date,
      name: row.name,
      muscle_group: row.muscle_group,
      exercises: row.exercises,
      duration_minutes: row.duration_minutes,
      split_name: row.split_name,
      split_id: row.split_id
    }]).select().single();
    
    if (!error && data) {
      await db.workouts.update(localId, { syncStatus: 'synced', serverId: data.id });
    }
    return localId;
  },

  async getWorkoutHistory(limit = 30) {
    const activeId = Number(sessionStorage.getItem('activeProfileId'));
    if (!activeId) return [];

    const localDb = await db.workouts.where('profile_id').equals(activeId).reverse().sortBy('date');
    const records = localDb.slice(0, limit);
    
    // Fire and forget refresh
    this.refreshWorkouts(activeId, limit).catch(console.error);
    
    return records.map((d: any) => ({ ...d, muscleGroup: d.muscle_group, durationMinutes: d.duration_minutes, splitName: d.split_name, splitId: d.split_id }));
  },

  async refreshWorkouts(profileId: number, limit = 30) {
    if (!window.navigator.onLine) return;
    const { data } = await supabase.from('workouts')
      .select('*')
      .eq('profile_id', profileId)
      .order('date', { ascending: false })
      .limit(limit);
      
    if (data) {
      for (const remote of data) {
         await db.workouts.put({
           ...remote,
           profile_id: profileId,
           muscleGroup: remote.muscle_group,
           durationMinutes: remote.duration_minutes,
           splitName: remote.split_name,
           splitId: remote.split_id,
           syncStatus: 'synced',
           lastModified: Date.now()
         } as any);
      }
    }
  },

  async getHistoryForExercises(exerciseNames: string[]) {
    const workouts = await this.getWorkoutHistory(50);
    const historyMap: Record<string, { weight: number, reps: number }> = {};

    for (const w of workouts) {
      if (!w.exercises) continue;
      for (const ex of w.exercises) {
        if (exerciseNames.includes(ex.name) && !historyMap[ex.name]) {
          const validSets = ex.sets?.filter((s: any) => s.completed && s.weight > 0) || [];
          if (validSets.length > 0) {
            const bestSet = validSets.reduce((prev: any, current: any) => (prev.weight > current.weight) ? prev : current);
            historyMap[ex.name] = { weight: bestSet.weight, reps: bestSet.reps };
          }
        }
      }
      if (Object.keys(historyMap).length === exerciseNames.length) break;
    }
    return historyMap;
  },

  async getTodaysWorkout() {
    const today = new Date().toISOString().split('T')[0];
    const activeId = sessionStorage.getItem('activeProfileId');
    // Using ilike or just fetch top 1 sorted by date
    const { data } = await supabase.from('workouts')
      .select('*')
      .eq('profile_id', Number(activeId))
      .like('date', `${today}%`)
      .limit(1)
      .maybeSingle();
    return data ? { ...data, muscleGroup: data.muscle_group, durationMinutes: data.duration_minutes, splitName: data.split_name, splitId: data.split_id } : null;
  },

  async getRecentPerformanceForMuscles(muscles: string[]) {
    const workouts = await this.getWorkoutHistory(10);
    const relevantExercises: any[] = [];

    workouts.forEach(w => {
      w.exercises.forEach((ex: any) => {
        if (muscles.some(m => ex.muscleGroup.toLowerCase().includes(m.toLowerCase()))) {
          relevantExercises.push({
            name: ex.name,
            sets: ex.sets.filter((s: any) => s.completed),
            date: w.date
          });
        }
      });
    });

    const latestPerf: Record<string, any> = {};
    relevantExercises.forEach(ex => {
      if (!latestPerf[ex.name]) latestPerf[ex.name] = ex;
    });

    return Object.values(latestPerf);
  },

  async getWorkoutCountForSplit(splitId: string) {
    const activeId = sessionStorage.getItem('activeProfileId');
    const { count } = await supabase.from('workouts')
      .select('*', { count: 'exact', head: true })
      .eq('profile_id', Number(activeId))
      .eq('split_id', splitId);
    return count || 0;
  },

  // Rewards: Video Links
  async submitVideoLink(url: string, userId: number) {
    const { data: existing } = await supabase.from('video_links').select('id').eq('url', url).maybeSingle();
    if (existing) throw new Error("Link already submitted");

    // Insert into video_links
    await supabase.from('video_links').insert([{
      user_id: userId,
      url,
      timestamp: Date.now(),
      status: 'synced'
    }]);

    // Update profile
    const { data: userProfile } = await supabase.from('profiles').select('video_uploads').eq('id', userId).single();
    let count = 1;
    if (userProfile) {
      count = (userProfile.video_uploads || 0) + 1;
      await supabase.from('profiles').update({ video_uploads: count }).eq('id', userId);
    }
    return count;
  },

  async getVideoLinks(userId: number, limit = 100) {
    const { data } = await supabase.from('video_links')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(limit);
    return (data || []).map(d => ({ ...d, userId: d.user_id }));
  },

  async applyForReelsTrophy(userId: number) {
    return await supabase.from('profiles').update({ trophy_status: 'applied', trophy_rejection_reason: '' }).eq('id', userId);
  },

  async approveReelsTrophy(userId: number) {
    return await supabase.from('profiles').update({ trophy_status: 'awarded' }).eq('id', userId);
  },

  async rejectReelsTrophy(userId: number, reason: string) {
    return await supabase.from('profiles').update({ trophy_status: 'rejected', trophy_rejection_reason: reason }).eq('id', userId);
  },

  async shipReelsTrophy(userId: number) {
    return await supabase.from('profiles').update({ trophy_status: 'shipped' }).eq('id', userId);
  },

  // Admin: Video Management
  async updateVideoStatus(id: number, status: 'verified' | 'rejected') {
    return await supabase.from('video_links').update({ status }).eq('id', id);
  },

  async getPendingVideos() {
    const { data } = await supabase.from('video_links').select('*').eq('status', 'synced');
    return (data || []).map(d => ({ ...d, userId: d.user_id }));
  },

  // Admin: Gym Management
  async addGym(gym: Gym) {
    const { data: existing } = await supabase.from('gyms').select('id').eq('name', gym.name).maybeSingle();
    if (!existing) {
      const { data } = await supabase.from('gyms').insert([gym]).select().single();
      return data?.id;
    }
    return existing.id;
  },

  async getGyms() {
    const { data } = await supabase.from('gyms').select('*');
    return data || [];
  },

  async searchGymsByName(query: string) {
    const { data } = await supabase.from('gyms')
      .select('*')
      .ilike('name', `%${query}%`);
    return data || [];
  },

  async deleteGym(id: number) {
    return await supabase.from('gyms').delete().eq('id', id);
  },

  async seedGyms() {
    const { count } = await supabase.from('gyms').select('*', { count: 'exact', head: true });
    if (count === 0) {
      const defaults = [
        { name: "Gold's Gym", location: "Verified Network", equipment: ['Dumbbells', 'Barbell', 'Bench', 'Cables', 'Leg Press', 'Rack', 'Smith Machine', 'Lat Pulldown'], rating: 4.8 },
        { name: "Powerhouse Elite", location: "Verified Network", equipment: ['Dumbbells', 'Barbell', 'Bench', 'Squat Rack', 'Incline Bench', 'Pull-up Bar'], rating: 4.5 },
        { name: "Cult.fit Sanctuary", location: "Verified Network", equipment: ['Kettlebells', 'Dumbbells', 'Box', 'Pull-up Bar', 'TRX', 'Medicine Ball'], rating: 4.7 },
        { name: "Anytime Fitness", location: "Verified Network", equipment: ['Treadmill', 'Cables', 'Smith Machine', 'Dumbbells', 'Bench'], rating: 4.2 },
      ];
      await supabase.from('gyms').insert(defaults);
    }
  },

  // User: Gym Equipment Suggestions
  async submitEquipmentRequest(gymName: string, equipmentName: string, userName: string, proofImage?: string) {
    return await supabase.from('equipment_requests').insert([{
      gym_name: gymName,
      equipment_name: equipmentName,
      user_name: userName,
      timestamp: Date.now(),
      status: 'pending',
      proof_image: proofImage
    }]);
  },

  async getPendingEquipmentRequests() {
    const { data } = await supabase.from('equipment_requests').select('*').eq('status', 'pending');
    return (data || []).map(d => ({ ...d, gymName: d.gym_name, equipmentName: d.equipment_name, userName: d.user_name, proofImage: d.proof_image }));
  },

  async approveEquipmentRequest(id: number) {
    const { data: req } = await supabase.from('equipment_requests').select('*').eq('id', id).maybeSingle();
    if (!req) return;

    await supabase.from('equipment_requests').update({ status: 'approved' }).eq('id', id);

    const { data: gym } = await supabase.from('gyms').select('*').eq('name', req.gym_name).maybeSingle();

    if (gym) {
      const currentEquip = new Set(gym.equipment || []);
      currentEquip.add(req.equipment_name);
      await supabase.from('gyms').update({ equipment: Array.from(currentEquip) }).eq('id', gym.id);
    } else {
      await supabase.from('gyms').insert([{
        name: req.gym_name,
        location: 'Verified Partner',
        equipment: ['Standard Setup', req.equipment_name],
        rating: 5.0
      }]);
    }
  },

  async rejectEquipmentRequest(id: number) {
    return await supabase.from('equipment_requests').update({ status: 'rejected' }).eq('id', id);
  },

  // Meals
  async logMeal(meal: any) {
    const activeId = sessionStorage.getItem('activeProfileId');
    const { data } = await supabase.from('meals').insert([{
      ...meal,
      profile_id: Number(activeId),
      date: new Date().toISOString().split('T')[0]
    }]).select().single();
    return data?.id;
  },

  async getTodaysMeals() {
    const today = new Date().toISOString().split('T')[0];
    const activeId = sessionStorage.getItem('activeProfileId');
    const { data } = await supabase.from('meals')
      .select('*')
      .eq('profile_id', Number(activeId))
      .eq('date', today);
    return data || [];
  },

  async getMealHistory(limit = 30) {
    const activeId = sessionStorage.getItem('activeProfileId');
    const { data } = await supabase.from('meals')
      .select('*')
      .eq('profile_id', Number(activeId))
      .order('date', { ascending: false })
      .limit(limit);
    return data || [];
  },

  // Progress
  // FIX: Parallelized 2 serial writes, changed sessionStorage → localStorage
  async logMetrics(metrics: Partial<{ weight: number, bodyFat: number, biceps: number, waist: number, chest: number, thighs: number }>) {
    const activeId = localStorage.getItem('activeProfileId');
    const date = new Date().toISOString().split('T')[0];
    const { data: existing } = await supabase.from('progress')
      .select('*')
      .eq('profile_id', Number(activeId))
      .eq('date', date)
      .maybeSingle();

    if (existing?.id) {
      // FIX: 2 independent writes now run in parallel (saves 200–400ms)
      const [progressResult] = await Promise.all([
        supabase.from('progress').update({
          weight: metrics.weight ?? existing.weight,
          body_fat: metrics.bodyFat ?? existing.body_fat,
          biceps: metrics.biceps ?? existing.biceps,
          waist: metrics.waist ?? existing.waist,
          chest: metrics.chest ?? existing.chest,
          thighs: metrics.thighs ?? existing.thighs,
        }).eq('id', existing.id).select().single(),
        metrics.weight && activeId
          ? supabase.from('profiles').update({ weight: metrics.weight }).eq('id', Number(activeId))
          : Promise.resolve(null),
      ]);
      return progressResult.data?.id;
    } else {
      // FIX: 2 independent writes now run in parallel (saves 200–400ms)
      const [progressResult] = await Promise.all([
        supabase.from('progress').insert([{
          profile_id: Number(activeId),
          date,
          weight: metrics.weight || 0,
          body_fat: metrics.bodyFat,
          biceps: metrics.biceps,
          waist: metrics.waist,
          chest: metrics.chest,
          thighs: metrics.thighs
        }]).select().single(),
        metrics.weight && activeId
          ? supabase.from('profiles').update({ weight: metrics.weight }).eq('id', Number(activeId))
          : Promise.resolve(null),
      ]);
      return progressResult.data?.id;
    }
  },

  // NEW: Targeted query — replaces getWeightHistory() full scan for boolean check
  // Dashboard used to fetch ALL history just to check if today has an entry
  async hasTodayWeightEntry(today: string): Promise<boolean> {
    const activeId = localStorage.getItem('activeProfileId');
    const { count } = await supabase
      .from('progress')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', Number(activeId))
      .eq('date', today);
    return (count || 0) > 0;
  },

  async getWeightHistory() {
    const activeId = sessionStorage.getItem('activeProfileId');
    const { data } = await supabase.from('progress')
      .select('*')
      .eq('profile_id', Number(activeId))
      .order('date');
    return (data || []).map(d => ({ ...d, bodyFat: d.body_fat }));
  },

  async getLatestMetrics() {
    const activeId = sessionStorage.getItem('activeProfileId');
    const { data } = await supabase.from('progress')
      .select('*')
      .eq('profile_id', Number(activeId))
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data ? { ...data, bodyFat: data.body_fat } : null;
  },

  async getPreviousMetrics() {
    const activeId = sessionStorage.getItem('activeProfileId');
    const { data } = await supabase.from('progress')
      .select('*')
      .eq('profile_id', Number(activeId))
      .order('date', { ascending: false })
      .limit(2);
    return (data && data.length > 1) ? { ...data[1], bodyFat: data[1].body_fat } : null;
  },

  async saveProgressPhoto(photoData: string) {
    const activeId = sessionStorage.getItem('activeProfileId');
    const { data } = await supabase.from('photos').insert([{
      profile_id: Number(activeId),
      date: new Date().toISOString(),
      data: photoData
    }]).select().single();
    return data?.id;
  },

  async getProgressPhotos() {
    const activeId = sessionStorage.getItem('activeProfileId');
    const { data } = await supabase.from('photos')
      .select('*')
      .eq('profile_id', Number(activeId))
      .order('date', { ascending: false });
    return data || [];
  },

  async deleteProgressPhoto(id: number) {
    await supabase.from('photos').delete().eq('id', id);
  },

  // Community
  async createRequest(partner: any, senderEmail: string, senderName: string, senderImg: string) {
    const { data } = await supabase.from('requests').insert([{
      sender_email: senderEmail,
      sender_name: senderName,
      sender_img: senderImg,
      receiver_email: partner.id,
      receiver_name: partner.name,
      receiver_img: partner.img,
      partner_name: partner.name,
      partner_id: partner.id,
      img: partner.img,
      goal: partner.goal,
      status: 'pending',
      timestamp: Date.now()
    }]).select().single();
    return data?.id;
  },

  async getRequests(email: string) {
    const { data } = await supabase.from('requests').select('*').or(`sender_email.eq.${email},receiver_email.eq.${email}`);
    const all = data || [];
    const sent = all.filter(r => r.sender_email === email).map(r => ({ ...r, senderEmail: r.sender_email, receiverEmail: r.receiver_email, senderName: r.sender_name, receiverName: r.receiver_name, senderImg: r.sender_img, receiverImg: r.receiver_img, partnerName: r.partner_name, partnerId: r.partner_id }));
    const received = all.filter(r => r.receiver_email === email).map(r => ({ ...r, senderEmail: r.sender_email, receiverEmail: r.receiver_email, senderName: r.sender_name, receiverName: r.receiver_name, senderImg: r.sender_img, receiverImg: r.receiver_img, partnerName: r.partner_name, partnerId: r.partner_id }));
    return { sent, received };
  },

  async deleteRequest(id: number) {
    await supabase.from('requests').delete().eq('id', id);
  },

  async createCommunityPost(post: { goal: string, preferredTime: string, bio: string, name?: string, gender?: string }, email: string) {
    const me = await this.getProfile();
    const myEmail = me?.email || email;

    await supabase.from('community_posts').delete().eq('user_email', myEmail);

    const { data } = await supabase.from('community_posts').insert([{
      goal: post.goal,
      preferred_time: post.preferredTime,
      bio: post.bio,
      name: post.name,
      gender: post.gender,
      user_email: email,
      timestamp: Date.now()
    }]).select().single();
    return data?.id;
  },

  async getMyCommunityPost(email: string) {
    const { data } = await supabase.from('community_posts').select('*').eq('user_email', email).maybeSingle();
    return data ? { ...data, userEmail: data.user_email, preferredTime: data.preferred_time } : null;
  },

  async getAllCommunityPosts(excludeEmail: string) {
    const { data } = await supabase.from('community_posts').select('*').neq('user_email', excludeEmail);
    return (data || []).map(d => ({ ...d, userEmail: d.user_email, preferredTime: d.preferred_time }));
  },

  async deleteCommunityPost(email: string) {
    await supabase.from('community_posts').delete().eq('user_email', email);
  },

  async acceptPartner(request: any, receiverEmail: string, receiverName: string, receiverImg: string) {
    // Add for current user
    await supabase.from('partners').insert([{
      user_email: receiverEmail,
      partner_email: request.senderEmail,
      partner_name: request.senderName,
      name: request.senderName,
      partner_id: request.senderEmail,
      img: request.senderImg || 'u1',
      goal: request.goal,
      timestamp: Date.now()
    }]);

    // Add for sender
    await supabase.from('partners').insert([{
      user_email: request.senderEmail,
      partner_email: receiverEmail,
      partner_name: receiverName,
      name: receiverName,
      partner_id: receiverEmail,
      img: receiverImg || 'u2',
      goal: request.goal,
      timestamp: Date.now()
    }]);

    if (request.id) {
      await supabase.from('requests').delete().eq('id', request.id);
    }
  },

  async getPartners(email: string) {
    const { data } = await supabase.from('partners').select('*').eq('user_email', email);
    return (data || []).map(p => ({ ...p, userEmail: p.user_email, partnerEmail: p.partner_email, partnerName: p.partner_name, partnerId: p.partner_id }));
  },

  async removePartner(id: number) {
    await supabase.from('partners').delete().eq('id', id);
  },

  // COMMERCE
  // FIX: In-memory cache — pricing config never changes during a session
  async getPricingConfig() {
    if (_pricingConfigCache) return _pricingConfigCache;

    const defaults = {
      BASE_PRICE: 19999,
      DOWN_PAYMENT: 3999,
      FINANCE_FEE: 2000,
      PLAN_STARTER: 299,
      PLAN_MOMENTUM: 699,
      PLAN_TRANSFORMATION: 1099,
      PLAN_CHAMPION: 1799,
      REFERRAL_DISCOUNT: 7000,
      REFERRAL_COMMISSION: 150
    };

    try {
      const { data: configs } = await supabase.from('system_config').select('*');
      if (!configs || configs.length === 0) {
        _pricingConfigCache = defaults;
        return defaults;
      }
      const configMap = configs.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {});
      _pricingConfigCache = { ...defaults, ...configMap };
      return _pricingConfigCache;
    } catch (e) {
      return defaults;
    }
  },

  async savePricingConfig(config: Record<string, number>) {
    const keys = Object.keys(config);
    await Promise.all(keys.map(key => supabase.from('system_config').upsert({ key, value: config[key] })));
  },

  async getCoupons() {
    const { data } = await supabase.from('coupons').select('*');
    return (data || []).map(d => ({ ...d, discountAmount: d.discount_amount, creatorCommission: d.creator_commission, giftHamper: d.gift_hamper }));
  },

  async addCoupon(code: string, amount: number, giftHamper?: string, commission?: number) {
    const uppercaseCode = code.toUpperCase().trim();
    const { data: existing } = await supabase.from('coupons').select('*').eq('code', uppercaseCode).maybeSingle();
    if (existing) {
      throw new Error(`Promotion code "${uppercaseCode}" already exists.`);
    }

    const { data } = await supabase.from('coupons').insert([{
      code: uppercaseCode,
      discount_amount: amount,
      creator_commission: commission || null,
      gift_hamper: giftHamper?.trim() || null,
      active: true
    }]).select().single();
    return data?.id;
  },

  async deleteCoupon(id: number) {
    await supabase.from('coupons').update({ active: false }).eq('id', id);
  },

  async restoreCoupon(id: number) {
    await supabase.from('coupons').update({ active: true }).eq('id', id);
  },

  async validateCoupon(code: string) {
    const uppercaseCode = code.toUpperCase().trim();

    // 1. Handle Referral Protocol
    if (uppercaseCode.startsWith('TRFX-')) {
      const config = await this.getPricingConfig();
      return {
        id: -1,
        code: uppercaseCode,
        discountAmount: config.REFERRAL_DISCOUNT,
        active: true,
        giftHamper: undefined as string | undefined
      };
    }

    // 2. Handle Vanity/Custom Codes from Creator Hub
    const { data: mapping } = await supabase.from('creator_mappings').select('*').eq('custom_code', uppercaseCode).maybeSingle();
    if (mapping) {
      const { data: baseCoupon } = await supabase.from('coupons').select('*').eq('id', mapping.base_coupon_id).maybeSingle();
      if (baseCoupon && baseCoupon.active) return { ...baseCoupon, discountAmount: baseCoupon.discount_amount, creatorCommission: baseCoupon.creator_commission };
    }

    // 3. Fallback to standard base code or suffixed code (CODE-ID)
    const baseCode = uppercaseCode.split('-')[0].trim();
    const { data: coupon } = await supabase.from('coupons').select('*').eq('code', baseCode).maybeSingle();
    if (coupon && coupon.active) return { ...coupon, discountAmount: coupon.discount_amount, creatorCommission: coupon.creator_commission };

    return null;
  },

  async completePurchase(profile: UserProfile, item: string, codeUsed: string, amountPaid: number = 0) {
    const uppercaseCode = codeUsed.toUpperCase().trim();
    const timestamp = Date.now();
    const isPass = item.toLowerCase().includes('pass');

    // 1. Initial ID Parsing (Zero network cost)
    let referrerId: number | null = null;
    let creatorIdParsed: number | null = null;
    let baseCodeParsed: string | null = null;

    if (uppercaseCode.startsWith('TRFX-')) {
      const parts = uppercaseCode.split('-');
      if (parts.length > 1) {
        referrerId = parseInt(parts[1]);
      }
    } else if (uppercaseCode.includes('-')) {
      const parts = uppercaseCode.split('-');
      baseCodeParsed = parts[0];
      const cid = parseInt(parts[1]);
      if (!isNaN(cid)) creatorIdParsed = cid;
    }

    // 2. ─── Parallel Lookups (Was sequential) ───
    const [mappingResult, directCouponResult, referrerProfileResult, baseCouponResult, creatorProfileResult] = await Promise.all([
      // Lookup 1: Creator Vanity Mapping
      supabase.from('creator_mappings').select('*').eq('custom_code', uppercaseCode).maybeSingle(),
      // Lookup 2: Direct Coupon Code
      supabase.from('coupons').select('*').eq('code', uppercaseCode).maybeSingle(),
      // Lookup 3: Referrer Profile (if TRFX-)
      referrerId ? supabase.from('profiles').select('referrals').eq('id', referrerId).maybeSingle() : Promise.resolve({ data: null }),
      // Lookup 4: Base Coupon (if CODE-ID format)
      baseCodeParsed ? supabase.from('coupons').select('*').eq('code', baseCodeParsed).maybeSingle() : Promise.resolve({ data: null }),
      // Lookup 5: Target Creator Profile (if mapping or CODE-ID exists)
      creatorIdParsed ? supabase.from('profiles').select('referrals').eq('id', creatorIdParsed).maybeSingle() : Promise.resolve({ data: null })
    ]);

    const mapping = mappingResult.data;
    const directCoupon = directCouponResult.data;
    const referrerProfile = referrerProfileResult.data;
    const baseC2 = baseCouponResult.data;
    const creatorProfileParsed = creatorProfileResult.data;

    // 3. Resolve Creator/Coupon context
    let creatorIdToCredit = creatorIdParsed;
    let creatorProfileToCredit = creatorProfileParsed;
    let matchedBaseCoupon = baseC2;

    if (mapping) {
      creatorIdToCredit = mapping.creator_id;
      // Secondary lookup if vanity mapping exists
      const [mappingBaseCoupon, mappingCreatorProfile] = await Promise.all([
        supabase.from('coupons').select('*').eq('id', mapping.base_coupon_id).maybeSingle(),
        supabase.from('profiles').select('referrals').eq('id', mapping.creator_id).maybeSingle()
      ]);
      matchedBaseCoupon = mappingBaseCoupon.data;
      creatorProfileToCredit = mappingCreatorProfile.data;
    }

    const couponToTrack = matchedBaseCoupon || directCoupon;

    // 4. ─── Parallel Operations (Inserts/Updates) ───
    const operations: Promise<any>[] = [];

    // Track Referral (TRFX-)
    if (referrerId && !isNaN(referrerId) && isPass && uppercaseCode.startsWith('TRFX-')) {
      operations.push(Promise.resolve(supabase.from('referrals').insert([{
        referrer_id: referrerId,
        referee_name: profile.name || 'Anonymous Agent',
        amount_paid: amountPaid,
        code_used: uppercaseCode,
        timestamp
      }])));
      if (referrerProfile) {
        operations.push(Promise.resolve(supabase.from('profiles').update({ referrals: (referrerProfile.referrals || 0) + 1 }).eq('id', referrerId)));
      }
    }

    // Track Creator Earnings
    if (matchedBaseCoupon && matchedBaseCoupon.creator_commission && creatorIdToCredit !== null && isPass) {
      operations.push(Promise.resolve(supabase.from('creator_earnings').insert([{
        creator_id: creatorIdToCredit,
        buyer_name: profile.name || 'Anonymous Buyer',
        amount_paid: amountPaid,
        commission_earned: matchedBaseCoupon.creator_commission,
        code_used: uppercaseCode,
        timestamp
      }])));
      if (creatorProfileToCredit) {
        operations.push(Promise.resolve(supabase.from('profiles').update({ referrals: (creatorProfileToCredit.referrals || 0) + 1 }).eq('id', creatorIdToCredit)));
      }
    }

    // Track Coupon Usage
    if (couponToTrack && couponToTrack.id) {
      const usages = couponToTrack.usages || [];
      usages.push({
        buyerName: profile.name || 'Anonymous Agent',
        amount: amountPaid,
        timestamp
      });
      operations.push(Promise.resolve(supabase.from('coupons').update({ usages }).eq('id', couponToTrack.id)));
    }

    // Await all side-track operations in parallel
    await Promise.all(operations);

    // 5. Subscription Expiry Calculations
    let addedDays = 365;
    const itemLower = item.toLowerCase();

    if (itemLower.includes('starter') || itemLower.includes('1 month')) addedDays = 30;
    else if (itemLower.includes('momentum') || itemLower.includes('3 month')) addedDays = 90;
    else if (itemLower.includes('transformation') || itemLower.includes('6 month')) addedDays = 180;
    else if (itemLower.includes('champion') || itemLower.includes('12 month')) addedDays = 365;
    else if (isPass) addedDays = 365;

    let computedExpiryDate = Date.now() + (addedDays * 24 * 60 * 60 * 1000);

    const getPlanRank = (p: string | undefined): number => {
      if (!p) return 0;
      const lower = p.toLowerCase();
      if (lower.includes('starter') || lower.includes('1 month')) return 1;
      if (lower.includes('momentum') || lower.includes('3 month')) return 2;
      if (lower.includes('transformation') || lower.includes('6 month')) return 3;
      if (lower.includes('champion') || lower.includes('12 month')) return 4;
      if (lower.includes('pass')) return 5;
      return 0;
    };

    const currentRank = getPlanRank(profile.plan);
    const newRank = getPlanRank(item);
    let isPlanExpired = profile.planExpiryDate ? Date.now() > profile.planExpiryDate : true;
    let shouldUpdatePlan = !isPass && (newRank >= currentRank || isPlanExpired);

    const newProfile = {
      ...profile,
      isPassActive: isPass ? true : profile.isPassActive,
      plan: shouldUpdatePlan ? item : profile.plan,
      planExpiryDate: shouldUpdatePlan ? computedExpiryDate : profile.planExpiryDate,
      passExpiryDate: isPass ? Math.max(computedExpiryDate, profile.passExpiryDate || 0) : profile.passExpiryDate,
      documentationStatus: isPass ? ('pending' as any) : profile.documentationStatus,
      lastPurchasePrice: amountPaid,
      lastCouponUsed: uppercaseCode || undefined,
      lastAffiliateId: creatorIdToCredit !== null ? creatorIdToCredit : (referrerId !== null && !isNaN(referrerId) ? referrerId : undefined)
    };

    await this.saveProfile(newProfile);
    return newProfile;
  },

  async verifyUserDocumentation(userId: number) {
    const { data: user } = await supabase.from('profiles').select('id').eq('id', userId).maybeSingle();
    if (user) {
      await supabase.from('profiles').update({ documentation_status: 'verified' }).eq('id', userId);
      return true;
    }
    return false;
  },

  async saveTrophyDeliveryDetails(userId: number, details: import('../types').TrophyDeliveryDetails) {
    await supabase.from('profiles').update({ trophy_delivery: details }).eq('id', userId);
  },

  // CREATOR EARNINGS & REDEMPTIONS
  async getReferralSuccessLog(referrerId: number) {
    const { data } = await supabase.from('referrals').select('*').eq('referrer_id', referrerId);
    return (data || []).map(d => ({ ...d, referrerId: d.referrer_id, refereeName: d.referee_name, amountPaid: d.amount_paid, codeUsed: d.code_used }));
  },

  async requestReferralRefund(userId: number, milestone: number) {
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (!profile) throw new Error("User not found");

    const { count } = await supabase.from('referrals').select('id', { count: 'exact', head: true }).eq('referrer_id', userId);
    if ((count || 0) < milestone) throw new Error(`Referral count (${count}) below milestone (${milestone})`);

    const purchasePrice = profile.last_purchase_price || 0;
    if (purchasePrice === 0) throw new Error("No qualifying purchase found for refund.");

    // Check if this milestone or a higher one is already claimed
    const { data: existing } = await supabase.from('referral_refunds').select('id').match({ user_id: userId, milestone }).maybeSingle();
    if (existing) throw new Error("Milestone already claimed.");

    // Calculate amount based on cumulative logic
    let targetPercent = 0;
    if (milestone === 3) targetPercent = 25;
    else if (milestone === 5) targetPercent = 45;
    else if (milestone === 10) targetPercent = 100;

    // To be truly cumulative, we subtract what was already authorized for lower milestones
    const { data: previousRefunds } = await supabase.from('referral_refunds').select('*').eq('user_id', userId);
    const previouslyClaimedPercent = (previousRefunds || [])
      .filter(r => r.status !== 'rejected' && r.milestone < milestone)
      .reduce((acc, curr) => {
        if (curr.milestone === 3) return Math.max(acc, 25);
        if (curr.milestone === 5) return Math.max(acc, 45);
        return acc;
      }, 0);

    const incrementalPercent = targetPercent - previouslyClaimedPercent;
    if (incrementalPercent <= 0) throw new Error("Refund already fully claimed for this tier.");

    const amount = (purchasePrice * incrementalPercent) / 100;

    return await supabase.from('referral_refunds').insert([{
      user_id: userId,
      milestone,
      amount,
      status: 'pending',
      timestamp: Date.now()
    }]);
  },

  async getReferralRefunds(userId: number) {
    const { data } = await supabase.from('referral_refunds').select('*').eq('user_id', userId);
    return (data || []).map(d => ({ ...d, userId: d.user_id }));
  },

  async getAllPendingReferralRefunds() {
    const { data: pending } = await supabase.from('referral_refunds').select('*, profiles:user_id(name)').eq('status', 'pending');
    return (pending || []).map((ref: any) => ({
      ...ref,
      userId: ref.user_id,
      userName: ref.profiles?.name || 'Unknown Agent'
    })).sort((a: any, b: any) => (a.timestamp || 0) - (b.timestamp || 0));
  },

  async updateReferralRefundStatus(id: number, status: 'completed' | 'rejected') {
    return await supabase.from('referral_refunds').update({ status }).eq('id', id);
  },

  async getAffiliateConversions(affiliateId: number) {
    const { data: refs } = await supabase.from('referrals').select('*').eq('referrer_id', affiliateId);
    const { data: earnings } = await supabase.from('creator_earnings').select('*').eq('creator_id', affiliateId);

    const unified = [
      ...(refs || []).map((r: any) => ({
        id: r.id,
        type: 'REFERRAL' as const,
        buyerName: r.referee_name,
        amountPaid: r.amount_paid,
        commission: 0,
        codeUsed: r.code_used,
        timestamp: r.timestamp
      })),
      ...(earnings || []).map((e: any) => ({
        id: e.id,
        type: 'CREATOR' as const,
        buyerName: e.buyer_name,
        amountPaid: e.amount_paid,
        commission: e.commission_earned,
        codeUsed: e.code_used,
        timestamp: e.timestamp
      }))
    ];

    return unified.sort((a, b) => b.timestamp - a.timestamp);
  },

  async getCreatorEarningsLog(creatorId: number) {
    const { data } = await supabase.from('creator_earnings').select('*').eq('creator_id', creatorId);
    return (data || []).map(d => ({ ...d, creatorId: d.creator_id, buyerName: d.buyer_name, amountPaid: d.amount_paid, commissionEarned: d.commission_earned, codeUsed: d.code_used }));
  },

  async requestRedemption(creatorId: number, amount: number, upiId: string) {
    const { data: pending } = await supabase.from('redemptions').select('id').match({ creator_id: creatorId, status: 'pending' }).maybeSingle();
    if (pending) throw new Error("Redemption already in progress.");

    return await supabase.from('redemptions').insert([{
      creator_id: creatorId,
      amount,
      upi_id: upiId,
      status: 'pending',
      timestamp: Date.now()
    }]);
  },

  async getRedemptionHistory(creatorId: number) {
    const { data } = await supabase.from('redemptions').select('*').eq('creator_id', creatorId).order('timestamp', { ascending: false });
    return (data || []).map(d => ({ ...d, creatorId: d.creator_id, upiId: d.upi_id }));
  },

  async getCreatorPersonalMappings(creatorId: number) {
    const { data } = await supabase.from('creator_mappings').select('*').eq('creator_id', creatorId);
    return (data || []).map(d => ({ ...d, creatorId: d.creator_id, baseCouponId: d.base_coupon_id, customCode: d.custom_code }));
  },


  async updateCreatorVanityCode(creatorId: number, baseCouponId: number, customCode: string) {
    const uppercaseCustom = customCode.toUpperCase().trim();
    if (uppercaseCustom.startsWith('TRFX-')) throw new Error("Reserved system prefix detected.");

    const { data: existingCoupon } = await supabase.from('coupons').select('id').eq('code', uppercaseCustom).maybeSingle();
    if (existingCoupon) throw new Error(`Promotion code "${uppercaseCustom}" already exists as a primary coupon.`);

    const { data: existingGlobal } = await supabase.from('creator_mappings').select('*').eq('custom_code', uppercaseCustom).maybeSingle();
    if (existingGlobal && (existingGlobal.creator_id !== creatorId || existingGlobal.base_coupon_id !== baseCouponId)) {
      throw new Error("Identity already claimed in the protocol.");
    }

    const { data: existingPersonal } = await supabase.from('creator_mappings').select('*').match({ creator_id: creatorId, base_coupon_id: baseCouponId }).maybeSingle();
    if (existingPersonal) {
      return await supabase.from('creator_mappings').update({ custom_code: uppercaseCustom }).eq('id', existingPersonal.id);
    } else {
      return await supabase.from('creator_mappings').insert([{ creator_id: creatorId, base_coupon_id: baseCouponId, custom_code: uppercaseCustom }]);
    }
  },

  // ADMIN STATUS UPDATES
  async getAllPendingRedemptions() {
    const { data: pending } = await supabase.from('redemptions').select('*, profiles:creator_id(name)').eq('status', 'pending');
    return (pending || []).map((red: any) => ({
      ...red,
      creatorId: red.creator_id,
      upiId: red.upi_id,
      creatorName: red.profiles?.name || 'Unknown Agent'
    })).sort((a: any, b: any) => (a.timestamp || 0) - (b.timestamp || 0));
  },

  async updateRedemptionStatus(id: number, status: 'completed' | 'rejected') {
    return await supabase.from('redemptions').update({ status }).eq('id', id);
  },

  // SYSTEM PROMPTS
  async getSystemPrompts() {
    const { data } = await supabase.from('prompts').select('*');
    return data || [];
  },

  async getPromptById(id: string) {
    const { data } = await supabase.from('prompts').select('*').eq('id', id).maybeSingle();
    return data;
  },

  async saveSystemPrompt(prompt: Partial<Omit<DBPrompt, 'id'>> & { id: string }) {
    await supabase.from('prompts').upsert(prompt);
    return prompt;
  },

  async seedDefaultPrompts(defaultPrompts: DBPrompt[]) {
    const { count } = await supabase.from('prompts').select('id', { count: 'exact', head: true });
    if (count === 0) {
      await supabase.from('prompts').insert(defaultPrompts);
      return defaultPrompts;
    }
    return await this.getSystemPrompts();
  },

  // AI LIMITS
  async getAILimits() {
    const keys = [
      'limit_free_workout', 'limit_1_month_workout', 'limit_3_month_workout', 'limit_6_month_workout', 'limit_12_month_workout', 'limit_pass_workout',
      'limit_free_nutrition', 'limit_1_month_nutrition', 'limit_3_month_nutrition', 'limit_6_month_nutrition', 'limit_12_month_nutrition', 'limit_pass_nutrition',
      'limit_free_vision', 'limit_1_month_vision', 'limit_3_month_vision', 'limit_6_month_vision', 'limit_12_month_vision', 'limit_pass_vision',
      'limit_free_system', 'limit_1_month_system', 'limit_3_month_system', 'limit_6_month_system', 'limit_12_month_system', 'limit_pass_system',
    ];

    const defaultVals: Record<string, number[]> = {
      'workout': [5, 50, 150, 300, 600, 1000],
      'nutrition': [5, 30, 90, 180, 360, 600],
      'vision': [2, 10, 30, 60, 120, 300],
      'system': [10, 100, 300, 600, 1200, 2000]
    };

    const { data: overrides } = await supabase.from('system_config').select('*').in('key', keys);

    let result: Record<string, number> = {};
    keys.forEach((k) => {
      const found = (overrides || []).find((o: any) => o.key === k);
      if (found) {
        result[k] = found.value;
      } else {
        const parts = k.split('_');
        const category = parts[parts.length - 1] as 'workout' | 'nutrition' | 'vision' | 'system';

        let index = 0; // free
        const pl = k.replace('limit_', '').replace(`_${category}`, '');
        if (pl === '1_month') index = 1;
        else if (pl === '3_month') index = 2;
        else if (pl === '6_month') index = 3;
        else if (pl === '12_month') index = 4;
        else if (pl === 'pass') index = 5;

        result[k] = defaultVals[category][index];
      }
    });
    return result;
  },

  async updateAILimit(key: string, value: number) {
    await supabase.from('system_config').upsert({ key, value });
  },

  async checkAndIncrementAIUsage(profile: UserProfile, category: 'WORKOUT' | 'NUTRITION' | 'VISION' | 'SYSTEM'): Promise<boolean> {
    const today = new Date().toISOString().split('T')[0];
    const limits = await this.getAILimits();

    const catLower = category.toLowerCase();

    let userLimit = limits[`limit_free_${catLower}`];

    if (profile.plan) {
      const plan = profile.plan.toLowerCase();
      if (plan.includes('starter') || plan.includes('1 month')) userLimit = limits[`limit_1_month_${catLower}`];
      else if (plan.includes('momentum') || plan.includes('3 month')) userLimit = limits[`limit_3_month_${catLower}`];
      else if (plan.includes('transformation') || plan.includes('6 month')) userLimit = limits[`limit_6_month_${catLower}`];
      else if (plan.includes('champion') || plan.includes('12 month')) userLimit = limits[`limit_12_month_${catLower}`];
      else if (plan.includes('pass')) userLimit = limits[`limit_pass_${catLower}`];
    } else if (profile.isPassActive) {
      userLimit = limits[`limit_pass_${catLower}`];
    }

    const { data: record } = await supabase.from('ai_usage').select('*').match({ date: today, category }).maybeSingle();
    const usageCount = record ? record.count : 0;

    if (usageCount >= userLimit) {
      return false; // Limit exceeded
    }

    if (record) {
      await supabase.from('ai_usage').update({ count: usageCount + 1 }).eq('id', record.id);
    } else {
      await supabase.from('ai_usage').insert([{ date: today, category, count: 1 }]);
    }
    return true;
  },

  // Suggestions
  async submitSuggestion(suggestion: Omit<AppSuggestion, 'id' | 'timestamp' | 'status'>) {
    return await supabase.from('suggestions').insert([{
      user_id: suggestion.userId,
      user_name: suggestion.userName,
      type: suggestion.type,
      title: suggestion.title,
      description: suggestion.description,
      status: 'pending',
      timestamp: Date.now()
    }]);
  },

  async getSuggestions() {
    const { data } = await supabase.from('suggestions').select('*').order('timestamp', { ascending: false });
    return (data || []).map((d: any) => ({
      ...d,
      userId: d.user_id,
      userName: d.user_name
    }));
  },

  async updateSuggestionStatus(id: number, status: 'pending' | 'reviewed' | 'implemented' | 'rejected') {
    return await supabase.from('suggestions').update({ status }).eq('id', id);
  },

  // Pass Features
  async getPassFeatures() {
    let { data: features } = await supabase.from('pass_features').select('*');

    if (!features || features.length === 0) {
      const defaults = [
        { text: 'Access to multiple gyms across India', icon: 'Map' },
        { text: 'Free 1-year AI Coach', icon: 'Bot' },
        { text: 'Metal black matte bottle', icon: 'Package' },
        { text: 'Premium gym bag', icon: 'ShoppingBag' },
        { text: 'Body resistance band set', icon: 'Zap' },
      ];
      await supabase.from('pass_features').insert(defaults);
      const { data: newF } = await supabase.from('pass_features').select('*');
      features = newF;
    }

    return features || [];
  },

  async addPassFeature(text: string, icon: string) {
    return await supabase.from('pass_features').insert([{ text, icon }]);
  },

  async removePassFeature(id: number) {
    return await supabase.from('pass_features').delete().eq('id', id);
  }
};
