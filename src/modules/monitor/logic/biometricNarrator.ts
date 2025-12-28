import { BIOMETRIC_NARRATOR_SYSTEM_PROMPT } from '../prompts/biometricNarratorPrompt';

export interface BiometricNarrativeResponse {
  physiological_story: string;
  state_assessment: "FUNCTIONAL_OVERREACHING" | "SYMPATHETIC_STRESS" | "PARASYMPATHETIC_SATURATION" | "OPTIMAL" | "RECOVERY_REQUIRED";
  recommended_action: string;
  reasoning_string: string;
}

export interface DailyBiometrics {
  date: string;
  hrv?: number;
  rhr?: number;
  sleep_score?: number;
  training_load?: number; // Tonnage or Duration
  subjective_fatigue?: number;
}

export class BiometricNarratorAgent {
  private static readonly MODEL = "gemini-2.0-flash-exp"; 

  static async analyzeBiometrics(history: DailyBiometrics[]): Promise<BiometricNarrativeResponse> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set");
    }

    // Sort history by date ascending
    const sortedHistory = [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const userQuery = `
      Analyze the following 7-day biometric history for a high-performance marathoner:
      ${JSON.stringify(sortedHistory, null, 2)}
      
      Determine the physiological state and provide a narrative.
    `;

    const payload = {
      contents: [{ parts: [{ text: userQuery }] }],
      systemInstruction: { parts: [{ text: BIOMETRIC_NARRATOR_SYSTEM_PROMPT }] },
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            physiological_story: { type: "STRING" },
            state_assessment: { type: "STRING", enum: ["FUNCTIONAL_OVERREACHING", "SYMPATHETIC_STRESS", "PARASYMPATHETIC_SATURATION", "OPTIMAL", "RECOVERY_REQUIRED"] },
            recommended_action: { type: "STRING" },
            reasoning_string: { type: "STRING" }
          },
          required: ["physiological_story", "state_assessment", "recommended_action", "reasoning_string"]
        }
      }
    };

    return this.fetchWithRetry(payload, apiKey);
  }

  private static async fetchWithRetry(payload: any, apiKey: string, retries = 3, delay = 1000): Promise<any> {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.MODEL}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP Error: ${response.status} - ${errorText}`);
      }
      
      const result = await response.json();
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!text) throw new Error("Empty response from AI");
      return JSON.parse(text);

    } catch (error) {
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.fetchWithRetry(payload, apiKey, retries - 1, delay * 2);
      }
      throw error;
    }
  }
}
