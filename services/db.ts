import Dexie, { type EntityTable } from 'dexie';
import { UserProfile, Exercise, WorkoutSplit, Gym, GymEquipmentRequest, ActiveProtocol, AppSuggestion } from '../types.ts';

export interface Syncable {
  syncStatus: 'synced' | 'pending';
  lastModified: number;
  serverId?: number | string;
}

interface DBWorkout {
  id?: number;
  date: string; // ISO string
  name: string;
  muscleGroup: string;
  exercises: Exercise[];
  durationMinutes: number;
  splitName?: string;
  splitId?: string;
}

interface DBMeal {
  id?: number;
  date: string; // YYYY-MM-DD
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  quality: number;
}

interface DBProgress {
  id?: number;
  date: string; // YYYY-MM-DD
  weight: number;
  bodyFat?: number;
  biceps?: number;
  waist?: number;
  chest?: number;
  thighs?: number;
}

interface DBProgressPhoto {
  id?: number;
  date: string; // ISO string
  data: string; // base64 string
}

interface DBRequest {
  id?: number;
  senderEmail?: string;
  senderName?: string;
  senderImg?: string;
  receiverEmail?: string;
  receiverName?: string;
  receiverImg?: string;
  partnerName?: string; // legacy compat
  partnerId?: string;
  img?: string;
  goal: string;
  status: 'pending' | 'accepted' | 'declined';
  timestamp: number;
}

interface DBCommunityPost {
  id?: number;
  userEmail?: string;
  name?: string;
  gender?: string;
  goal: string;
  preferredTime: string;
  bio: string;
  timestamp: number;
}

interface DBPartner {
  id?: number;
  userEmail?: string;
  partnerEmail?: string;
  partnerName?: string;
  name?: string; // legacy
  partnerId?: string; // legacy
  img: string;
  goal: string;
  whatsapp?: string;
  timestamp: number;
}

interface DBVideoLink {
  id?: number;
  userId: number;
  url: string;
  timestamp: number;
  status: 'synced' | 'review' | 'verified' | 'rejected';
}

interface DBActiveDiet {
  id: string;
  plan: any[];
  generatedAt: number;
}

interface DBLeave {
  id?: number;
  startDate: string;
  endDate: string;
  durationDays: number;
  timestamp: number;
}

interface DBCoupon {
  id?: number;
  code: string;
  discountAmount: number;
  creatorCommission?: number;
  giftHamper?: string;
  active: boolean;
  usages?: { buyerName: string; amount: number; timestamp: number }[];
}

interface DBConfig {
  key: string;
  value: number;
}

interface DBReferral {
  id?: number;
  referrerId: number;
  refereeName: string;
  amountPaid: number;
  codeUsed: string;
  timestamp: number;
}

interface DBCreatorEarning {
  id?: number;
  creatorId: number;
  buyerName: string;
  amountPaid: number;
  commissionEarned: number;
  codeUsed: string;
  timestamp: number;
}

interface DBCreatorMapping {
  id?: number;
  creatorId: number;
  baseCouponId: number;
  customCode: string;
}

interface DBRedemption {
  id?: number;
  creatorId: number;
  amount: number;
  upiId?: string;
  status: 'pending' | 'completed' | 'rejected';
  timestamp: number;
}

export interface DBPrompt {
  id: string; // The specific prompt identifier, e.g., 'workout-gen'
  title: string;
  category: 'WORKOUT' | 'NUTRITION' | 'VISION' | 'SYSTEM' | 'ALL';
  description: string;
  model: string; // e.g., 'gemini-3-pro-preview'
  template: string;
}

export interface DBAiUsage {
  id?: number;
  date: string; // YYYY-MM-DD
  category: string; // e.g., 'WORKOUT', 'NUTRITION', 'VISION', 'SYSTEM'
  count: number;
}

export interface DBPassFeature {
  id?: number;
  text: string;
  icon: string;
}

