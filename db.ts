
import Dexie, { type EntityTable } from 'dexie';
import { UserProfile, Exercise, WorkoutSplit, Gym, GymEquipmentRequest } from '../types';

interface DBWorkout {
  id?: number;
  date: string; // ISO string
  name: string;
  muscleGroup: string;
  exercises: Exercise[];
  durationMinutes: number;
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
  partnerName: string;
  partnerId: string;
  img: string;
  goal: string;
  status: 'pending' | 'accepted' | 'declined';
  timestamp: number;
}

interface DBCommunityPost {
  id?: number;
  goal: string;
  preferredTime: string;
  bio: string;
  timestamp: number;
}

interface DBPartner {
  id?: number;
  name: string;
  partnerId: string;
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

const db = new Dexie('TransformixDB') as Dexie & {
  profile: EntityTable<UserProfile & { id?: number }, 'id'>;
  workouts: EntityTable<DBWorkout, 'id'>;
  meals: EntityTable<DBMeal, 'id'>;
  progress: EntityTable<DBProgress, 'id'>;
  photos: EntityTable<DBProgressPhoto, 'id'>;
  requests: EntityTable<DBRequest, 'id'>;
  communityPosts: EntityTable<DBCommunityPost, 'id'>;
  partners: EntityTable<DBPartner, 'id'>;
  splits: EntityTable<WorkoutSplit, 'id'>;
  videoLinks: EntityTable<DBVideoLink, 'id'>;
  gyms: EntityTable<Gym, 'id'>;
  equipmentRequests: EntityTable<GymEquipmentRequest, 'id'>;
};

// Bump version to 14 to add equipmentRequests table
db.version(14).stores({
  profile: '++id, email',
  workouts: '++id, date, muscleGroup',
  meals: '++id, date',
  progress: '++id, date',
  photos: '++id, date',
  requests: '++id, partnerId, status',
  communityPosts: '++id, timestamp',
  partners: '++id, partnerId',
  splits: 'id',
  videoLinks: '++id, userId, url, status, timestamp',
  gyms: '++id, name',
  equipmentRequests: '++id, gymName, status'
});

export { db };
