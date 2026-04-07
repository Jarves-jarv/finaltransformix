
import { GoogleGenAI, Type } from "@google/genai";
import { UserProfile, WorkoutSplit, TrainingStyle, GeneratedDay, Gym } from "../types";
import { ApiService } from "./api";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// STATIC TEST DATA FOR OFFLINE MODE
const STATIC_EXERCISES: Record<string, { name: string, cue: string }> = {
  'Chest': { name: 'Barbell Bench Press', cue: 'Touch chest, press up' },
  'Back': { name: 'Lat Pulldown', cue: 'Pull elbows down' },
  'Shoulders': { name: 'Dumbbell Shoulder Press', cue: 'Core tight' },
  'Legs': { name: 'Barbell Squat', cue: 'Knees follow toes' },
  'Quads': { name: 'Leg Extension', cue: 'Squeeze at top' },
  'Hamstrings': { name: 'Lying Leg Curl', cue: 'Keep hips down' },
  'Biceps': { name: 'Barbell Curl', cue: 'Elbows tucked' },
  'Triceps': { name: 'Cable Pushdown', cue: 'Lock out elbows' },
  'Glutes': { name: 'Hip Thrust', cue: 'Chin tucked' },
  'Calves': { name: 'Standing Calf Raise', cue: 'Full stretch' },
  'Abs': { name: 'Cable Crunch', cue: 'Round the back' }
};

const IS_OFFLINE = !ai;

const checkUsage = async (category: 'WORKOUT' | 'NUTRITION' | 'VISION' | 'SYSTEM', profile?: UserProfile) => {
  if (IS_OFFLINE) return;
  const p = profile || await ApiService.getProfile();
  if (p) {
    const allowed = await ApiService.checkAndIncrementAIUsage(p, category);
    if (!allowed) {
      throw new Error(`AI Limits Exceeded for ${category}. Upgrade your plan extending your God Mode quota.`);
    }
  }
};

