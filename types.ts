
export enum Gender {
  MALE = 'Male',
  FEMALE = 'Female',
  OTHER = 'Other'
}

export enum BodyType {
  ECTOMORPH = 'Ectomorph',
  ENDOMORPH = 'Endomorph',
  MESOMORPH = 'Mesomorph'
}

export enum ExperienceLevel {
  BEGINNER = 'Beginner',
  INTERMEDIATE = 'Intermediate',
  ADVANCED = 'Advanced'
}

export enum FitnessGoal {
  MUSCLE_GAIN = 'Muscle Gain',
  FAT_LOSS = 'Fat Loss',
  STRENGTH = 'Strength',
  AESTHETICS = 'Aesthetics'
}

export enum DietPreference {
  VEGETARIAN = 'Vegetarian',
  NON_VEGETARIAN = 'Non-Vegetarian',
  VEGAN = 'Vegan'
}

export enum TrainingStyle {
  HYPERTROPHY = 'Hypertrophy',
  STRENGTH = 'Strength',
  POWER = 'Power',
  ENDURANCE = 'Endurance'
}

export enum WeightUnit {
  KG = 'kg',
  LBS = 'lbs'
}

export enum HeightUnit {
  CM = 'cm',
  FT = 'ft'
}

export interface SplitDay {
  name: string;
  muscleGroups: string[];
}

export interface WorkoutSplit {
  id: string;
  name: string;
  daysPerWeek: number;
  style: TrainingStyle;
  level: ExperienceLevel;
  avgTime: number;
  isCustom: boolean;
  aiOptimized: boolean;
  category: FitnessGoal;
  description: string;
  recommendationTag?: string; // e.g. "Best for Beginners"
  days: SplitDay[];
}

export interface TrophyDeliveryDetails {
  fullName: string;
  phone: string;
  address: string;
  landmark: string;
  pincode: string;
}

export interface UserProfile {
  id?: number;
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  role?: 'user' | 'admin';
  gender: Gender;
  age: number;
  height: number; // Always stored in cm
  weight: number; // Always stored in kg
  weightUnit?: WeightUnit;
  heightUnit?: HeightUnit;
  bodyType: BodyType;
  experience: ExperienceLevel;
  goal: FitnessGoal;
  dietPreference: DietPreference;
  typicalMeals: string[];
  gymName?: string;
  equipment: string[];
  isPassActive: boolean;
  referrals: number;
  videoUploads: number;
  injuries?: string[];
  profileImage?: string;
  currentSplitId?: string;
  plan?: string;
  planExpiryDate?: number;
  passExpiryDate?: number;
  documentationStatus?: 'pending' | 'verified';
  trophyStatus?: 'none' | 'applied' | 'awarded' | 'rejected' | 'shipped';
  trophyRejectionReason?: string;
  trophyDelivery?: TrophyDeliveryDetails;
  lastPurchasePrice?: number;
  lastCouponUsed?: string;
  lastAffiliateId?: number;
}

export interface WorkoutSet {
  weight: number;
  reps: number;
  rpe?: number;
  notes?: string;
  completed?: boolean;
}

export interface Exercise {
  name: string;
  sets: WorkoutSet[];
  formCue: string;
  muscleGroup: string;
  setsCount?: number; // for AI generated plan
  reps?: string; // for AI generated plan
  restTime?: string; // for AI generated plan
  suggestedWeight?: string; // for AI generated plan
  lastWeight?: number; // Added for comparison
  lastReps?: number;   // Added for comparison
  isRecovery?: boolean; // Added for UI styling
}

export interface GeneratedDay {
  name: string;
  muscleGroups: string[];
  exercises: Exercise[];
}

export interface ActiveProtocol {
  id?: number;
  splitId: string;
  splitName: string;
  generatedAt: number;
  days: GeneratedDay[];
  currentDayIndex: number;
}

export interface BodyMetrics {
  weight: number;
  bodyFat?: number;
  biceps?: number;
  waist?: number;
  chest?: number;
  thighs?: number;
  date: string;
}

export interface Gym {
  id?: number;
  name: string;
  location: string;
  equipment: string[];
  rating: number;
  image?: string;
}

export interface GymEquipmentRequest {
  id?: number;
  gymName: string;
  equipmentName: string;
  userId?: number;
  userName?: string;
  timestamp: number;
  status: 'pending' | 'approved' | 'rejected';
  proofImage?: string; // Base64 image string for admin verification
}

export interface AppSuggestion {
  id?: number;
  userId?: number;
  userName?: string;
  type: 'feature' | 'bug' | 'other';
  title: string;
  description: string;
  status: 'pending' | 'reviewed' | 'implemented' | 'rejected';
  timestamp: number;
}
