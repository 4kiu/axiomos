
import React, { useState } from 'react';
import { WorkoutEntry, WorkoutPlan } from '../types.ts';
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

interface DiscoveryPanelProps {
  entries: WorkoutEntry[];
  plans: WorkoutPlan[];
  accessToken: string | null;
  userInfo: { name: string; email: string } | null;
  onLogin: () => void;
  onLogout: () => void;
  syncStatus: 'idle' | 'syncing' | 'loading' | 'success' | 'error';
  onManualSync: () => void;
  onManualImport: () => void;
}

const DiscoveryPanel: React.FC<DiscoveryPanelProps> = ({ 
  entries, 
  plans, 
  accessToken,
  userInfo,
  onLogin,
  onLogout,
  syncStatus,
  onManualSync,
  onManualImport
}) => {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [customSyncName] = useState(() => `sync.${format(new Date(), 'ss.mm.HH.dd.MM.yyyy')}`);

  const performDiscovery = async () => {
    if (entries.length < 3) {
      setAnalysis("Insufficient data for pattern discovery. Continue logging sessions.");
      return;
    }
    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Act as an elite sports scientist. Analyze these training logs for patterns, fatigue accumulation, and identity state transitions. Provide a concise executive summary. Data: ${JSON.stringify(entries.slice(-15))}`;
      const response = await ai.models.generateContent({ model: 'gemini-3-pro-preview', contents: prompt });
      setAnalysis(response.text || "No insights found.");
    } catch (error) {
      setAnalysis("Discovery engine failure.");
    } finally {
      setLoading(false);
    }
  };

  const isCloudBusy = syncStatus === 'syncing' || syncStatus === 'loading';

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
                <div className="text-[10px] font-mono text-violet-400 uppercase tracking-widest mb-4">Discovery Results v1.9</div>
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
                  onClick={onLogout} 
                  className="px-3 py-1 bg-rose-500/10 border border-rose-500/30 text-rose-500 text-[9px] font-bold rounded-lg hover:bg-rose-500/20 transition-all uppercase"
                >
                  Logout
                </button>
              ) : (
                <button 
                  onClick={onLogin} 
                  className="px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-[10px] font-bold rounded-lg hover:bg-emerald-500/20 transition-all uppercase flex items-center gap-2"
                >
                  <Link size={12} />
                  Link Account
                </button>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-[9px] font-mono text-neutral-600 uppercase tracking-widest block">Manifest Trace</label>
              <div className="bg-black/40 border border-neutral-800 rounded-lg p-3 text-[10px] font-mono text-neutral-500 flex items-center gap-2">
                <RefreshCw size={12} className={isCloudBusy ? 'animate-spin text-emerald-500' : ''} />
                <span className="truncate">{customSyncName}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={onManualSync} 
                disabled={!accessToken || isCloudBusy} 
                className="py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 text-white rounded-lg font-bold text-[10px] flex items-center justify-center gap-2 transition-all uppercase tracking-tight"
              >
                <UploadCloud size={14} /> Sync
              </button>
              <button 
                onClick={onManualImport} 
                disabled={!accessToken || isCloudBusy} 
                className="py-2.5 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 text-white rounded-lg font-bold text-[10px] flex items-center justify-center gap-2 transition-all uppercase tracking-tight"
              >
                <DownloadCloud size={14} /> Import
              </button>
            </div>

            <div className="p-3 bg-neutral-950 rounded-lg border border-neutral-800">
               <div className="flex items-center gap-2 mb-1.5">
                 <Zap size={10} className="text-violet-400" />
                 <span className="text-[9px] font-mono font-bold text-violet-400 uppercase tracking-widest">Auto-Pulse Active</span>
               </div>
               <p className="text-[9px] text-neutral-500 leading-relaxed font-mono uppercase">
                 Sync status: <span className={syncStatus === 'error' ? 'text-rose-500' : 'text-emerald-500'}>
                   {syncStatus === 'error' ? 'FRAGMENTED' : 'NOMINAL'}
                 </span>. Automatic parity active for all blueprints and identity logs.
               </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiscoveryPanel;
