
import React, { useState, useEffect } from 'react';
import { WorkoutEntry, IdentityState, WorkoutPlan } from '../types.ts';
import { GoogleGenAI } from '@google/genai';
import { 
  BrainCircuit, 
  Loader2, 
  BarChart3, 
  TrendingUp, 
  ShieldCheck, 
  Cloud, 
  CloudOff, 
  UploadCloud, 
  DownloadCloud, 
  RefreshCw,
  Link,
  Info,
  AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';

// Resolve TS2580: Cannot find name 'process'
declare var process: {
  env: {
    API_KEY: string;
    GOOGLE_CLIENT_ID: string;
    [key: string]: string | undefined;
  };
};

declare const google: any;

interface DiscoveryPanelProps {
  entries: WorkoutEntry[];
  plans: WorkoutPlan[];
  onUpdateEntries: (entries: WorkoutEntry[]) => void;
  onUpdatePlans: (plans: WorkoutPlan[]) => void;
}

const DiscoveryPanel: React.FC<DiscoveryPanelProps> = ({ 
  entries, 
  plans, 
  onUpdateEntries, 
  onUpdatePlans 
}) => {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'loading' | 'success' | 'error'>('idle');
  const [customSyncName, setCustomSyncName] = useState(() => `sync.${format(new Date(), 'ss.mm.HH.dd.MM.yyyy')}`);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    setCustomSyncName(`sync.${format(new Date(), 'ss.mm.HH.dd.MM.yyyy')}`);
  }, []);

  const loginWithGoogle = () => {
    setAuthError(null);
    try {
      if (typeof google !== 'undefined' && google.accounts?.oauth2) {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        
        if (!clientId || clientId.includes("placeholder")) {
          setAuthError("Configuration Missing: GOOGLE_CLIENT_ID environment variable is not set.");
          return;
        }

        const client = google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'https://www.googleapis.com/auth/drive.file',
          callback: (response: any) => {
            if (response.access_token) {
              setAccessToken(response.access_token);
              setSyncStatus('success');
              setAuthError(null);
            } else if (response.error) {
              setAuthError(`Auth Error: ${response.error_description || response.error}`);
              setSyncStatus('error');
            }
          },
          error_callback: (err: any) => {
            setAuthError(`OAuth Client Error: ${err.message || 'Check your Client ID and Authorized Origins'}`);
            setSyncStatus('error');
          }
        });
        client.requestAccessToken();
      } else {
        setAuthError("GSI library not initialized. Verify internet connectivity.");
      }
    } catch (e: any) {
      console.error("GSI Init Error:", e);
      setAuthError(`System Error: ${e.message || 'Unknown initialization failure'}`);
      setSyncStatus('error');
    }
  };

  const performSync = async () => {
    if (!accessToken) return loginWithGoogle();
    setSyncStatus('syncing');
    
    try {
      const manifest = {
        version: '1.7',
        timestamp: Date.now(),
        data: { entries, plans }
      };

      const fileContent = JSON.stringify(manifest);
      const metadata = {
        name: `${customSyncName}.json`,
        mimeType: 'application/json',
      };

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', new Blob([fileContent], { type: 'application/json' }));

      const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
      });

      if (response.ok) {
        setSyncStatus('success');
        setTimeout(() => setSyncStatus('idle'), 3000);
      } else {
        const errData = await response.json();
        throw new Error(errData.error?.message || 'Upload failed');
      }
    } catch (e: any) {
      console.error(e);
      setAuthError(`Sync Failure: ${e.message}`);
      setSyncStatus('error');
    }
  };

  const loadLatestSync = async () => {
    if (!accessToken) return loginWithGoogle();
    setSyncStatus('loading');

    try {
      const listResponse = await fetch('https://www.googleapis.com/drive/v3/files?q=name contains "sync." and name contains ".json"&orderBy=createdTime desc&pageSize=1', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const listData = await listResponse.json();

      if (listData.files && listData.files.length > 0) {
        const fileId = listData.files[0].id;
        const fileResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const manifest = await fileResponse.json();

        if (manifest.data) {
          onUpdateEntries(manifest.data.entries || []);
          onUpdatePlans(manifest.data.plans || []);
          setSyncStatus('success');
          setTimeout(() => setSyncStatus('idle'), 3000);
        }
      } else {
        setAuthError("No cloud manifests detected in primary drive.");
        setSyncStatus('idle');
      }
    } catch (e: any) {
      console.error(e);
      setAuthError(`Load Failure: ${e.message}`);
      setSyncStatus('error');
    }
  };

  const performDiscovery = async () => {
    if (entries.length < 3) {
      setAnalysis("Insufficient data for pattern discovery. Continue logging sessions.");
      return;
    }

    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Act as an elite sports scientist. Analyze these training logs for patterns, fatigue accumulation, and identity state transitions. Provide a concise executive summary of the trainee's current performance trajectory. Data: ${JSON.stringify(entries.slice(-15))}`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt
      });
      
      setAnalysis(response.text || "Discovery engine returned no insights.");
    } catch (error) {
      console.error(error);
      setAnalysis("Error initializing discovery engine.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <BrainCircuit className="text-violet-500" />
            Pattern Discovery
          </h2>
          <p className="text-sm text-neutral-500 font-mono">AI-driven identity state correlation</p>
        </div>
        
        <button 
          onClick={performDiscovery}
          disabled={loading}
          className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-all font-bold flex items-center gap-2 disabled:opacity-50"
        >
          {loading ? <Loader2 className="animate-spin" size={18} /> : <TrendingUp size={18} />}
          Initialize Analysis
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 min-h-[400px] relative overflow-hidden h-full shadow-2xl">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center space-y-4">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-violet-500/20 rounded-full border-t-violet-500 animate-spin" />
                  <BrainCircuit className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-violet-500" size={24} />
                </div>
                <div className="text-sm font-mono text-neutral-500 animate-pulse">Scanning identity matrices...</div>
              </div>
            ) : analysis ? (
              <div className="prose prose-invert max-w-none relative z-10">
                <div className="text-[10px] font-mono text-violet-400 uppercase tracking-widest mb-4">Discovery Results v1.1</div>
                <div className="whitespace-pre-wrap text-neutral-300 leading-relaxed font-sans text-sm md:text-base">
                  {analysis}
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50">
                <BarChart3 size={48} className="text-neutral-700" />
                <div>
                  <p className="text-neutral-400">System idle. No active patterns detected.</p>
                  <p className="text-[10px] font-mono text-neutral-600 mt-2 uppercase tracking-tighter">Requires manual initialization</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-xl">
            <h3 className="text-xs font-mono text-neutral-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <ShieldCheck size={14} className="text-emerald-500" />
              Continuity Score
            </h3>
            <div className="text-4xl font-bold text-white mb-2">94%</div>
            <div className="w-full h-1 bg-neutral-800 rounded-full overflow-hidden">
               <div className="w-[94%] h-full bg-emerald-500" />
            </div>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 relative group overflow-hidden shadow-xl">
            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500/50 group-hover:bg-emerald-500 transition-all" />
            
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        {accessToken ? <Cloud className="text-emerald-500" size={16} /> : <CloudOff className="text-neutral-600" size={16} />}
                        System Sync
                    </h3>
                </div>
                {!accessToken && (
                    <button 
                        onClick={loginWithGoogle}
                        className="px-2 py-1 bg-neutral-100 hover:bg-white text-black text-[9px] font-bold rounded transition-all flex items-center gap-1 uppercase"
                    >
                        <Link size={10} /> Link
                    </button>
                )}
            </div>

            <div className="space-y-4">
                {authError && (
                  <div className="bg-rose-500/10 border border-rose-500/30 p-3 rounded-lg flex gap-2 items-start animate-in fade-in slide-in-from-top-1">
                    <AlertTriangle size={14} className="text-rose-500 shrink-0 mt-0.5" />
                    <div className="text-[10px] text-rose-300 leading-tight">
                      <span className="font-bold uppercase block mb-1">Authorization Failed</span>
                      {authError}
                      <div className="mt-2 pt-2 border-t border-rose-500/20 text-[9px] opacity-70">
                        Ensure your origin URL is whitelisted in Google Console.
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                    <label className="text-[9px] font-mono text-neutral-600 uppercase tracking-widest block flex items-center justify-between">
                        Manifest Pattern
                        <Info size={10} className="text-neutral-700 cursor-help" title="Identifies the sync file on Drive" />
                    </label>
                    <div className="flex bg-black/40 border border-neutral-800 rounded-lg p-2 items-center gap-2">
                        <RefreshCw size={12} className={`text-neutral-500 ${syncStatus === 'syncing' ? 'animate-spin text-emerald-500' : ''}`} />
                        <input 
                            type="text"
                            value={customSyncName}
                            onChange={(e) => setCustomSyncName(e.target.value)}
                            className="bg-transparent border-none text-[10px] font-mono text-neutral-300 focus:ring-0 flex-1 p-0"
                        />
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <button 
                        onClick={performSync}
                        disabled={syncStatus === 'syncing' || !accessToken}
                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 text-white rounded-lg font-bold text-[10px] flex items-center justify-center gap-2 transition-all"
                    >
                        <UploadCloud size={14} /> 
                        {syncStatus === 'syncing' ? 'Syncing...' : 'Manual Sync'}
                    </button>
                    <button 
                        onClick={loadLatestSync}
                        disabled={syncStatus === 'loading' || !accessToken}
                        className="w-full py-2 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 text-white rounded-lg font-bold text-[10px] flex items-center justify-center gap-2 transition-all"
                    >
                        <DownloadCloud size={14} /> 
                        {syncStatus === 'loading' ? 'Loading...' : 'Load Latest'}
                    </button>
                </div>
            </div>
          </div>

          <div className="bg-violet-900/10 border border-violet-800/30 rounded-xl p-5 shadow-xl">
             <div className="flex items-center gap-2 mb-2">
                <Info size={12} className="text-violet-400" />
                <span className="text-[10px] font-mono text-violet-400 uppercase font-bold">Setup Required</span>
             </div>
             <p className="text-[10px] text-neutral-400 leading-relaxed">
               OAuth requires a valid <strong>GOOGLE_CLIENT_ID</strong> in your environment. 
               Your current origin must also be added to <span className="text-violet-300">Authorized JavaScript Origins</span> in the Cloud Console.
             </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiscoveryPanel;