const db = new Dexie('TransformixDB') as Dexie & {
  profile: EntityTable<UserProfile & Syncable & { id?: number }, 'id'>;
  workouts: EntityTable<DBWorkout & Syncable & { profile_id: number }, 'id'>;
  meals: EntityTable<DBMeal & Syncable & { profile_id: number }, 'id'>;
  progress: EntityTable<DBProgress & Syncable & { profile_id: number }, 'id'>;
  photos: EntityTable<DBProgressPhoto & Syncable & { profile_id: number }, 'id'>;
  requests: EntityTable<DBRequest, 'id'>;
  communityPosts: EntityTable<DBCommunityPost, 'id'>;
  partners: EntityTable<DBPartner, 'id'>;
  splits: EntityTable<WorkoutSplit & Syncable & { profile_id: number }, 'id'>;
  videoLinks: EntityTable<DBVideoLink, 'id'>;
  gyms: EntityTable<Gym, 'id'>;
  equipmentRequests: EntityTable<GymEquipmentRequest, 'id'>;
  activeProtocol: EntityTable<ActiveProtocol & Syncable & { profile_id: number; id?: number }, 'id'>;
  activeDiet: EntityTable<DBActiveDiet & Syncable & { profile_id: number }, 'id'>;
  leaves: EntityTable<DBLeave, 'id'>;
  coupons: EntityTable<DBCoupon, 'id'>;
  systemConfig: EntityTable<DBConfig, 'key'>;
  referrals: EntityTable<DBReferral, 'id'>;
  creatorEarnings: EntityTable<DBCreatorEarning, 'id'>;
  creatorMappings: EntityTable<DBCreatorMapping, 'id'>;
  redemptions: EntityTable<DBRedemption, 'id'>;
  prompts: EntityTable<DBPrompt, 'id'>;
  aiUsage: EntityTable<DBAiUsage, 'id'>;
  suggestions: EntityTable<AppSuggestion, 'id'>;
  passFeatures: EntityTable<DBPassFeature, 'id'>;
  referralRefunds: EntityTable<DBReferralRefund, 'id'>;
};

// V30: Added aiUsage storage
db.version(29).stores({
  profile: '++id, email, phone',
  workouts: '++id, date, muscleGroup, splitId',
  meals: '++id, date',
  progress: '++id, date',
  photos: '++id, date',
  requests: '++id, partnerId, status',
  communityPosts: '++id, timestamp',
  partners: '++id, partnerId',
  splits: 'id',
  videoLinks: '++id, url, status, timestamp',
  gyms: '++id, name',
  equipmentRequests: '++id, gymName, status',
  activeProtocol: '++id, splitId',
  activeDiet: 'id',
  leaves: '++id, endDate, timestamp',
  coupons: '++id, code',
  systemConfig: 'key',
  referrals: '++id, referrerId',
  creatorEarnings: '++id, creatorId',
  creatorMappings: '++id, [creatorId+baseCouponId], creatorId, customCode',
  redemptions: '++id, creatorId, status',
  prompts: 'id, category'
});

db.version(30).stores({
  profile: '++id, email, phone',
  workouts: '++id, date, muscleGroup, splitId',
  meals: '++id, date',
  progress: '++id, date',
  photos: '++id, date',
  requests: '++id, partnerId, status',
  communityPosts: '++id, timestamp',
  partners: '++id, partnerId',
  splits: 'id',
  videoLinks: '++id, url, status, timestamp',
  gyms: '++id, name',
  equipmentRequests: '++id, gymName, status',
  activeProtocol: '++id, splitId',
  activeDiet: 'id',
  leaves: '++id, endDate, timestamp',
  coupons: '++id, code',
  systemConfig: 'key',
  referrals: '++id, referrerId',
  creatorEarnings: '++id, creatorId',
  creatorMappings: '++id, [creatorId+baseCouponId], creatorId, customCode',
  redemptions: '++id, creatorId, status',
  prompts: 'id, category',
  aiUsage: '++id, date'
});

db.version(31).stores({
  profile: '++id, email, phone',
  workouts: '++id, date, muscleGroup, splitId',
  meals: '++id, date',
  progress: '++id, date',
  photos: '++id, date',
  requests: '++id, partnerId, status',
  communityPosts: '++id, timestamp, userEmail',
  partners: '++id, partnerId',
  splits: 'id',
  videoLinks: '++id, url, status, timestamp',
  gyms: '++id, name',
  equipmentRequests: '++id, gymName, status',
  activeProtocol: '++id, splitId',
  activeDiet: 'id',
  leaves: '++id, endDate, timestamp',
  coupons: '++id, code',
  systemConfig: 'key',
  referrals: '++id, referrerId',
  creatorEarnings: '++id, creatorId',
  creatorMappings: '++id, [creatorId+baseCouponId], creatorId, customCode',
  redemptions: '++id, creatorId, status',
  prompts: 'id, category',
  aiUsage: '++id, date'
});

