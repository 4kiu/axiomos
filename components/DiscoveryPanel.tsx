
import React, { useState } from 'react';
import { WorkoutEntry, IdentityState } from '../types';
import { GoogleGenAI } from '@google/genai';
import { BrainCircuit, Loader2, BarChart3, TrendingUp, ShieldCheck } from 'lucide-react';

interface DiscoveryPanelProps {
  entries: WorkoutEntry[];
}

const DiscoveryPanel: React.FC<DiscoveryPanelProps> = ({ entries }) => {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const performDiscovery = async () => {
    if (entries.length < 3) {
      setAnalysis("Insufficient data for pattern discovery. Continue logging sessions.");
      return;
    }

    setLoading(true);
    try {
      // Use the Google GenAI SDK to analyze logs.
      // API key is obtained exclusively from the environment variable process.env.API_KEY.
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `
        Analyze these training logs from AxiomOS (a high-performance training operating system).
        The user uses identity states: 0 (Overdrive), 1 (Normal), 2 (Maintenance), 3 (Survival).
        
        Logs:
        ${JSON.stringify(entries.map(e => ({
          date: new Date(e.timestamp).toDateString(),
          id: IdentityState[e.identity],
          energy: e.energy,
          tags: e.tags,
          notes: e.notes
        })), null, 2)}

        Task: 
        1. Identify correlations between tags (like 'stress' or 'exams') and identity states.
        2. Look for "identity decay" or successful "survival mode" bridging.
        3. Provide 3 specific, non-motivational, technical insights based ONLY on the data.
        Keep it concise, professional, and clinical.
      `;

      // Complex reasoning task: using 'gemini-3-pro-preview' for advanced pattern analysis as per guidelines.
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt
      });

      // Extract generated text from the property directly.
      setAnalysis(response.text || "Discovery engine returned no insights.");
    } catch (error) {
      console.error(error);
      setAnalysis("Error initializing discovery engine. Check environment configuration.");
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
        <div className="md:col-span-2 bg-neutral-900 border border-neutral-800 rounded-2xl p-8 min-h-[400px]">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center space-y-4">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-violet-500/20 rounded-full border-t-violet-500 animate-spin" />
                <BrainCircuit className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-violet-500" size={24} />
              </div>
              <div className="text-sm font-mono text-neutral-500 animate-pulse">Scanning identity matrices...</div>
            </div>
          ) : analysis ? (
            <div className="prose prose-invert max-w-none">
              <div className="text-[10px] font-mono text-violet-400 uppercase tracking-widest mb-4">Discovery Results v1.0</div>
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

        <div className="space-y-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
            <h3 className="text-xs font-mono text-neutral-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <ShieldCheck size={14} className="text-emerald-500" />
              Continuity Score
            </h3>
            <div className="text-4xl font-bold text-white mb-2">94%</div>
            <div className="w-full h-1 bg-neutral-800 rounded-full overflow-hidden">
               <div className="w-[94%] h-full bg-emerald-500" />
            </div>
            <p className="text-[10px] text-neutral-500 mt-3 italic">Identity integrity remains high during stress periods.</p>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
            <h3 className="text-xs font-mono text-neutral-500 uppercase tracking-widest mb-3">Top Context Friction</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-mono text-neutral-300 uppercase">Stress</span>
                <span className="text-xs font-bold text-neutral-500">12 Instances</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-mono text-neutral-300 uppercase">Exams</span>
                <span className="text-xs font-bold text-neutral-500">4 Instances</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiscoveryPanel;
