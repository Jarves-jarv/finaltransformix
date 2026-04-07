import { ApiService } from '../services/api';
import { db } from '../services/db';

async function seedTestData() {
    console.log("Adding an admin admin@transformix.ai / admin123 setup...");
    // It handles admin login automatically via hardcoded check but we'll add a real profile just in case something tries to fetch it
    await db.profile.put({
        id: 999,
        name: 'System Admin',
        email: 'admin@transformix.ai',
        role: 'admin',
        gender: 'Male' as any,
        age: 30,
        height: 180,
        weight: 80,
        bodyType: 'Mesomorph' as any,
        goal: 'Strength' as any,
        experience: 'Advanced' as any,
        dietPreference: 'Non-Vegetarian' as any,
        typicalMeals: [],
        equipment: [],
        gymName: 'HQ',
        isPassActive: true,
        referrals: 999,
        videoUploads: 0
    });

    console.log("Adding a creator profile...");
    await db.profile.put({
        id: 1,
        name: 'Creator John',
        email: 'john@creator.com',
        role: 'user',
        gender: 'Male' as any,
        age: 25,
        height: 175,
        weight: 75,
        bodyType: 'Mesomorph' as any,
        goal: 'Strength' as any,
        experience: 'Advanced' as any,
        dietPreference: 'Non-Vegetarian' as any,
        typicalMeals: [],
        equipment: [],
        gymName: 'HQ',
        isPassActive: true,
        referrals: 0,
        videoUploads: 150
    });

    console.log("Adding a pending redemption...");
    await db.redemptions.add({
        creatorId: 1,
        amount: 1500,
        status: 'pending',
        timestamp: Date.now()
    });

    console.log("Test data seeded.");
}

seedTestData();