db.version(33).stores({
  profile: '++id, email, phone',
  workouts: '++id, date, muscleGroup, splitId',
  meals: '++id, date',
  progress: '++id, date',
  photos: '++id, date',
  requests: '++id, partnerId, status',
  communityPosts: '++id, timestamp, userEmail',
  partners: '++id, partnerId',
  splits: 'id',
  videoLinks: '++id, url, status, timestamp',
  gyms: '++id, name',
  equipmentRequests: '++id, gymName, status',
  activeProtocol: '++id, splitId',
  activeDiet: 'id',
  leaves: '++id, endDate, timestamp',
  coupons: '++id, code',
  systemConfig: 'key',
  referrals: '++id, referrerId',
  creatorEarnings: '++id, creatorId',
  creatorMappings: '++id, [creatorId+baseCouponId], creatorId, customCode',
  redemptions: '++id, creatorId, status',
  prompts: 'id, category',
  aiUsage: '++id, [date+category]',
  suggestions: '++id, status, type, timestamp'
});

db.version(34).stores({
  profile: '++id, email, phone',
  workouts: '++id, date, muscleGroup, splitId',
  meals: '++id, date',
  progress: '++id, date',
  photos: '++id, date',
  requests: '++id, partnerId, status',
  communityPosts: '++id, timestamp, userEmail',
  partners: '++id, partnerId',
  splits: 'id',
  videoLinks: '++id, url, status, timestamp',
  gyms: '++id, name',
  equipmentRequests: '++id, gymName, status',
  activeProtocol: '++id, splitId',
  activeDiet: 'id',
  leaves: '++id, endDate, timestamp',
  coupons: '++id, code',
  systemConfig: 'key',
  referrals: '++id, referrerId',
  creatorEarnings: '++id, creatorId',
  creatorMappings: '++id, [creatorId+baseCouponId], creatorId, customCode',
  redemptions: '++id, creatorId, status',
  prompts: 'id, category',
  aiUsage: '++id, [date+category]',
  suggestions: '++id, status, type, timestamp',
  passFeatures: '++id'
});

db.version(34).stores({
  profile: '++id, email, phone',
  workouts: '++id, date, muscleGroup, splitId',
  meals: '++id, date',
  progress: '++id, date',
  photos: '++id, date',
  requests: '++id, partnerId, status',
  communityPosts: '++id, timestamp, userEmail',
  partners: '++id, partnerId',
  splits: 'id',
  videoLinks: '++id, url, status, timestamp',
  gyms: '++id, name',
  equipmentRequests: '++id, gymName, status',
  activeProtocol: '++id, splitId',
  activeDiet: 'id',
  leaves: '++id, endDate, timestamp',
  coupons: '++id, code',
  systemConfig: 'key',
  referrals: '++id, referrerId',
  creatorEarnings: '++id, creatorId',
  creatorMappings: '++id, [creatorId+baseCouponId], creatorId, customCode',
  redemptions: '++id, creatorId, status',
  prompts: 'id, category',
  aiUsage: '++id, [date+category]',
  suggestions: '++id, status, type, timestamp',
  passFeatures: '++id'
});

db.version(35).stores({
  profile: '++id, email, phone',
  workouts: '++id, date, muscleGroup, splitId',
  meals: '++id, date',
  progress: '++id, date',
  photos: '++id, date',
  requests: '++id, senderEmail, receiverEmail, status',
  communityPosts: '++id, timestamp, userEmail',
  partners: '++id, userEmail',
  splits: 'id',
  videoLinks: '++id, url, status, timestamp',
  gyms: '++id, name',
  equipmentRequests: '++id, gymName, status',
  activeProtocol: '++id, splitId',
  activeDiet: 'id',
  leaves: '++id, endDate, timestamp',
  coupons: '++id, code',
  systemConfig: 'key',
  referrals: '++id, referrerId',
  creatorEarnings: '++id, creatorId',
  creatorMappings: '++id, [creatorId+baseCouponId], creatorId, customCode',
  redemptions: '++id, creatorId, status',
  prompts: 'id, category',
  aiUsage: '++id, [date+category]',
  suggestions: '++id, status, type, timestamp',
  passFeatures: '++id'
});

