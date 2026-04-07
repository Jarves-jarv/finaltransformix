import { db } from './db';
import { ApiService } from './services/api';
import { UserProfile, Gender, BodyType, ExperienceLevel, FitnessGoal, DietPreference } from './types.ts';

async function run() {
    const profile: UserProfile = {
        name: 'Test',
        email: 'test@test.com',
        role: 'user',
        gender: Gender.MALE,
        age: 25,
        height: 180,
        weight: 80,
        bodyType: BodyType.MESOMORPH,
        experience: ExperienceLevel.BEGINNER,
        goal: FitnessGoal.STRENGTH,
        dietPreference: DietPreference.VEGETARIAN,
        typicalMeals: [],
        equipment: [],
        gymName: 'Test Gym',
        isPassActive: false,
        referrals: 0,
        videoUploads: 0
    };

    await ApiService.registerUser(profile);

    // Set all free limits to 0
    await ApiService.updateAILimit('limit_free_workout', 0);
    await ApiService.updateAILimit('limit_free_nutrition', 0);
    await ApiService.updateAILimit('limit_free_vision', 0);
    await ApiService.updateAILimit('limit_free_system', 0);

    // Get limits
    const limits = await ApiService.getAILimits();
    console.log('Limits:', limits['limit_free_workout']);

    // Call checkAndIncrementAIUsage
    const allowed = await ApiService.checkAndIncrementAIUsage(profile, 'WORKOUT');
    console.log('Allowed:', allowed);

    process.exit(0);
}

run().catch(console.error);