// REUSE existing single day logic but export for internal use if needed
export const getWorkoutPlan = async (profile: UserProfile, targetedMuscles: string[], history: any[], split: WorkoutSplit, leaveContext?: string) => {
  if (IS_OFFLINE) {
    return Array(6).fill(0).map((_, i) => {
      const mg = targetedMuscles[i % targetedMuscles.length];
      const key = Object.keys(STATIC_EXERCISES).find(k => mg.includes(k)) || 'Chest';
      const base = STATIC_EXERCISES[key];
      return {
        name: base.name,
        setsCount: 3,
        reps: "8-12",
        formCue: base.cue,
        muscleGroup: mg,
        suggestedWeight: "Baseline",
        restTime: "90s"
      };
    });
  }

  const historyContext = history.length > 0
    ? `User's last performance on these muscle groups: ${JSON.stringify(history)}. Use this to determine suggested weights.`
    : "No history found. Generate a baseline protocol based on experience level.";

  const injuryContext = profile.injuries && profile.injuries.length > 0
    ? `IMPORTANT SAFETY RESTRICTION: The user has the following injuries: ${profile.injuries.join(', ')}. YOU MUST NOT suggest any exercises that strain or aggravate these areas.`
    : "No injuries reported.";

  const recoveryContext = leaveContext
    ? `IMPORTANT RECOVERY PROTOCOL: ${leaveContext}. You MUST reduce the recommended weight/intensity according to the leave duration to prevent injury and DOMS.`
    : "User is active. Standard progression applies.";

  await checkUsage('WORKOUT', profile);

  const promptRecord = await ApiService.getPromptById('workout-gen');
  const template = promptRecord?.template || `You are an expert strength & hypertrophy coach.
  Generate TODAY’S personalized gym workout for a \${profile.age}y/o \${profile.gender}.

  INPUTS:
  1. Selected Workout Split: \${split.name}
  2. Selected Workout Type (Style): \${split.style}
  3. Targets: \${targetedMuscles.join(', ')}
  4. Goal: \${profile.goal}
  5. Experience: \${profile.experience}
  6. Available Equipment: \${profile.equipment.join(', ')}
  7. History: \${historyContext}
  8. Health Protocol: \${injuryContext}
  9. Leave Status: \${recoveryContext}

  RULES:
  1. Prioritize compound movements.
  2. Training Style Specifics:
     - Hypertrophy: 3-5 sets, 6-12 reps, 60-90s rest. 
     - Strength: 3-6 sets, 1-5 reps, 2-4m rest.
     - Power (Intermediate+ only): 3-5 sets, 1-3 reps, 2-3m rest.
     - Endurance: 2-4 sets, 12-20+ reps, 30-45s rest.
  3. Progression: If previous sets were successful, increase weight by 2-5% or add 1-2 reps. 
     **EXCEPTION:** If Leave Status indicates a break, REDUCE weights/volume as instructed.
  4. Structure: exactly 6 exercises.
  5. INJURY PREVENTION: Cross-reference the "Health Protocol".

  RETURN A JSON ARRAY of exactly 6 exercise objects. 
  Each object MUST have: 
  - name: string
  - setsCount: integer
  - reps: string (e.g. "8-12")
  - formCue: string (ONE VERY SIMPLE TIP. Use Easy English for Grade 5 level. No jargon. Short 1-sentence only. e.g. "Keep your back flat" or "Go down slow".)
  - muscleGroup: string
  - suggestedWeight: string (calculate based on history if available, else "Baseline")
  - restTime: string (e.g. "90 seconds")`;

  // Interpolate based on our current context. Note this simple string replace handles exact matches. A real templating engine might be safer, but this follows the existing code style.
  let prompt = template
    .replace(/\$\{profile\.age\}/g, profile.age.toString())
    .replace(/\$\{profile\.gender\}/g, profile.gender)
    .replace(/\$\{split\.name\}/g, split.name)
    .replace(/\$\{split\.style\}/g, split.style)
    .replace(/\$\{targetedMuscles\.join\(\', \'\)\}/g, targetedMuscles.join(', '))
    .replace(/\$\{profile\.goal\}/g, profile.goal)
    .replace(/\$\{profile\.experience\}/g, profile.experience)
    .replace(/\$\{profile\.equipment\.join\(\', \'\)\}/g, profile.equipment.join(', '))
    .replace(/\$\{historyContext\}/g, historyContext)
    .replace(/\$\{injuryContext\}/g, injuryContext)
    .replace(/\$\{recoveryContext\}/g, recoveryContext);

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            setsCount: { type: Type.INTEGER },
            reps: { type: Type.STRING },
            formCue: { type: Type.STRING },
            muscleGroup: { type: Type.STRING },
            suggestedWeight: { type: Type.STRING },
            restTime: { type: Type.STRING }
          },
          required: ["name", "setsCount", "reps", "formCue", "muscleGroup", "suggestedWeight", "restTime"]
        }
      }
    }
  });

  return JSON.parse(response.text.trim());
};

