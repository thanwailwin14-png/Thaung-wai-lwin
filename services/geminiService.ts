
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { VoiceName, StoryTone, ToneDescriptions } from "../types";

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is missing from environment variables.");
    }
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }

  async fetchTranscriptFromUrl(url: string): Promise<string> {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: [{ parts: [{ text: `I have a YouTube video at this URL: ${url}. Please find and provide the full transcript or a very detailed scene-by-scene breakdown of this video. I need the raw text to rewrite it into a recap script later. Return only the transcript content.` }] }],
        config: {
          tools: [{ googleSearch: {} }],
          toolConfig: { includeServerSideToolInvocations: true }
        },
      });

      const text = response.text;
      if (!text || text.length < 50) {
        throw new Error("Could not retrieve a valid transcript. Please try pasting it manually.");
      }
      return text;
    } catch (error) {
      console.error("Error fetching via Search:", error);
      throw new Error("Failed to fetch transcript using Google Search. Please ensure the URL is correct or paste the transcript manually.");
    }
  }

  async processVideo(base64Data: string, mimeType: string): Promise<string> {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-preview',
        contents: [{
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType,
              },
            },
            {
              text: "Please watch this video and provide a comprehensive transcript or a highly detailed scene-by-scene breakdown. I will use this as the foundation for a movie recap script. Include dialogue if audible and describe key visual plot points clearly.",
            },
          ],
        }],
      });

      return response.text || "ဗီဒီယိုကို နားမလည်နိုင်ပါ။ ကျေးဇူးပြု၍ အခြားဗီဒီယိုတစ်ခု စမ်းကြည့်ပါ။";
    } catch (error) {
      console.error("Error processing video:", error);
      throw new Error("Failed to process video file. Ensure it is a valid video and not too large.");
    }
  }

  async generateTitle(script: string): Promise<string> {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-preview',
        contents: [{ parts: [{ text: `Based on this movie recap script, generate one short, extremely catchy, and dramatic title in Burmese. Do not use quotes or extra text. Just the title.
        
        Script: ${script.substring(0, 5000)}` }] }],
      });
      return response.text?.trim() || "Untitled Recap";
    } catch (error) {
      console.error("Error generating title:", error);
      return "Untitled Recap";
    }
  }

  async generateRecapScript(transcript: string, tone: StoryTone = StoryTone.Dramatic, durationSeconds?: number): Promise<string> {
    const toneInfo = ToneDescriptions[tone];
    
    const durationText = durationSeconds 
      ? `The target duration for this script is approximately ${Math.floor(durationSeconds / 60)} minutes and ${Math.floor(durationSeconds % 60)} seconds. 
         Please ensure the script length matches this duration when spoken at a normal pace. 
         Be extremely concise and focus ONLY on the main plot points. Avoid filler words, long introductions, or unnecessary commentary.`
      : "Focus on the main plot points and be concise. Avoid unnecessary filler words.";

    // Truncate transcript if it's too long to prevent proxy 500 errors
    const truncatedTranscript = transcript.length > 35000 
      ? transcript.substring(0, 35000) + "... [Transcript truncated due to length]" 
      : transcript;

    const systemPrompt = `You are a professional Burmese YouTuber and Movie Recap Storyteller (ဇာတ်လမ်းပြောပြသူ).
Your task is to rewrite the provided transcript into a highly engaging "Movie Recap Style" script in natural Burmese spoken language (လူပြောစကား style).

Target Tone: ${toneInfo.label} (${toneInfo.description})
${durationText}

Storytelling Guidelines for Burmese:
1. Pacing & Flow: Use short, punchy sentences. Avoid long, complex academic phrases.
2. Natural Narration: Use conversational Burmese particles correctly (e.g., "တယ်" instead of "သည်" for endings where appropriate for narration).
3. Transitions: Use dramatic transitions such as:
   - "ဒါပေမယ့် တကယ်တော့..." (But in reality...)
   - "ဘယ်သူမှ မထင်ထားတဲ့ အလှည့်အပြောင်းတစ်ခုက..." (An unexpected twist...)
   - "အခြေအနေတွေက လုံးဝ ပြောင်းလဲသွားခဲ့တယ်..." (Situations changed completely...)
4. Emotional Impact: Describe scenes with expressive Burmese adjectives.
5. Conciseness: DO NOT add extra commentary or opinions. Stick to the core events of the video.
6. Timing: If a duration is specified, adjust the amount of detail to fit that time perfectly.

Structure:
- Start with a quick, powerful hook.
- Tell the story chronologically, focusing ONLY on key events.
- End with a brief, punchy conclusion.

Do NOT include camera directions or scene numbers. ONLY the narration script.`;

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-preview',
        contents: [{ parts: [{ text: truncatedTranscript }] }],
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.7,
        }
      });

      return response.text || "ဇာတ်လမ်းကို ပြန်လည်ပြောပြဖို့ အခက်အခဲရှိနေပါတယ်။ ကျေးဇူးပြု၍ ထပ်မံကြိုးစားကြည့်ပါ။";
    } catch (error) {
      console.error("Error generating script:", error);
      throw new Error("Failed to generate Burmese recap script.");
    }
  }

  async extractHooks(script: string): Promise<string[]> {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-preview',
        contents: `Extract 3 most catchy and dramatic opening 'hooks' (intro sentences) from this Burmese movie recap script. These should be designed to grab the audience's attention in the first 5 seconds.
        
        Script: ${script}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              hooks: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "List of 3 catchy hooks in Burmese"
              }
            },
            required: ["hooks"]
          }
        }
      });

      const json = JSON.parse(response.text.trim());
      return json.hooks || [];
    } catch (error) {
      console.error("Error extracting hooks:", error);
      return [];
    }
  }

  async generateAudio(text: string, voice: VoiceName = VoiceName.Kore): Promise<string> {
    try {
      // Direct TTS Prompt to avoid any extra AI commentary
      const ttsPrompt = `Narrate the following Burmese text exactly as written. 
      Maintain a professional storytelling rhythm with appropriate pauses. 
      Do not add any introductions, conclusions, or extra words.

      Text: ${text}`;

      const response = await this.ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text: ttsPrompt }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice as any },
            },
          },
        },
      });

      const candidate = response.candidates?.[0];
      if (!candidate) {
        throw new Error("Gemini TTS model did not return any candidates.");
      }

      const audioPart = candidate.content?.parts?.find(part => part.inlineData && part.inlineData.data);
      if (audioPart && audioPart.inlineData) {
        return audioPart.inlineData.data;
      }

      throw new Error("No audio data found in the model response.");
    } catch (error: any) {
      console.error("Gemini TTS Error:", error);
      throw new Error(error.message || "Failed to generate audio narration.");
    }
  }
}
