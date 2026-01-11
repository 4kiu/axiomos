
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
  LogOut,
  Zap
} from 'lucide-react';
import { format } from 'date-fns';

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
  // Added 'importing' status to match App.tsx syncStatus literals
  externalSyncStatus?: 'idle' | 'syncing' | 'loading' | 'success' | 'error' | 'importing';
  onManualSync?: () => void;
}

const DiscoveryPanel: React.FC<DiscoveryPanelProps> = ({ 
  entries, 
  plans, 
  onUpdateEntries, 
  onUpdatePlans,
  externalSyncStatus = 'idle',
  onManualSync
}) => {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(() => localStorage.getItem('axiom_sync_token'));
  const [userInfo, setUserInfo] = useState<{ name: string; email: string } | null>(() => {
    const saved = localStorage.getItem('axiom_sync_profile');
    return saved ? JSON.parse(saved) : null;
  });
  const [localSyncStatus, setLocalSyncStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [customSyncName] = useState(() => `sync.${format(new Date(), 'ss.mm.HH.dd.MM.yyyy')}`);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    // 30 day inactivity check: logout only if user has been away for more than 30 days
    const lastActive = localStorage.getItem('axiom_last_active_ts');
    const now = Date.now();
    const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;

    if (lastActive && (now - parseInt(lastActive) > thirtyDaysInMs)) {
      handleLogout();
    } else {
      localStorage.setItem('axiom_last_active_ts', now.toString());
    }

    if (accessToken && !userInfo) fetchUserInfo(accessToken);
  }, [accessToken, userInfo]);

  const fetchUserInfo = async (token: string) => {
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        const profile = { name: data.name, email: data.email };
        setUserInfo(profile);
        localStorage.setItem('axiom_sync_profile', JSON.stringify(profile));
      } else if (response.status === 401) {
        // Remember logged in account: keep profile but clear the stale token
        setAccessToken(null);
        localStorage.removeItem('axiom_sync_token');
      }
    } catch (e) {
      console.error("Discovery: Profile fetch failure", e);
    }
  };

  const loginWithGoogle = () => {
    setAuthError(null);
    localStorage.setItem('axiom_last_active_ts', Date.now().toString());
    try {
      if (typeof google !== 'undefined' && google.accounts?.oauth2) {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        if (!clientId || clientId.includes("placeholder")) {
          setAuthError("Configuration Missing: GOOGLE_CLIENT_ID environment variable is not set.");
          return;
        }

        const client = google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
          callback: (response: any) => {
            if (response.access_token) {
              const token = response.access_token;
              setAccessToken(token);
              localStorage.setItem('axiom_sync_token', token);
              setAuthError(null);
              fetchUserInfo(token);
              window.location.reload(); 
            }
          }
        });
        client.requestAccessToken();
      }
    } catch (e: any) {
      setAuthError(`System Error: ${e.message}`);
    }
  };

  const handleLogout = () => {
    setAccessToken(null);
    setUserInfo(null);
    localStorage.removeItem('axiom_sync_token');
    localStorage.removeItem('axiom_sync_profile');
    localStorage.removeItem('axiom_last_active_ts');
    setAuthError(null);
    window.location.reload();
  };

  const loadLatestSync = async () => {
    if (!accessToken) return loginWithGoogle();
    localStorage.setItem('axiom_last_active_ts', Date.now().toString());
    setLocalSyncStatus('loading');
    try {
      const q_folder = encodeURIComponent("name = 'Axiom' and mimeType = 'application/vnd.google-apps.folder' and trashed = false");
      const listFolder = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q_folder}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const folderData = await listFolder.json();
      const folderId = folderData.files?.[0]?.id;
      if (!folderId) {
        setAuthError("No cloud data found.");
        setLocalSyncStatus('idle');
        return;
      }
      const q = encodeURIComponent(`'${folderId}' in parents and name contains "sync." and trashed = false`);
      const listResponse = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=createdTime desc&pageSize=1`, {
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
          setLocalSyncStatus('success');
          setTimeout(() => setLocalSyncStatus('idle'), 2000);
        }
      } else {
        setAuthError("No sync manifests found.");
        setLocalSyncStatus('idle');
      }
    } catch (e: any) {
      setAuthError(`Load Failure: ${e.message}`);
      setLocalSyncStatus('error');
    }
  };

  const performDiscovery = async () => {
    localStorage.setItem('axiom_last_active_ts', Date.now().toString());
    if (entries.length < 3) {
      setAnalysis("Insufficient data for pattern discovery. Continue logging sessions.");
      return;
    }
    setLoading(true);
    try {
      // Initializing GoogleGenAI client with environment variable API key.
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Act as an elite sports scientist. Analyze these training logs for patterns, fatigue accumulation, and identity state transitions. Provide a concise executive summary. Data: ${JSON.stringify(entries.slice(-15))}`;
      // Always use ai.models.generateContent with model name and prompt.
      const response = await ai.models.generateContent({ model: 'gemini-3-pro-preview', contents: prompt });
      // Use response.text property directly, do not call as a method.
      setAnalysis(response.text || "No insights found.");
    } catch (error) {
      setAnalysis("Discovery engine failure.");
    } finally {
      setLoading(false);
    }
  };

  const getSyncDisplayText = () => {
    if (externalSyncStatus === 'importing') return 'IMPORTING...';
    if (externalSyncStatus === 'syncing') return 'SYNCING...';
    return customSyncName;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12 sm:pb-0">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-neutral-800 pb-4">
        <div className="flex items-center gap-4">
          <BrainCircuit className="text-violet-500" size={28} />
          <div className="flex flex-col">
            <h2 className="text-2xl font-bold text-white leading-none">Pattern Discovery</h2>
            <p className="text-[10px] text-neutral-500 font-mono uppercase tracking-wider mt-1">AI Analysis Engine</p>
          </div>
        </div>
        <button onClick={performDiscovery} disabled={loading} className="w-full sm:w-auto px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-all font-bold flex items-center justify-center gap-2 disabled:opacity-50">
          {loading ? <Loader2 className="animate-spin" size={18} /> : <TrendingUp size={18} />} 
          <span>Initialize Analysis</span>
        </button>
      </div>

      <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6 items-stretch">
        <div className="lg:col-span-2 order-2 lg:order-1 flex flex-col h-full">
          <div className={`flex-1 bg-neutral-900 border border-neutral-800 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden flex flex-col transition-all duration-300 ${!analysis && !loading ? 'min-h-[160px] lg:h-full' : 'min-h-[400px] lg:h-full'}`}>
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-violet-500/20 rounded-full border-t-violet-500 animate-spin" />
                <div className="text-[10px] sm:text-sm font-mono text-neutral-500 animate-pulse">Scanning identity matrices...</div>
              </div>
            ) : analysis ? (
              <div className="prose prose-invert max-w-none">
                <div className="text-[10px] font-mono text-violet-400 uppercase tracking-widest mb-4">Discovery Results v1.1</div>
                <div className="whitespace-pre-wrap text-neutral-300 leading-relaxed text-sm md:text-base">{analysis}</div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-2 sm:space-y-4 opacity-50">
                <BarChart3 className="text-neutral-700 w-8 h-8 sm:w-12 sm:h-12" />
                <p className="text-neutral-400 text-[11px] sm:text-sm max-w-[180px] sm:max-w-none">System idle. Patterns require manual initialization.</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6 order-1 lg:order-2 flex flex-col h-full">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-xl">
            <h3 className="text-xs font-mono text-neutral-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <ShieldCheck size={14} className="text-emerald-500" /> Continuity Score
            </h3>
            <div className="text-4xl font-bold text-white mb-2">94%</div>
            <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
              <div className="w-[94%] h-full bg-emerald-500" />
            </div>
          </div>

          <div className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-xl space-y-5">
            <div className="flex justify-between items-start">
              <div className="flex flex-col">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  {accessToken ? <Cloud className="text-emerald-500" size={16} /> : <CloudOff className="text-neutral-600" size={16} />} System Sync
                </h3>
                {userInfo && <p className="text-[10px] text-neutral-300 font-mono mt-1 font-bold uppercase tracking-tight">{userInfo.name}</p>}
              </div>
              {accessToken ? (
                <button 
                  onClick={handleLogout} 
                  className="px-3 py-1 bg-rose-500/10 border border-rose-500/30 text-rose-500 text-[9px] font-bold rounded-lg hover:bg-rose-500/20 transition-all uppercase"
                >
                  Logout
                </button>
              ) : (
                <button 
                  onClick={loginWithGoogle} 
                  className="px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-[10px] font-bold rounded-lg hover:bg-emerald-500/20 transition-all uppercase flex items-center gap-2"
                >
                  <Link size={12} />
                  Link Account
                </button>
              )}
            </div>

            {authError && <div className="p-2 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[9px] rounded font-mono uppercase">{authError}</div>}

            <div className="space-y-2">
              <label className="text-[9px] font-mono text-neutral-600 uppercase tracking-widest block">Manifest Trace</label>
              <div className={`bg-black/40 border rounded-lg p-3 text-[10px] font-mono flex items-center gap-2 transition-colors ${externalSyncStatus === 'importing' || externalSyncStatus === 'syncing' ? 'border-emerald-500/50 text-emerald-400' : 'border-neutral-800 text-neutral-500'}`}>
                <RefreshCw size={12} className={externalSyncStatus !== 'idle' && externalSyncStatus !== 'success' && externalSyncStatus !== 'error' ? 'animate-spin text-emerald-500' : ''} />
                <span className="truncate font-bold tracking-tight">{getSyncDisplayText()}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button onClick={onManualSync} disabled={!accessToken} className="py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 text-white rounded-lg font-bold text-[10px] flex items-center justify-center gap-2 transition-all uppercase tracking-tight">
                <UploadCloud size={14} /> Sync
              </button>
              <button onClick={loadLatestSync} disabled={!accessToken} className="py-2.5 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 text-white rounded-lg font-bold text-[10px] flex items-center justify-center gap-2 transition-all uppercase tracking-tight">
                <DownloadCloud size={14} /> Import
              </button>
            </div>

            <div className="p-3 bg-neutral-950 rounded-lg border border-neutral-800">
               <div className="flex items-center gap-2 mb-1.5">
                 <Zap size={10} className="text-violet-400" />
                 <span className="text-[9px] font-mono font-bold text-violet-400 uppercase tracking-widest">Auto-Pulse Active</span>
               </div>
               <p className="text-[9px] text-neutral-500 leading-relaxed font-mono uppercase">
                 Sync status: <span className="text-emerald-500">NOMINAL</span>. Automatic parity active for all blueprints and identity logs.
               </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiscoveryPanel;