db.version(36).stores({
  profile: '++id, email, phone',
  workouts: '++id, date, muscleGroup, splitId',
  meals: '++id, date',
  progress: '++id, date',
  photos: '++id, date',
  requests: '++id, senderEmail, receiverEmail, status',
  communityPosts: '++id, timestamp, userEmail',
  partners: '++id, userEmail',
  splits: 'id',
  videoLinks: '++id, userId, url, status, timestamp',
  gyms: '++id, name',
  equipmentRequests: '++id, gymName, status',
  activeProtocol: '++id, splitId',
  activeDiet: 'id',
  leaves: '++id, endDate, timestamp',
  coupons: '++id, code',
  systemConfig: 'key',
  referrals: '++id, referrerId',
  creatorEarnings: '++id, creatorId',
  creatorMappings: '++id, [creatorId+baseCouponId], creatorId, customCode',
  redemptions: '++id, creatorId, status',
  prompts: 'id, category',
  aiUsage: '++id, [date+category]',
  suggestions: '++id, status, type, timestamp',
  passFeatures: '++id'
});

interface DBReferralRefund {
  id?: number;
  userId: number;
  milestone: number;
  amount: number;
  status: 'pending' | 'completed' | 'rejected';
  timestamp: number;
}

db.version(38).stores({
  profile: '++id, email, phone',
  workouts: '++id, date, muscleGroup, splitId',
  meals: '++id, date',
  progress: '++id, date',
  photos: '++id, date',
  requests: '++id, senderEmail, receiverEmail, status',
  communityPosts: '++id, timestamp, userEmail',
  partners: '++id, userEmail',
  splits: 'id',
  videoLinks: '++id, userId, url, status, timestamp',
  gyms: '++id, name',
  equipmentRequests: '++id, gymName, status',
  activeProtocol: '++id, splitId',
  activeDiet: 'id',
  leaves: '++id, endDate, timestamp',
  coupons: '++id, code',
  systemConfig: 'key',
  referrals: '++id, referrerId',
  creatorEarnings: '++id, creatorId',
  creatorMappings: '++id, [creatorId+baseCouponId], creatorId, customCode',
  redemptions: '++id, creatorId, status',
  prompts: 'id, category',
  aiUsage: '++id, [date+category]',
  suggestions: '++id, status, type, timestamp',
  passFeatures: '++id',
  referralRefunds: '++id, userId, status'
});

db.version(41).stores({
  profile: '++id, email, phone, syncStatus',
  workouts: '++id, date, muscleGroup, splitId, syncStatus, profile_id',
  meals: '++id, date, syncStatus, profile_id',
  progress: '++id, date, syncStatus, profile_id',
  photos: '++id, date, syncStatus, profile_id',
  requests: '++id, senderEmail, receiverEmail, status',
  communityPosts: '++id, timestamp, userEmail',
  partners: '++id, userEmail',
  splits: 'id, syncStatus, profile_id',
  videoLinks: '++id, userId, url, status, timestamp',
  gyms: '++id, name',
  equipmentRequests: '++id, gymName, status',
  activeProtocol: '++id, splitId, syncStatus, profile_id',
  activeDiet: 'id, syncStatus, profile_id',
  leaves: '++id, endDate, timestamp',
  coupons: '++id, code',
  systemConfig: 'key',
  referrals: '++id, referrerId',
  creatorEarnings: '++id, creatorId',
  creatorMappings: '++id, [creatorId+baseCouponId], creatorId, customCode',
  redemptions: '++id, creatorId, status',
  prompts: 'id, category',
  aiUsage: '++id, [date+category]',
  suggestions: '++id, status, type, timestamp',
  passFeatures: '++id',
  referralRefunds: '++id, userId, status'
});

export { db, type DBReferralRefund };
