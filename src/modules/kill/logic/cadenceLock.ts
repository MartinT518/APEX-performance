import { CADENCE_LOCK_SYSTEM_PROMPT } from '../prompts/cadenceLockPrompt';

export interface CadenceLockResult {
  is_cadence_lock: boolean;
  confidence: number;
  explanation: string;
}

export class CadenceLockDetector {
  private static readonly MODEL = "gemini-2.0-flash-exp";

  /**
   * Detects if HR is locked to Cadence in a sample window.
   * @param samples Array of { timestamp, hr, cadence }
   */
  static async detectCadenceLock(samples: { timestamp: string; hr: number; cadence: number }[]): Promise<CadenceLockResult> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.warn("GEMINI_API_KEY missing - skipping Cadence Lock check");
        return { is_cadence_lock: false, confidence: 0, explanation: "API Key missing" };
    }

    // Optimization: Pre-check using math (if HR differs from Cadence by > 10, unlikely to be locked)
    // But for this task, we rely on LLM Pattern Recognition as requested.
    // We'll send a 60s sample (approx 60 points if 1Hz, or less).
    // Limit to 60 points to save tokens/latency.
    const sampleWindow = samples.slice(0, 60);

    const userQuery = `
      Analyze this 60s sample of running data for Cadence Lock:
      ${JSON.stringify(sampleWindow, null, 2)}
    `;

    const payload = {
      contents: [{ parts: [{ text: userQuery }] }],
      systemInstruction: { parts: [{ text: CADENCE_LOCK_SYSTEM_PROMPT }] },
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            is_cadence_lock: { type: "BOOLEAN" },
            confidence: { type: "NUMBER" },
            explanation: { type: "STRING" }
          },
          required: ["is_cadence_lock", "confidence", "explanation"]
        }
      }
    };

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.MODEL}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
      const result = await response.json();
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Empty response");

      return JSON.parse(text);
    } catch (e) {
      console.error("Cadence Lock Check Failed:", e);
      // Fail open (assume data is valid if check fails)
      return { is_cadence_lock: false, confidence: 0, explanation: "Check failed" };
    }
  }
}
