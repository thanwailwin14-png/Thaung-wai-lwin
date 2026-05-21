
import React, { useState, useCallback, useRef } from 'react';
import { GeminiService } from './services/geminiService';
import { RecapState, VoiceName, VoiceDescriptions, StoryTone, ToneDescriptions } from './types';
import { decode, decodeAudioData, audioBufferToWav, applyEffects } from './utils/audioUtils';

const App: React.FC = () => {
  // App Content State
  const [state, setState] = useState<RecapState>({
    transcript: '',
    title: '',
    script: '',
    hooks: [],
    isGeneratingScript: false,
    isGeneratingAudio: false,
    audioUrl: null,
    error: null,
    narrationSpeed: 1.05,
    enableMastering: true,
    selectedTone: StoryTone.Dramatic,
    videoDuration: null,
  });

  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [isProcessingVideo, setIsProcessingVideo] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<VoiceName>(VoiceName.Kore);
  const [previewingVoice, setPreviewingVoice] = useState<VoiceName | null>(null);
  const [copiedHookIndex, setCopiedHookIndex] = useState<number | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scriptTextareaRef = useRef<HTMLTextAreaElement>(null);

  const handleFetchUrl = async () => {
    if (!youtubeUrl.trim()) {
      setState(prev => ({ ...prev, error: "ကျေးဇူးပြု၍ YouTube URL ထည့်ပေးပါ။" }));
      return;
    }
    setIsFetchingUrl(true);
    setState(prev => ({ ...prev, error: null }));
    try {
      const gemini = new GeminiService();
      const transcript = await gemini.fetchTranscriptFromUrl(youtubeUrl);
      setState(prev => ({ ...prev, transcript, error: null }));
    } catch (err: any) {
      setState(prev => ({ ...prev, error: "YouTube မှ အချက်အလက်ယူ၍မရပါ။ URL မှန်မမှန် စစ်ဆေးပေးပါ။" }));
    } finally {
      setIsFetchingUrl(false);
    }
  };

  const handleVideoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Increased limit to 300MB as requested
    const MAX_SIZE = 300 * 1024 * 1024; 
    if (file.size > MAX_SIZE) {
      setState(prev => ({ ...prev, error: "ဗီဒီယိုဖိုင်က အရမ်းကြီးနေပါတယ်။ 300MB အောက်ဖိုင်များကိုသာ တိုက်ရိုက်တင်နိုင်ပါသည်။" }));
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsProcessingVideo(true);
    setState(prev => ({ ...prev, error: null }));

    // Extract duration
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      window.URL.revokeObjectURL(video.src);
      const duration = video.duration;
      setState(prev => ({ ...prev, videoDuration: duration }));
    };
    video.src = URL.createObjectURL(file);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        try {
          const base64String = (reader.result as string).split(',')[1];
          const gemini = new GeminiService();
          const transcript = await gemini.processVideo(base64String, file.type);
          setState(prev => ({ ...prev, transcript, error: null }));
        } catch (err: any) {
          console.error("Processing Error:", err);
          setState(prev => ({ ...prev, error: "ဗီဒီယိုကို စစ်ဆေးရာတွင် အမှားအယွင်းရှိနေပါသည်။ ဖိုင်ဆိုဒ်ကြီးပါက Browser limit ကြောင့် အမှားပြနိုင်ပါသည်။ YouTube Link ကို သုံးရန် အကြံပြုပါသည်။" }));
        } finally {
          setIsProcessingVideo(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };
    } catch (err: any) {
      setState(prev => ({ ...prev, error: "File handling error." }));
      setIsProcessingVideo(false);
    }
  };

  const handleGenerateScript = async () => {
    if (!state.transcript.trim()) return;
    setState(prev => ({ ...prev, isGeneratingScript: true, error: null }));
    try {
      const gemini = new GeminiService();
      const script = await gemini.generateRecapScript(state.transcript, state.selectedTone, state.videoDuration || undefined);
      const [hooks, title] = await Promise.all([
        gemini.extractHooks(script),
        gemini.generateTitle(script)
      ]);
      setState(prev => ({ ...prev, script, hooks, title, isGeneratingScript: false }));
    } catch (err: any) {
      setState(prev => ({ ...prev, error: "Script ဖန်တီး၍မရပါ။ ထပ်မံကြိုးစားကြည့်ပါ။", isGeneratingScript: false }));
    }
  };

  const applyFormatting = (type: 'bold' | 'italic' | 'bullet' | 'strike' | 'code') => {
    const textarea = scriptTextareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = state.script;
    const selectedText = text.substring(start, end);
    let newText = text;
    let cursorOffset = 0;
    switch (type) {
      case 'bold': newText = text.substring(0, start) + `**${selectedText}**` + text.substring(end); cursorOffset = 2; break;
      case 'italic': newText = text.substring(0, start) + `*${selectedText}*` + text.substring(end); cursorOffset = 1; break;
      case 'bullet': newText = text.substring(0, start) + selectedText.split('\n').map(l => `- ${l}`).join('\n') + text.substring(end); cursorOffset = 2; break;
      case 'strike': newText = text.substring(0, start) + `~~${selectedText}~~` + text.substring(end); cursorOffset = 2; break;
      case 'code': newText = text.substring(0, start) + `\`${selectedText}\`` + text.substring(end); cursorOffset = 1; break;
    }
    setState(prev => ({ ...prev, script: newText }));
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + cursorOffset, end + cursorOffset);
    }, 0);
  };

  const handlePreviewVoice = async (voice: VoiceName, e: React.MouseEvent) => {
    e.stopPropagation();
    if (previewingVoice) return;
    
    setPreviewingVoice(voice);
    try {
      const gemini = new GeminiService();
      const previewText = `မင်္ဂလာပါ၊ ကျွန်တော်ကတော့ ${VoiceDescriptions[voice].label} ဖြစ်ပါတယ်။`;
      const base64Audio = await gemini.generateAudio(previewText, voice);
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const audioBuffer = await decodeAudioData(decode(base64Audio), audioContext, 24000, 1);
      
      const processedBuffer = await applyEffects(audioBuffer, state.narrationSpeed, state.enableMastering);
      const url = URL.createObjectURL(audioBufferToWav(processedBuffer));
      
      const audio = new Audio(url);
      audio.onended = () => {
        setPreviewingVoice(null);
        URL.revokeObjectURL(url);
      };
      audio.play();
    } catch (err) {
      console.error("Voice preview failed", err);
      setPreviewingVoice(null);
    }
  };

  const handleGenerateAudio = async () => {
    if (!state.script) return;
    setState(prev => ({ ...prev, isGeneratingAudio: true, error: null }));
    try {
      const cleanScript = state.script.replace(/~~/g, '').replace(/\*\*/g, '').replace(/\*/g, '').replace(/`/g, '').replace(/^- /gm, '');
      const gemini = new GeminiService();
      const base64Audio = await gemini.generateAudio(cleanScript, selectedVoice);
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const audioBuffer = await decodeAudioData(decode(base64Audio), audioContext, 24000, 1);
      const processedBuffer = await applyEffects(audioBuffer, state.narrationSpeed, state.enableMastering);
      const url = URL.createObjectURL(audioBufferToWav(processedBuffer));
      setState(prev => ({ ...prev, audioUrl: url, isGeneratingAudio: false }));
    } catch (err: any) {
      setState(prev => ({ ...prev, error: "အသံဖိုင်ထုတ်လုပ်၍မရပါ။ Script အရမ်းရှည်နေနိုင်ပါသည်။", isGeneratingAudio: false }));
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedHookIndex(index);
    setTimeout(() => setCopiedHookIndex(null), 2000);
  };

  const handleClearAll = () => {
    if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
    setYoutubeUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    setState({
      transcript: '', title: '', script: '', hooks: [],
      isGeneratingScript: false, isGeneratingAudio: false,
      audioUrl: null, error: null,
      narrationSpeed: 1.05, enableMastering: true,
      selectedTone: StoryTone.Dramatic,
      videoDuration: null,
    });
  };

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center max-w-5xl mx-auto">
      <header className="w-full text-center mb-10 relative">
        <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-amber-500 mb-2">Movie Recap <span className="text-white">Generator</span></h1>
        <p className="text-slate-400 text-lg myanmar-font">ဗီဒီယို သို့မဟုတ် YouTube Link များမှ မြန်မာဇာတ်လမ်းပြော အဖြစ် ပြောင်းလဲပေးမည်။</p>
        <button onClick={handleClearAll} className="mt-6 px-4 py-2 bg-slate-800 text-slate-300 text-sm font-semibold rounded-lg border border-slate-700 mx-auto transition-all hover:bg-slate-700">Clear All</button>
      </header>
      
      <main className="w-full grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="space-y-6">
          <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-6 shadow-xl">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Input Source
            </h2>
            
            <div className="space-y-4 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
                <input 
                  type="text" 
                  placeholder="Paste YouTube URL here..." 
                  className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-300 focus:border-red-500 focus:outline-none transition-colors" 
                  value={youtubeUrl} 
                  onChange={e => setYoutubeUrl(e.target.value)} 
                />
                <button 
                  onClick={handleFetchUrl} 
                  disabled={isFetchingUrl || isProcessingVideo}
                  className={`px-5 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold transition-all ${isFetchingUrl ? 'opacity-50' : 'hover:bg-red-500'}`}
                >
                  {isFetchingUrl ? 'Fetching...' : 'Fetch'}
                </button>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-slate-700/50"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-[#0f172a] px-2 text-slate-500 font-bold tracking-widest">OR</span>
                </div>
              </div>

              <div className="flex flex-col items-center">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleVideoFileChange} 
                  accept="video/*" 
                  className="hidden" 
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isFetchingUrl || isProcessingVideo}
                  className={`w-full group relative flex items-center justify-center gap-3 px-4 py-6 border-2 border-dashed rounded-2xl transition-all ${
                    isProcessingVideo 
                    ? 'border-red-500/50 bg-red-500/5' 
                    : 'border-slate-700 hover:border-red-500/50 hover:bg-slate-800/50'
                  }`}
                >
                  {isProcessingVideo ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-xs font-bold text-red-500 uppercase tracking-tighter">Analyzing Video Content...</span>
                    </div>
                  ) : (
                    <>
                      <div className="p-2 bg-slate-800 rounded-lg group-hover:bg-red-500/10 group-hover:text-red-500 transition-colors">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold text-slate-200">Upload Video File</p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">MP4, MOV, WEBM (MAX 300MB)</p>
                      </div>
                    </>
                  )}
                </button>
              </div>
            </div>

            {state.error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-xs myanmar-font">
                {state.error}
              </div>
            )}

            <div className="relative">
              <div className="absolute top-3 right-4 flex items-center gap-2 pointer-events-none">
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest bg-slate-900 px-2 py-0.5 rounded">Source Text</span>
              </div>
              <textarea 
                className="w-full h-72 bg-slate-900 border border-slate-700 rounded-xl p-4 text-slate-300 text-sm focus:border-red-500 focus:outline-none transition-colors" 
                placeholder="Video analysis or YouTube transcript will appear here..." 
                value={state.transcript} 
                onChange={e => setState(p => ({ ...p, transcript: e.target.value }))} 
              />
            </div>

            {/* Story Tone Selection */}
            <div className="mt-6">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-3">Select Story Tone (ဇာတ်လမ်းပုံစံ)</label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(ToneDescriptions) as StoryTone[]).map(tone => (
                  <button
                    key={tone}
                    onClick={() => setState(p => ({ ...p, selectedTone: tone }))}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all text-xs font-bold ${
                      state.selectedTone === tone
                      ? 'bg-red-500/20 border-red-500 text-red-500 shadow-lg shadow-red-500/10'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    <span>{ToneDescriptions[tone].emoji}</span>
                    <span className="truncate">{ToneDescriptions[tone].label}</span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-slate-500 myanmar-font italic">
                {ToneDescriptions[state.selectedTone].description}
              </p>
            </div>

            <button 
              onClick={handleGenerateScript} 
              disabled={state.isGeneratingScript || !state.transcript.trim()} 
              className={`w-full mt-6 py-4 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-red-600/20 active:scale-95 flex items-center justify-center gap-3 ${
                (state.isGeneratingScript || !state.transcript.trim()) ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {state.isGeneratingScript ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Generating {state.selectedTone} Recap...
                </>
              ) : (
                <>
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Generate {state.selectedTone} Script
                </>
              )}
            </button>
          </div>
        </section>

        <section className="space-y-6">
          <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-6 shadow-xl min-h-[400px] flex flex-col">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <svg className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Recap Content
            </h2>

            {state.script && (
              <div className="mb-4">
                <input 
                  type="text" 
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 myanmar-font font-bold text-lg focus:border-amber-500 focus:outline-none transition-colors" 
                  value={state.title} 
                  onChange={e => setState(p => ({ ...p, title: e.target.value }))} 
                  placeholder="ဇာတ်လမ်းခေါင်းစဉ်..."
                />
              </div>
            )}

            <div className="relative flex-grow flex flex-col">
               {state.script && (
                 <div className="flex gap-2 mb-2">
                   <button onClick={() => applyFormatting('bold')} className="p-1.5 bg-slate-900 rounded-lg border border-slate-700 text-xs px-3 font-bold hover:bg-slate-800 transition-colors" title="Bold">B</button>
                   <button onClick={() => applyFormatting('italic')} className="p-1.5 bg-slate-900 rounded-lg border border-slate-700 text-xs px-3 italic hover:bg-slate-800 transition-colors" title="Italic">I</button>
                   <button onClick={() => applyFormatting('strike')} className="p-1.5 bg-slate-900 rounded-lg border border-slate-700 text-xs px-3 line-through hover:bg-slate-800 transition-colors" title="Strikethrough">S</button>
                   <button onClick={() => applyFormatting('code')} className="p-1.5 bg-slate-900 rounded-lg border border-slate-700 text-xs px-3 font-mono hover:bg-slate-800 transition-colors" title="Code">{}</button>
                   <button onClick={() => applyFormatting('bullet')} className="p-1.5 bg-slate-900 rounded-lg border border-slate-700 text-xs px-3 hover:bg-slate-800 transition-colors" title="Bullet List">• List</button>
                 </div>
               )}
              <textarea 
                ref={scriptTextareaRef} 
                className="w-full flex-grow bg-slate-900/50 border border-slate-700 rounded-xl p-4 myanmar-font text-slate-300 min-h-[300px] focus:border-amber-500 focus:outline-none transition-colors leading-relaxed" 
                value={state.script} 
                onChange={e => setState(p => ({ ...p, script: e.target.value }))} 
                placeholder="The AI generated script will appear here for you to edit..."
              />
            </div>

            {/* Intro Hooks Section */}
            {state.hooks.length > 0 && (
              <div className="mt-6 border-t border-slate-700 pt-6">
                <h3 className="text-xs font-bold text-slate-400 uppercase mb-4 tracking-widest flex items-center gap-2">
                  <svg className="h-3 w-3 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                  </svg>
                  Attention Hooks (စိတ်ဝင်စားဖွယ် အဖွင့်များ)
                </h3>
                <div className="space-y-3">
                  {state.hooks.map((hook, idx) => (
                    <div key={idx} className="group relative bg-slate-900/40 border border-slate-700/50 rounded-xl p-3 myanmar-font text-sm text-slate-300 hover:border-amber-500/30 transition-all">
                      <p className="pr-12">{hook}</p>
                      <button 
                        onClick={() => copyToClipboard(hook, idx)}
                        className={`absolute top-2 right-2 p-1.5 rounded-lg transition-all ${
                          copiedHookIndex === idx 
                          ? 'bg-green-500 text-white' 
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-amber-500 opacity-0 group-hover:opacity-100'
                        }`}
                      >
                        {copiedHookIndex === idx ? (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                          </svg>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {state.script && (
              <div className="mt-6 space-y-6 border-t border-slate-700 pt-6">
                <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800">
                  <h3 className="text-xs font-bold text-slate-400 uppercase mb-4 tracking-widest flex items-center justify-between">
                    AI Narration Settings
                  </h3>
                  
                  {/* Mastering Toggle */}
                  <div className="flex items-center justify-between bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 mb-3">
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <svg className="h-3 w-3 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Audio Mastering
                      </label>
                    </div>
                    <button 
                      onClick={() => setState(p => ({ ...p, enableMastering: !p.enableMastering }))}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${state.enableMastering ? 'bg-amber-500' : 'bg-slate-700'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${state.enableMastering ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>

                  {/* Narration Speed Slider */}
                  <div className="mb-2 bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <svg className="h-3 w-3 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Narration Speed
                      </label>
                      <span className="text-xs font-black text-amber-500 tabular-nums bg-amber-500/10 px-2 py-0.5 rounded">{state.narrationSpeed.toFixed(2)}x</span>
                    </div>
                    <input 
                      type="range" 
                      min="0.75" 
                      max="1.75" 
                      step="0.05"
                      value={state.narrationSpeed} 
                      onChange={e => setState(p => ({ ...p, narrationSpeed: parseFloat(e.target.value) }))} 
                      className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500" 
                    />
                    <div className="flex justify-between mt-1 px-1">
                      <span className="text-[9px] text-slate-600 font-bold uppercase">Slow</span>
                      <span className="text-[9px] text-slate-600 font-bold uppercase">Recap Fast</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Select Narrative Voice</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(Object.keys(VoiceDescriptions) as VoiceName[]).map(v => {
                      const voice = VoiceDescriptions[v];
                      const isSelected = selectedVoice === v;
                      const isPreviewing = previewingVoice === v;
                      
                      return (
                        <div 
                          key={v}
                          onClick={() => setSelectedVoice(v)}
                          className={`relative group cursor-pointer p-4 rounded-2xl border transition-all duration-300 ${
                            isSelected 
                            ? 'bg-amber-500/10 border-amber-500 shadow-xl shadow-amber-500/5' 
                            : 'bg-slate-900/50 border-slate-700 hover:border-slate-500'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl transition-all ${
                              isSelected ? 'bg-amber-500 text-slate-950 scale-105 rotate-3' : 'bg-slate-800 text-slate-400'
                            }`}>
                              {voice.icon}
                            </div>
                            <div className="flex-grow overflow-hidden">
                              <div className="flex items-center justify-between">
                                <span className={`font-bold text-base ${isSelected ? 'text-amber-500' : 'text-slate-200'}`}>
                                  {voice.label}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-500 uppercase tracking-tighter font-bold">{voice.role}</p>
                            </div>
                          </div>
                          <p className="mt-3 text-[11px] text-slate-400 myanmar-font leading-relaxed">{voice.description}</p>
                          
                          <button
                            onClick={(e) => handlePreviewVoice(v, e)}
                            disabled={!!previewingVoice}
                            className={`absolute top-3 right-3 p-2 rounded-xl transition-all ${
                              isPreviewing 
                              ? 'bg-amber-500 text-slate-950 animate-pulse' 
                              : 'bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-white backdrop-blur-md'
                            }`}
                            title="Test Audio"
                          >
                            {isPreviewing ? (
                              <div className="flex gap-0.5 items-end h-3">
                                <div className="w-0.5 h-1.5 bg-slate-950 animate-bounce"></div>
                                <div className="w-0.5 h-3 bg-slate-950 animate-bounce [animation-delay:0.1s]"></div>
                                <div className="w-0.5 h-2 bg-slate-950 animate-bounce [animation-delay:0.2s]"></div>
                              </div>
                            ) : (
                              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 14.657a1 1 0 01-1.414-1.414A5 5 0 0011 10a1 1 0 112 0 7 7 0 012.657 4.657z" clipRule="evenodd" />
                              </svg>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-center pt-2">
                  <button 
                    onClick={handleGenerateAudio} 
                    disabled={state.isGeneratingAudio} 
                    className={`w-full py-5 rounded-2xl font-bold transition-all flex items-center justify-center gap-3 shadow-2xl ${
                      state.isGeneratingAudio 
                      ? 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700' 
                      : 'bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white shadow-amber-600/20 active:scale-[0.98]'
                    }`}
                  >
                    {state.isGeneratingAudio ? (
                      <>
                        <div className="w-6 h-6 border-2 border-slate-700 border-t-amber-500 rounded-full animate-spin"></div>
                        Rendering Narration...
                      </>
                    ) : (
                      <>
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Produce Mastered Audio
                      </>
                    )}
                  </button>
                </div>

                {state.audioUrl && (
                  <div className="bg-slate-900/80 backdrop-blur-xl rounded-2xl p-5 border border-amber-500/20 animate-in fade-in slide-in-from-bottom-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex flex-col overflow-hidden">
                        <span className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em]">Ready for Production</span>
                        <span className="text-sm font-bold text-slate-100 myanmar-font truncate max-w-[200px]">{state.title || "Narration_Final"}</span>
                      </div>
                      <a 
                        href={state.audioUrl} 
                        download={`${(state.title || "movie_recap").replace(/[^\w\u1000-\u109F\s]/g, '').replace(/\s+/g, '_')}.wav`} 
                        className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-5 py-2.5 rounded-xl text-xs font-black shadow-lg shadow-amber-500/20 transition-all active:scale-95 flex items-center gap-2"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        DOWNLOAD WAV
                      </a>
                    </div>
                    <audio src={state.audioUrl} controls className="w-full filter invert hue-rotate-180 brightness-150 saturate-0" />
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </main>
      
      <footer className="mt-16 pb-12 text-slate-600 text-[10px] border-t border-slate-800 pt-8 w-full text-center tracking-[0.3em] uppercase font-bold">
        © 2026 Movie Recap AI • Deep Intelligence Narrative Engine
      </footer>
    </div>
  );
};

export default App;
