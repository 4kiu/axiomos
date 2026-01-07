
import React, { useMemo } from 'react';
import { WorkoutEntry, IdentityState } from '../types';
import { differenceInDays, isSameDay } from 'date-fns';
import { AlertCircle, Flame, Target, Activity, Zap, ShieldCheck } from 'lucide-react';

// Local implementation of startOfDay
const startOfDay = (date: Date | number) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

// Fix: Local implementation of subDays as it was missing from date-fns export
const subDays = (date: Date | number, amount: number) => {
  const d = new Date(date);
  d.setDate(d.getDate() - amount);
  return d;
};

interface StatusPanelProps {
  entries: WorkoutEntry[];
  onAction: () => void;
}

const StatusPanel: React.FC<StatusPanelProps> = ({ entries, onAction }) => {
  const sortedEntries = useMemo(() => 
    [...entries].sort((a, b) => b.timestamp - a.timestamp)
  , [entries]);

  const latestEntry = sortedEntries[0];
  
  const daysSinceLastLog = useMemo(() => {
    if (!latestEntry) return Infinity;
    return differenceInDays(startOfDay(new Date()), startOfDay(new Date(latestEntry.timestamp)));
  }, [latestEntry]);

  // Persistent Cross-Week Streak Logic
  const currentStreak = useMemo(() => {
    if (entries.length === 0) return 0;
    
    let streak = 0;
    // We start checking from either today (if logged) or yesterday (if today not logged yet)
    const today = startOfDay(new Date());
    const todayEntry = entries.find(e => isSameDay(startOfDay(new Date(e.timestamp)), today));
    
    let checkDate = today;
    
    // If today hasn't been logged, we don't count it as a "skip" yet, so we start looking from yesterday
    if (!todayEntry) {
      checkDate = subDays(today, 1);
    }

    // Identitites that keep the streak alive
    const streakPreservingIdentities = [
      IdentityState.OVERDRIVE,
      IdentityState.NORMAL,
      IdentityState.MAINTENANCE,
      IdentityState.REST
    ];

    while (true) {
      const entryForDate = entries.find(e => isSameDay(startOfDay(new Date(e.timestamp)), checkDate));
      
      // If there is an entry and it's one of the valid identities
      if (entryForDate && streakPreservingIdentities.includes(entryForDate.identity)) {
        streak++;
        checkDate = subDays(checkDate, 1);
      } 
      // If there's no entry OR it was a Survival entry (which breaks streak per requirements)
      else {
        break;
      }
    }
    
    return streak;
  }, [entries]);

  // Dynamic Integrity Score (0-100)
  // Replaced with a more robust rolling consistency calculation to avoid "always 100%" bug
  const integrityScore = useMemo(() => {
    if (entries.length === 0) return 0;
    
    const today = startOfDay(new Date());
    let weightedIntegrity = 0;
    const windowDays = 7;
    
    for (let i = 0; i < windowDays; i++) {
      const dayToCheck = subDays(today, i);
      const entry = entries.find(e => isSameDay(startOfDay(new Date(e.timestamp)), dayToCheck));
      
      if (entry) {
        // High performance or strategic rest states contribute fully to integrity
        if ([IdentityState.OVERDRIVE, IdentityState.NORMAL, IdentityState.MAINTENANCE, IdentityState.REST].includes(entry.identity)) {
          weightedIntegrity += 100 / windowDays;
        } 
        // Survival is sub-baseline; it maintains identity but reduces peak integrity
        else if (entry.identity === IdentityState.SURVIVAL) {
          weightedIntegrity += 30 / windowDays; 
        }
      }
      // Gaps contribute 0 to the integrity score for that cycle
    }
    
    return Math.min(100, Math.round(weightedIntegrity));
  }, [entries]);

  const healthColor = integrityScore > 80 ? 'text-emerald-500' : integrityScore > 40 ? 'text-amber-500' : 'text-rose-500';
  const healthBg = integrityScore > 80 ? 'bg-emerald-500/10' : integrityScore > 40 ? 'bg-amber-500/10' : 'bg-rose-500/10';

  return (
    <div className={`relative rounded-xl border p-6 flex flex-col justify-between transition-all overflow-hidden group ${integrityScore < 50 ? 'bg-rose-950/20 border-rose-900/50' : 'bg-neutral-900 border-neutral-800'}`}>
      
      {/* Visual background scanning lines */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_0%,#fff_50%,transparent_100%)] h-[10%] w-full animate-[scan_4s_linear_infinite]" />
      </div>

      <style>{`
        @keyframes scan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(1000%); }
        }
        @keyframes heartbeat {
          0% { transform: scale(1); opacity: 0.3; }
          15% { transform: scale(1.2); opacity: 1; }
          30% { transform: scale(1); opacity: 0.3; }
          45% { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(1); opacity: 0.3; }
        }
      `}</style>

      <div className="space-y-6">
        {/* Header with Integrity Score */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-mono text-neutral-500 uppercase tracking-widest flex items-center gap-2">
              <Activity size={14} className={integrityScore > 40 ? 'text-emerald-500' : 'text-rose-500'} />
              System Integrity
            </h3>
            <div className="text-[9px] font-mono text-neutral-600 mt-1 uppercase">Diagnostics: Online</div>
          </div>
          <div className={`px-3 py-1 rounded-md border font-mono text-xs font-bold transition-colors ${healthBg} ${healthColor} border-current/20`}>
            {integrityScore}%
          </div>
        </div>

        {/* Diagnostic Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="text-[9px] font-mono text-neutral-600 uppercase flex items-center gap-1">
              <Target size={10} /> State
            </div>
            <div className="text-lg font-bold text-white tracking-tight truncate">
              {latestEntry ? IdentityState[latestEntry.identity] : 'INIT_REQUIRED'}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-[9px] font-mono text-neutral-600 uppercase flex items-center gap-1">
              <Flame size={10} className={currentStreak > 0 ? "text-orange-500" : "text-neutral-700"} /> Streak
            </div>
            <div className="text-lg font-bold text-white tracking-tight">
              {currentStreak} <span className="text-[10px] text-neutral-500 font-normal">DYS</span>
            </div>
          </div>
        </div>

        {/* Biometric Pulse (Energy) */}
        <div className="bg-black/40 border border-neutral-800/50 rounded-lg p-3 relative overflow-hidden">
          <div className="flex justify-between items-center mb-2">
             <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-wider">Biometric Sync</span>
             <span className="text-[9px] font-mono text-emerald-500 uppercase font-bold">Stable</span>
          </div>
          <div className="flex items-end gap-[2px] h-6">
            {[1, 2, 3, 4, 5, 4, 3, 2, 3, 4, 5, 4, 3, 2, 3, 4, 5, 4, 3, 2, 1].map((h, i) => (
              <div 
                key={i} 
                className="flex-1 bg-emerald-500/40 rounded-t-[1px]" 
                style={{ 
                  height: `${(h / 5) * 100}%`,
                  animation: `heartbeat 2s infinite ease-in-out`,
                  animationDelay: `${i * 0.1}s`
                }} 
              />
            ))}
          </div>
          <div className="absolute top-0 right-0 p-2">
             <Zap size={10} className="text-amber-500 opacity-50" />
          </div>
        </div>

        {/* Nudges/Warnings */}
        {integrityScore < 70 ? (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg flex gap-3 items-start animate-in fade-in zoom-in-95 duration-300">
            <AlertCircle className="text-rose-500 shrink-0 mt-0.5" size={16} />
            <div className="text-[10px] text-rose-200 leading-tight font-mono">
              <span className="block font-bold mb-1 uppercase tracking-tighter text-rose-400">Identity Decay Warning</span>
              Low consistency detected in rolling window. System integrity compromised. Initialize high-performance cycle to recover.
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-1">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest">Axiom Link Persistent</span>
          </div>
        )}
      </div>

      {!latestEntry && (
        <p className="text-[10px] font-mono text-neutral-600 mt-6 leading-relaxed italic border-t border-neutral-800 pt-4">
          SYSTEM_IDLE: No training data found. Connect biometric feed to begin mapping.
        </p>
      )}
    </div>
  );
};

export default StatusPanel;
