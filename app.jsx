import React, { useState, useRef, useEffect } from 'react';
import { 
  Settings, Play, Download, Wand2, Image as ImageIcon, Music, 
  FileText, CheckCircle, Loader2, Video, Layers, AlertCircle, 
  Clock, Globe, Sparkles, Hash, Zap, HelpCircle, Smartphone, 
  Monitor, Mic, X, Key 
} from 'lucide-react';

const App = () => {
  // --- State Management ---
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentStep, setCurrentStep] = useState(1);
  
  // User Inputs
  const [topic, setTopic] = useState('');
  const [selectedTitle, setSelectedTitle] = useState('');
  const [userApiKey, setUserApiKey] = useState(''); // State for custom user API key
  
  // New State for Ratio, Duration, Language, Voice
  const [aspectRatio, setAspectRatio] = useState('16:9'); // '9:16' or '16:9'
  const [duration, setDuration] = useState('60'); 
  const [language, setLanguage] = useState('English');
  const [selectedVoice, setSelectedVoice] = useState('Aoede'); // Default Voice
  
  // Generated Content
  const [titles, setTitles] = useState([]);
  const [scriptData, setScriptData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [progress, setProgress] = useState(0);

  // Notifications
  const [notification, setNotification] = useState(null);

  // New Features State
  const [metadata, setMetadata] = useState(null); 
  const [isPolishing, setIsPolishing] = useState(false);
  
  // Video Elements
  const canvasRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioDestinationRef = useRef(null);
  const requestAnimationRef = useRef(null);
  
  const [recordedChunks, setRecordedChunks] = useState([]);
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState(null);

  // --- API Helpers ---
  const envApiKey = ""; // Injected by environment
  // Use user provided key if available, otherwise use environment key
  const apiKey = userApiKey || envApiKey;

  // Helper: Show Notification
  const showNotification = (message, type = 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Helper: Convert PCM to WAV for playback
  const pcmToWav = (pcmBase64, sampleRate = 24000) => {
    const binaryString = atob(pcmBase64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    const wavHeader = new ArrayBuffer(44);
    const view = new DataView(wavHeader);
    const writeString = (view, offset, string) => {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    };
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + len, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, len, true);
    
    const wavBytes = new Uint8Array(wavHeader.byteLength + len);
    wavBytes.set(new Uint8Array(wavHeader), 0);
    wavBytes.set(bytes, wavHeader.byteLength);
    
    const blob = new Blob([wavBytes], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
  };

  // Estimation Helpers
  const getEstimatedWords = (seconds) => Math.round((parseInt(seconds) / 60) * 145); // Slightly faster for shorts
  
  // Dynamic Duration Options based on Aspect Ratio
  const getDurationOptions = () => {
    if (aspectRatio === '9:16') {
        // Shorts: 10s to 60s
        return [
            { label: '10 Seconds', value: '10' },
            { label: '20 Seconds', value: '20' },
            { label: '30 Seconds', value: '30' },
            { label: '45 Seconds', value: '45' },
            { label: '60 Seconds (1 Min)', value: '60' },
        ];
    } else {
        // Long Videos: 1m to 30m
        return Array.from({ length: 30 }, (_, i) => ({ 
            label: `${i + 1} Minute${i === 0 ? '' : 's'}`,
            value: `${(i + 1) * 60}`
        }));
    }
  };

  // Voice Options
  const voiceOptions = [
    { name: 'Female - Soft (Aoede)', id: 'Aoede' },
    { name: 'Female - Energetic (Kore)', id: 'Kore' },
    { name: 'Male - Deep (Fenrir)', id: 'Fenrir' },
    { name: 'Male - Narrator (Charon)', id: 'Charon' },
    { name: 'Male - Casual (Puck)', id: 'Puck' },
  ];

  // 1. Generate Titles
  const generateTitles = async () => {
    if (!topic) return showNotification("Please enter a topic", "error");
    setLoading(true);
    setLoadingMessage(`Generating ${aspectRatio === '9:16' ? 'Shorts' : 'Video'} Titles...`);
    try {
      const prompt = `You are a YouTube viral expert. Create 5 short, clickbaity, and viral video titles for the topic: "${topic}". 
      Format: ${aspectRatio === '9:16' ? 'YouTube Shorts / TikTok Style' : 'YouTube Long Video Style'}.
      Language: ${language}.
      Return ONLY the titles separated by a pipe symbol (|). Do not add numbering or extra text.`;
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const titleList = text.split('|').map(t => t.trim()).filter(t => t.length > 0);
      setTitles(titleList);
      setCurrentStep(2);
    } catch (e) { console.error(e); showNotification("Error generating titles. Please check API Key.", "error"); } finally { setLoading(false); }
  };

  // 2. Generate Script
  const generateScript = async (title) => {
    setSelectedTitle(title);
    const targetWords = getEstimatedWords(duration);
    setLoading(true);
    setLoadingMessage(`Writing Script (~${targetWords} words)...`);
    try {
      const prompt = `Create a video script for the title: "${title}". 
      Target Duration: ${duration} seconds.
      Target Word Count: Approx ${targetWords} words.
      Aspect Ratio: ${aspectRatio} (${aspectRatio === '9:16' ? 'Vertical, focus on center' : 'Horizontal, cinematic'}).
      Language: ${language}.
      Divide the script into scenes naturally based on the flow.
      Return valid JSON array of objects. 
      Format: [{"text": "Voiceover text here", "image_prompt": "Detailed description, ensure visual fits ${aspectRatio} aspect ratio"}]`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } })
      });
      const data = await response.json();
      const scriptJson = JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text);
      setScriptData(scriptJson.map(s => ({ ...s, imageSrc: null, audioUrl: null, audioDuration: 3000 })));
      setMetadata(null);
      setCurrentStep(3);
    } catch (e) { console.error(e); showNotification("Error generating script.", "error"); } finally { setLoading(false); }
  };

  // 3. Generate Visuals & Audio
  const generateAssets = async () => {
    setLoading(true);
    setLoadingMessage("Generating Visuals & Audio in Parallel...");
    let updatedScriptData = [...scriptData];
    let completedCount = 0;
    const totalItems = updatedScriptData.length * 2; 

    const updateProgress = () => {
        completedCount++;
        setProgress((completedCount / totalItems) * 100);
    };

    const processScene = async (scene, index) => {
        // Image Prompt Adjustment based on Ratio
        const ratioKeywords = aspectRatio === '9:16' ? "vertical, portrait format, 9:16 aspect ratio, tall image" : "cinematic, wide angle, 16:9 aspect ratio";
        let imageSrc = `https://placehold.co/${aspectRatio === '9:16' ? '720x1280' : '1280x720'}/222/FFF?text=Scene+${index+1}`;
        
        try {
            const imgResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ instances: [{ prompt: `Photorealistic, 8k, ${ratioKeywords}, ${scene.image_prompt}` }], parameters: { sampleCount: 1 } })
            });
            const imgData = await imgResponse.json();
            if (imgData.predictions?.[0]?.bytesBase64Encoded) {
                imageSrc = `data:image/png;base64,${imgData.predictions[0].bytesBase64Encoded}`;
            }
        } catch (e) { console.error("Image Gen Error", e); }
        updateProgress();

        // Audio with Selected Voice
        let audioUrl = null;
        let audioDuration = 3000;
        try {
            const ttsResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: scene.text }] }],
                    generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice } } } }
                })
            });
            const ttsData = await ttsResponse.json();
            const audioBase64 = ttsData.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (audioBase64) {
                audioUrl = pcmToWav(audioBase64);
                const byteLength = (audioBase64.length * 3) / 4; 
                audioDuration = (byteLength / 48000) * 1000 + 500; 
            }
        } catch (e) { console.error("TTS Gen Error", e); }
        updateProgress();
        return { ...scene, imageSrc, audioUrl, audioDuration };
    };

    try {
        const results = await Promise.all(updatedScriptData.map((scene, i) => processScene(scene, i)));
        setScriptData(results);
        setCurrentStep(4);
    } catch (e) { console.error(e); showNotification("Error in parallel generation.", "error"); } finally { setLoading(false); setProgress(0); }
  };

  // 4. Render Video
  const renderVideo = async () => {
    setIsRendering(true);
    setRecordedChunks([]); 
    setRenderProgress(0);
    
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioContext();
    audioContextRef.current = audioCtx;
    const dest = audioCtx.createMediaStreamDestination();
    audioDestinationRef.current = dest;

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    gainNode.gain.value = 0; 
    oscillator.connect(gainNode);
    gainNode.connect(dest);
    oscillator.start();

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    const canvasStream = canvas.captureStream(30);
    const combinedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...dest.stream.getAudioTracks()
    ]);
    
    let options = { mimeType: 'video/webm; codecs=vp9' };
    if (MediaRecorder.isTypeSupported('video/webm; codecs=vp8')) options = { mimeType: 'video/webm; codecs=vp8' };
    else if (MediaRecorder.isTypeSupported('video/webm')) options = { mimeType: 'video/webm' };

    const mediaRecorder = new MediaRecorder(combinedStream, { ...options, videoBitsPerSecond: 3000000 });
    mediaRecorderRef.current = mediaRecorder;
    
    let localChunks = [];
    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        localChunks.push(event.data);
        setRecordedChunks((prev) => [...prev, event.data]);
      }
    };
    
    mediaRecorder.onstop = () => {
      const blob = new Blob(localChunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
      setIsRendering(false);
      
      if (requestAnimationRef.current) cancelAnimationFrame(requestAnimationRef.current);
      oscillator.stop();
      audioCtx.close();
      
      if (blob.size > 0) {
          const a = document.createElement('a');
          a.href = url;
          a.download = `viral_${aspectRatio === '9:16' ? 'short' : 'video'}_${Date.now()}.webm`;
          a.click();
      }
    };

    mediaRecorder.start(500); 

    let currentSceneIndex = 0;
    let currentImage = new Image();
    currentImage.src = scriptData[0].imageSrc;
    await new Promise(r => currentImage.onload = r);

    // Continuous Draw Loop
    const drawFrame = () => {
        if (!ctx) return;
        
        // Draw Image (Cover mode)
        // Simple draw for now, assume generated image matches ratio roughly or center crop
        ctx.drawImage(currentImage, 0, 0, canvas.width, canvas.height);
        
        if (scriptData[currentSceneIndex]) {
            const scene = scriptData[currentSceneIndex];
            // Styling based on Ratio
            const isVertical = aspectRatio === '9:16';
            
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            // Subtitle Box
            const boxHeight = isVertical ? 200 : 140;
            ctx.fillRect(0, canvas.height - boxHeight, canvas.width, boxHeight);
            
            ctx.font = isVertical ? 'bold 40px Arial' : 'bold 32px Arial';
            ctx.fillStyle = 'white';
            ctx.textAlign = 'center';
            
            // Text Wrapping
            const maxWidth = canvas.width - 60;
            const text = scene.text;
            const words = text.split(' ');
            let line = '';
            let lines = [];
            
            for(let n = 0; n < words.length; n++) {
              const testLine = line + words[n] + ' ';
              const metrics = ctx.measureText(testLine);
              const testWidth = metrics.width;
              if (testWidth > maxWidth && n > 0) {
                lines.push(line);
                line = words[n] + ' ';
              } else {
                line = testLine;
              }
            }
            lines.push(line);

            // Draw Lines
            const lineHeight = isVertical ? 50 : 40;
            const startY = canvas.height - (boxHeight/2) - ((lines.length - 1) * lineHeight / 2) + 10;
            
            lines.forEach((l, k) => {
                ctx.fillText(l, canvas.width / 2, startY + (k * lineHeight));
            });
        }
        requestAnimationRef.current = requestAnimationFrame(drawFrame);
    };
    
    drawFrame();

    for (let i = 0; i < scriptData.length; i++) {
        currentSceneIndex = i;
        setRenderProgress(Math.round(((i) / scriptData.length) * 100));
        const scene = scriptData[i];
        
        if (i < scriptData.length) {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.src = scene.imageSrc;
            await new Promise(r => img.onload = r); 
            currentImage = img; 
        }

        if (scene.audioUrl) {
            const audioResponse = await fetch(scene.audioUrl);
            const arrayBuffer = await audioResponse.arrayBuffer();
            const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
            const source = audioCtx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(dest);
            source.start(0);
            await new Promise(resolve => setTimeout(resolve, (audioBuffer.duration * 1000) + 100)); 
        } else {
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
    mediaRecorder.stop();
    setRenderProgress(100);
  };

  const generateMetadata = async () => { /* existing logic */ };

  // --- UI ---
  const StepIndicator = () => (
    <div className="flex justify-between items-center mb-8 px-4">
      {['Concept', 'Title', 'Script', 'Visuals', 'Render'].map((label, idx) => (
        <div key={idx} className={`flex flex-col items-center ${currentStep >= idx + 1 ? 'text-blue-500' : 'text-gray-500'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${currentStep >= idx + 1 ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-600 bg-gray-800'}`}>
            {currentStep >= idx + 1 ? <CheckCircle size={16} /> : idx + 1}
          </div>
          <span className="text-xs mt-1">{label}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans selection:bg-blue-500 selection:text-white">
      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 fade-in">
          <div className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg ${notification.type === 'error' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}>
            {notification.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
            <span className="font-medium">{notification.message}</span>
            <button onClick={() => setNotification(null)} className="ml-2 hover:bg-white/20 rounded-full p-1"><X size={16} /></button>
          </div>
        </div>
      )}

      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-2 rounded-lg"><Video size={20} /></div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">ViralVideo Creator Pro</h1>
          </div>
          <button onClick={() => setActiveTab(activeTab === 'settings' ? 'dashboard' : 'settings')} className="p-2 hover:bg-gray-800 rounded-full">
            <Settings size={20} className={activeTab === 'settings' ? 'text-blue-400' : 'text-gray-400'} />
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 md:p-8">
        {activeTab === 'settings' && (
           <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 max-w-lg mx-auto">
             <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400"><Key size={24} /></div>
                <h2 className="text-xl font-bold">API Configuration</h2>
             </div>
             
             <div className="space-y-4">
                <div>
                   <label className="block text-sm font-medium text-gray-400 mb-1">Google Gemini API Key</label>
                   <input 
                      type="password" 
                      value={userApiKey} 
                      onChange={(e) => setUserApiKey(e.target.value)}
                      placeholder="Enter your AI Studio API Key..." 
                      className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white focus:border-blue-500 outline-none placeholder-gray-600"
                   />
                   <p className="text-xs text-gray-500 mt-2">
                      Needed for high-volume usage. Get one from <a href="https://aistudio.google.com/" target="_blank" className="text-blue-400 hover:underline">Google AI Studio</a>.
                      Leave empty to use free trial quota.
                   </p>
                </div>
                
                <div className="pt-4 flex justify-end">
                   <button onClick={() => setActiveTab('dashboard')} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors">
                      Save & Close
                   </button>
                </div>
             </div>
           </div>
        )}

        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <StepIndicator />
            
            {/* Step 1: Input */}
            {currentStep === 1 && (
              <div className="bg-gray-800 rounded-xl p-8 text-center border border-gray-700">
                <Wand2 size={32} className="text-blue-400 mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-6">Create Viral Video</h2>
                
                <div className="max-w-xl mx-auto space-y-4 text-left">
                  {/* Topic */}
                  <div>
                      <label className="text-xs text-gray-400 font-bold ml-1 mb-1 block uppercase tracking-wide">Video Topic</label>
                      <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Scariest Places on Earth, AI Future..." className="w-full bg-gray-900 border border-gray-600 rounded-lg py-3 px-4 text-white focus:border-blue-500 outline-none" />
                  </div>

                  {/* Aspect Ratio Selector */}
                  <div className="grid grid-cols-2 gap-4">
                      <div 
                        onClick={() => { setAspectRatio('9:16'); setDuration('60'); }}
                        className={`cursor-pointer p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${aspectRatio === '9:16' ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700 bg-gray-800 hover:border-gray-600'}`}
                      >
                        <Smartphone size={24} className={aspectRatio === '9:16' ? 'text-blue-400' : 'text-gray-400'} />
                        <span className="text-sm font-bold">Shorts / Reels (9:16)</span>
                      </div>
                      <div 
                        onClick={() => { setAspectRatio('16:9'); setDuration('60'); }}
                        className={`cursor-pointer p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${aspectRatio === '16:9' ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700 bg-gray-800 hover:border-gray-600'}`}
                      >
                        <Monitor size={24} className={aspectRatio === '16:9' ? 'text-blue-400' : 'text-gray-400'} />
                        <span className="text-sm font-bold">YouTube Video (16:9)</span>
                      </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    {/* Duration */}
                    <div>
                      <label className="text-xs text-gray-400 block mb-1 flex items-center gap-1"><Clock size={12}/> Duration</label>
                      <select value={duration} onChange={(e) => setDuration(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2.5 text-sm outline-none focus:border-blue-500">
                        {getDurationOptions().map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                    </div>

                    {/* Language */}
                    <div>
                      <label className="text-xs text-gray-400 block mb-1 flex items-center gap-1"><Globe size={12}/> Language</label>
                      <select value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2.5 text-sm outline-none focus:border-blue-500">
                        {['English', 'Hindi', 'Urdu', 'Spanish', 'German', 'French'].map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>

                    {/* Voice */}
                    <div>
                      <label className="text-xs text-gray-400 block mb-1 flex items-center gap-1"><Mic size={12}/> Voice</label>
                      <select value={selectedVoice} onChange={(e) => setSelectedVoice(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2.5 text-sm outline-none focus:border-blue-500">
                        {voiceOptions.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <button onClick={generateTitles} disabled={loading || !topic} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg flex justify-center gap-2 items-center disabled:opacity-50 mt-4 transition-all hover:scale-[1.02]">
                    {loading ? <Loader2 className="animate-spin" /> : <Wand2 size={20} />} Generate Titles
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Titles */}
            {currentStep === 2 && (
              <div className="space-y-4">
                 <h2 className="text-xl font-bold">Select Title</h2>
                 <div className="grid gap-3">
                    {titles.map((t, i) => (
                      <button key={i} onClick={() => generateScript(t)} disabled={loading} className="text-left bg-gray-800 p-4 rounded-xl hover:border-blue-500 border border-gray-700 transition-colors">
                        {t} {loading && selectedTitle === t && <Loader2 className="inline animate-spin ml-2" size={16}/>}
                      </button>
                    ))}
                 </div>
              </div>
            )}

            {/* Step 3: Script */}
            {currentStep === 3 && (
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                   <div>
                      <h2 className="text-xl font-bold">Script Preview</h2>
                      <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                          <span className="bg-gray-700 px-2 py-0.5 rounded text-gray-200">{aspectRatio}</span>
                          <span className="bg-gray-700 px-2 py-0.5 rounded text-gray-200">{duration}s</span>
                          <span>{scriptData.length} Scenes</span>
                      </div>
                   </div>
                   <div className="flex gap-2">
                        <button onClick={generateAssets} className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-green-900/50 transition-all hover:scale-105">
                            <Zap size={16} className="text-yellow-300" fill="currentColor"/> Fast Generate
                        </button>
                   </div>
                </div>

                <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                  {scriptData.map((scene, idx) => (
                    <div key={idx} className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-bold text-gray-500 uppercase">Scene {idx + 1}</span>
                      </div>
                      <p className="text-gray-200 mb-2">{scene.text}</p>
                      <div className="text-xs text-gray-500 italic flex items-center gap-2"><ImageIcon size={12}/> {scene.image_prompt}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Loading Overlay */}
            {(loading) && currentStep !== 4 && (
               <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
                 <div className="bg-gray-800 p-8 rounded-2xl border border-gray-700 text-center max-w-sm w-full mx-4">
                    <Loader2 size={40} className="text-blue-500 animate-spin mx-auto mb-4" />
                    <h3 className="text-lg font-bold">{loadingMessage}</h3>
                    <div className="w-full bg-gray-700 rounded-full h-2 mt-4 overflow-hidden"><div className="bg-blue-500 h-full transition-all duration-300" style={{width: `${progress}%`}}></div></div>
                    <p className="text-xs text-gray-400 mt-2">Processing {Math.round(progress)}%</p>
                 </div>
               </div>
            )}

            {/* Step 4: Final Render */}
            {currentStep === 4 && !loading && (
              <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-1 space-y-3 max-h-[70vh] overflow-y-auto">
                   <h3 className="font-bold text-gray-400 text-xs uppercase">Timeline ({scriptData.length} Scenes)</h3>
                   {scriptData.map((scene, idx) => (
                     <div key={idx} className="bg-gray-800 p-2 rounded flex gap-3 items-center opacity-70 hover:opacity-100 transition-opacity">
                       <img src={scene.imageSrc} className="w-12 h-12 object-cover rounded bg-gray-900" alt={`Scene ${idx+1}`} />
                       <div className="min-w-0 flex-1">
                           <div className="text-xs truncate text-gray-300">{scene.text}</div>
                           <div className="text-[10px] text-gray-500 mt-0.5 flex gap-2">
                               {scene.audioUrl ? <span className="text-green-400 flex items-center gap-1"><Music size={8}/> Audio OK</span> : <span className="text-red-400">No Audio</span>}
                           </div>
                       </div>
                     </div>
                   ))}
                </div>

                <div className="md:col-span-2 space-y-4">
                   <div 
                      className="bg-black rounded-xl overflow-hidden relative border border-gray-800 shadow-2xl flex items-center justify-center"
                      style={{ aspectRatio: aspectRatio === '9:16' ? '9/16' : '16/9', maxHeight: '70vh', margin: '0 auto' }}
                   >
                      <canvas 
                        ref={canvasRef} 
                        width={aspectRatio === '9:16' ? 720 : 1280} 
                        height={aspectRatio === '9:16' ? 1280 : 720} 
                        className="w-full h-full object-contain" 
                      />
                      
                      {!isRendering && !videoUrl && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                           <button onClick={renderVideo} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-full font-bold flex items-center gap-3 transform hover:scale-105 transition-all shadow-xl border border-blue-400/30">
                             <Layers size={24} /> Render Video
                           </button>
                        </div>
                      )}

                      {isRendering && (
                        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-20">
                           <Loader2 size={48} className="text-blue-500 animate-spin mb-4" />
                           <h2 className="text-2xl font-bold text-white mb-2">Rendering Video...</h2>
                           <p className="text-gray-400 mb-6">Combining Scenes & Voice...</p>
                           <div className="w-64 h-2 bg-gray-800 rounded-full overflow-hidden">
                             <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${renderProgress}%` }}></div>
                           </div>
                           <p className="mt-2 text-sm text-blue-400 font-mono">{renderProgress}% Complete</p>
                        </div>
                      )}
                   </div>
                   
                   {videoUrl && (
                     <div className="space-y-4 animate-fade-in max-w-lg mx-auto">
                        <div className="bg-green-900/20 border border-green-500/30 p-4 rounded-xl flex justify-between items-center">
                            <div>
                              <h3 className="font-bold text-green-400">Video Ready!</h3>
                              <p className="text-xs text-gray-400">Ratio: {aspectRatio} • Voice: {selectedVoice}</p>
                            </div>
                            <a href={videoUrl} download={`viral_video_${Date.now()}.webm`} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
                              <Download size={16} /> Download
                            </a>
                        </div>
                     </div>
                   )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
