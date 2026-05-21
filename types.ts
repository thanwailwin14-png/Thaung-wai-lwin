
export interface RecapState {
  transcript: string;
  title: string;
  script: string;
  hooks: string[];
  isGeneratingScript: boolean;
  isGeneratingAudio: boolean;
  audioUrl: string | null;
  error: string | null;
  narrationSpeed: number;
  enableMastering: boolean;
  selectedTone: StoryTone;
  videoDuration: number | null;
}

export enum StoryTone {
  Dramatic = 'Dramatic',
  Suspense = 'Suspense',
  Comedy = 'Comedy',
  Action = 'Action'
}

export const ToneDescriptions: Record<StoryTone, { label: string; description: string; emoji: string }> = {
  [StoryTone.Dramatic]: {
    label: "Dramatic",
    description: "လေးနက်ဆွဲဆောင်မှုရှိသော ဒရမ်မာပုံစံ",
    emoji: "🎭"
  },
  [StoryTone.Suspense]: {
    label: "Suspense",
    description: "သည်းထိတ်ရင်ဖို လျှို့ဝှက်ဆန်းကြယ်ပုံစံ",
    emoji: "🔍"
  },
  [StoryTone.Comedy]: {
    label: "Comedy",
    description: "ပေါ့ပေါ့ပါးပါးနှင့် ဟာသနှောသောပုံစံ",
    emoji: "🤣"
  },
  [StoryTone.Action]: {
    label: "Action",
    description: "မြန်ဆန်တက်ကြွလှုပ်ရှားမှုပုံစံ",
    emoji: "💥"
  }
};

export enum VoiceName {
  Kore = 'Kore',
  Puck = 'Puck',
  Charon = 'Charon',
  Fenrir = 'Fenrir',
  Zephyr = 'Zephyr'
}

export const VoiceDescriptions: Record<VoiceName, { label: string; description: string; role: string; icon: string }> = {
  [VoiceName.Kore]: { 
    label: "Kore", 
    description: "ကြည်လင်သော အမျိုးသမီးအသံ", 
    role: "Professional Female Narrator",
    icon: "👩‍💼"
  },
  [VoiceName.Puck]: { 
    label: "Puck", 
    description: "တက်ကြွသော အမျိုးသားအသံ", 
    role: "Energetic Storyteller",
    icon: "🎙️"
  },
  [VoiceName.Charon]: { 
    label: "Charon", 
    description: "လေးနက်သော ဇာတ်လမ်းပြောအသံ", 
    role: "Dramatic & Deep Male",
    icon: "🎬"
  },
  [VoiceName.Fenrir]: { 
    label: "Fenrir", 
    description: "ခန့်ညားသော အမျိုးသားအသံ", 
    role: "Authoritative Voice",
    icon: "🏛️"
  },
  [VoiceName.Zephyr]: { 
    label: "Zephyr", 
    description: "အေးချမ်းသော အသံနေအထား", 
    role: "Calm & Smooth Narrator",
    icon: "🍃"
  },
};