export const generateFullProtocol = async (profile: UserProfile, split: WorkoutSplit, leaveContext?: string): Promise<GeneratedDay[]> => {
  // --- STATIC MODE OVERRIDE FOR TESTING (To save API Usage) ---
  const STATIC_MODE = false;
  if (STATIC_MODE) {
    console.log("⚠️ USING STATIC TEST PROTOCOL (NO API CALL) ⚠️");
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));

    return split.days.map(day => {
      // Generate exercise for each muscle group in the day
      const dayExercises = day.muscleGroups.flatMap(mg => {
        // Simple heuristic to match muscle to static list, default to first if not found
        const key = Object.keys(STATIC_EXERCISES).find(k => mg.includes(k)) || 'Chest';
        const base = STATIC_EXERCISES[key] || STATIC_EXERCISES['Chest'];

        return [
          {
            name: base.name,
            setsCount: 3,
            reps: "8-12",
            formCue: base.cue,
            muscleGroup: mg,
            suggestedWeight: "Baseline",
            restTime: "90s",
            sets: []
          },
          {
            name: `${mg} Isolation`,
            setsCount: 3,
            reps: "12-15",
            formCue: "Squeeze and hold",
            muscleGroup: mg,
            suggestedWeight: "Baseline",
            restTime: "60s",
            sets: []
          }
        ];
      }).slice(0, 6); // Limit to 6 exercises per day

      return {
        name: day.name,
        muscleGroups: day.muscleGroups,
        exercises: dayExercises
      };
    });
  }
  // ------------------------------------------------------------

  // We will generate all days in parallel to save time.
  const dayPromises = split.days.map(async (day) => {
    // We try to get history for these specific muscles
    const history = await ApiService.getRecentPerformanceForMuscles(day.muscleGroups);
    const exercises = await getWorkoutPlan(profile, day.muscleGroups, history, split, leaveContext);
    return {
      name: day.name,
      muscleGroups: day.muscleGroups,
      exercises: Array.isArray(exercises) ? exercises : exercises.exercises || []
    };
  });

  return await Promise.all(dayPromises);
};

export const estimateBodyFat = async (profile: UserProfile, weight: number, measurements: any) => {
  if (IS_OFFLINE) {
    return { bodyFat: 15.5, confidence: "Offline Estimate", insight: "Connect to internet for precise AI analysis." };
  }
  await checkUsage('SYSTEM', profile);
  const promptRecord = await ApiService.getPromptById('body-fat');
  const template = promptRecord?.template || `Act as a clinical exercise physiologist. Estimate body fat % for:
Profile: \${profile.gender}, \${profile.age}y/o, \${profile.height}cm, \${weight}kg.
Measurements: \${JSON.stringify(measurements)}.
Return ONLY JSON: { "bodyFat": number, "confidence": string, "insight": string }`;
  let prompt = template
    .replace(/\$\{profile\.gender\}/g, profile.gender)
    .replace(/\$\{profile\.age\}/g, profile.age.toString())
    .replace(/\$\{profile\.height\}/g, profile.height.toString())
    .replace(/\$\{weight\}/g, weight.toString())
    .replace(/\$\{JSON\.stringify\(measurements\)\}/g, JSON.stringify(measurements));

  const response = await ai!.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          bodyFat: { type: Type.NUMBER },
          confidence: { type: Type.STRING },
          insight: { type: Type.STRING }
        },
        required: ["bodyFat", "confidence", "insight"]
      }
    }
  });
  return JSON.parse(response.text.trim());
};

export const getProgressInsight = async (profile: UserProfile, current: any, previous: any) => {
  if (IS_OFFLINE) {
    return "Great job staying consistent! Keep tracking your metrics to see trends.";
  }
  await checkUsage('SYSTEM', profile);
  const prompt = `Analyze body measurement changes for goal: ${profile.goal}.
  Current: ${JSON.stringify(current)}
  Previous: ${JSON.stringify(previous)}
  Provide a concise, tactical 2-sentence insight.`;

  const response = await ai!.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ text: prompt }],
  });

  return response.text;
};

export const customizeWorkout = async (currentPlan: any[], userRequest: string) => {
  if (IS_OFFLINE) {
    return { confirmation: "Offline mode: Limited customization available.", exercises: currentPlan };
  }

  await checkUsage('WORKOUT');

  const promptRecord = await ApiService.getPromptById('workout-custom');
  const template = promptRecord?.template || `Modify this plan: \${JSON.stringify(currentPlan)} based on: "\${userRequest}".
Return JSON object: { "confirmation": string, "exercises": array }`;
  let prompt = template
    .replace(/\$\{JSON\.stringify\(currentPlan\)\}/g, JSON.stringify(currentPlan))
    .replace(/\$\{userRequest\}/g, userRequest);

  const response = await ai!.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          confirmation: { type: Type.STRING },
          exercises: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                setsCount: { type: Type.INTEGER },
                reps: { type: Type.STRING },
                formCue: { type: Type.STRING },
                muscleGroup: { type: Type.STRING },
                restTime: { type: Type.STRING },
                suggestedWeight: { type: Type.STRING }
              }
            }
          }
        },
        required: ["confirmation", "exercises"]
      }
    }
  });

  return JSON.parse(response.text.trim());
};

export const getDietPlan = async (profile: UserProfile) => {
  if (IS_OFFLINE) {
    return [
      { type: 'Breakfast', name: profile.dietPreference === 'Vegetarian' || profile.dietPreference === 'Vegan' ? 'Oatmeal with Almonds' : 'Oatmeal with Fruits', description: 'High fiber start', calories: 400, protein: 15, carbs: 60, fats: 10 },
      { type: 'Lunch', name: profile.dietPreference === 'Vegetarian' ? 'Paneer & Rice' : profile.dietPreference === 'Vegan' ? 'Tofu & Rice' : 'Grilled Chicken & Rice', description: 'Lean protein source', calories: 600, protein: 45, carbs: 70, fats: 12 },
      { type: 'Snack', name: profile.dietPreference === 'Vegan' ? 'Roasted Chickpeas' : 'Greek Yogurt', description: 'Quick protein', calories: 200, protein: 20, carbs: 15, fats: 5 },
      { type: 'Dinner', name: profile.dietPreference === 'Vegetarian' ? 'Lentil Soup & Veggies' : profile.dietPreference === 'Vegan' ? 'Vegan Bean Chili' : 'Fish & Steamed Veggies', description: 'Light & nutritious', calories: 500, protein: 40, carbs: 30, fats: 15 }
    ];
  }

  await checkUsage('NUTRITION', profile);

  const promptRecord = await ApiService.getPromptById('diet-gen');
  const template = promptRecord?.template || `Generate 4-meal nutrition plan for \${profile.goal}, weight \${profile.weight}kg.
Diet Preference: \${profile.dietPreference}
Return JSON array of meal objects.
Each object must have: type, name, description, calories, protein, carbs, fats.`;

  // Always append this strict rule regardless of the template stored in the DB to ensure old DBs work
  const finalTemplate = template + `\nCRITICAL RULE: All meals MUST strictly comply with a \${profile.dietPreference} diet. No exceptions.`;

  let prompt = finalTemplate
    .replace(/\$\{profile\.goal\}/g, profile.goal)
    .replace(/\$\{profile\.weight\}/g, profile.weight.toString())
    .replace(/\$\{profile\.dietPreference\}/g, profile.dietPreference || 'Flexible');

  const response = await ai!.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING },
            name: { type: Type.STRING },
            description: { type: Type.STRING },
            calories: { type: Type.NUMBER },
            protein: { type: Type.NUMBER },
            carbs: { type: Type.NUMBER },
            fats: { type: Type.NUMBER }
          },
          required: ["type", "name", "description", "calories", "protein", "carbs", "fats"]
        }
      }
    }
  });

  return JSON.parse(response.text.trim());
};

export const customizeDiet = async (currentDiet: any[], userRequest: string) => {
  if (IS_OFFLINE) {
    return { confirmation: "Offline mode: Diet customization unavailable.", meals: currentDiet };
  }

  await checkUsage('NUTRITION');

  const promptRecord = await ApiService.getPromptById('diet-custom');
  const template = promptRecord?.template || `Update diet: \${JSON.stringify(currentDiet)} based on: "\${userRequest}". 
Return JSON { confirmation, meals }.`;
  let prompt = template
    .replace(/\$\{JSON\.stringify\(currentDiet\)\}/g, JSON.stringify(currentDiet))
    .replace(/\$\{userRequest\}/g, userRequest);

  const response = await ai!.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          confirmation: { type: Type.STRING },
          meals: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING } } } }
        }
      }
    }
  });
  return JSON.parse(response.text.trim());
};

export const scanGymEquipment = async (base64Image: string) => {
  if (IS_OFFLINE) {
    return ['Dumbbells', 'Barbell', 'Bench', 'Cables', 'Leg Press'];
  }
  await checkUsage('VISION');
  const promptRecord = await ApiService.getPromptById('vision-equip');
  const instruction = promptRecord?.template || 'Identify fitness equipment in JSON array.';
  const response = await ai!.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: {
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
        { text: instruction }
      ]
    },
    config: { responseMimeType: 'application/json' }
  });
  return JSON.parse(response.text.trim());
};

export const analyzeMeal = async (meal: string) => {
  if (IS_OFFLINE) {
    return { calories: 350, protein: 25, carbs: 40, fats: 10 };
  }

  await checkUsage('NUTRITION');

  const promptRecord = await ApiService.getPromptById('meal-analyze');
  const template = promptRecord?.template || `Analyze meal: \${meal}. Return JSON macros.`;
  let prompt = template.replace(/\$\{meal\}/g, meal);

  const response = await ai!.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: { 
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          calories: { type: Type.NUMBER },
          protein: { type: Type.NUMBER },
          carbs: { type: Type.NUMBER },
          fats: { type: Type.NUMBER }
        },
        required: ["name", "calories", "protein", "carbs", "fats"]
      }
    }
  });
  return JSON.parse(response.text.trim());
};

export const getAIResponse = async (query: string, history: any[] = [], context?: string) => {
  if (IS_OFFLINE) {
    return "I'm currently in offline mode. Please connect to the internet to use the full AI features.";
  }
  await checkUsage('SYSTEM');
  const response = await ai!.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [...history, { role: 'user', parts: [{ text: query }] }],
    config: {
      systemInstruction: context
    }
  });
  return response.text;
};

export const optimizeSplit = async (split: any, profile: UserProfile) => {
  if (IS_OFFLINE) {
    return { optimizedSplit: split };
  }

  await checkUsage('WORKOUT', profile);

  const promptRecord = await ApiService.getPromptById('split-optimize');
  const template = promptRecord?.template || `Optimize split: \${JSON.stringify(split)}. Return JSON { optimizedSplit }.`;
  let prompt = template.replace(/\$\{JSON\.stringify\(split\)\}/g, JSON.stringify(split));

  const response = await ai!.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: { responseMimeType: "application/json" }
  });
  return JSON.parse(response.text.trim());
};

// --- GOOGLE MAPS GROUNDING SEARCH ---
export const findGymsWithMaps = async (query: string): Promise<Gym[]> => {
  if (IS_OFFLINE) {
    return [
      { name: "Gold's Gym", location: "Nearby (Offline)", rating: 4.8, equipment: ['Dumbbells', 'Barbell'] },
      { name: "Anytime Fitness", location: "Nearby (Offline)", rating: 4.5, equipment: ['Cables', 'Treadmill'] }
    ];
  }
  await checkUsage('SYSTEM');
  const response = await ai!.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `Find gyms near me related to: ${query}. Return JSON array.`,
    config: {
      tools: [{ googleMaps: {} }],
      // Note: We cannot use responseMimeType JSON with Tools in some versions, 
      // but Gemini 2.5 Flash is good at following instruction.
    },
  });

  const text = response.text || '';

  // Attempt to parse JSON from the text response
  try {
    // Find JSON array brackets
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    if (start !== -1 && end !== -1) {
      const jsonStr = text.substring(start, end + 1);
      const gyms = JSON.parse(jsonStr);
      // Map to strict Gym interface
      return gyms.map((g: any) => ({
        name: g.name || "Unknown Gym",
        location: g.location || "Unknown Location",
        rating: g.rating || 4.0,
        equipment: Array.isArray(g.equipment) ? g.equipment : ["Standard Setup"]
      }));
    }
  } catch (e) {
    console.error("Failed to parse Maps JSON", e);
  }

  // Fallback: If JSON parsing fails, we could parse Grounding Chunks if strictly needed,
  // but for now return empty or handle error gracefully.
  return [];
};
