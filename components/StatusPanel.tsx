
import React, { useMemo } from 'react';
import { WorkoutEntry, IdentityState } from '../types';
import { isSameDay } from 'date-fns';
import { AlertCircle, Flame, Target, Activity, Zap, CheckCircle2 } from 'lucide-react';

const startOfDay = (date: Date | number) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

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
  
  const currentStreak = useMemo(() => {
    if (entries.length === 0) return 0;
    
    let streakCount = 0;
    const today = startOfDay(new Date());
    const todayEntry = entries.find(e => isSameDay(startOfDay(new Date(e.timestamp)), today));
    
    // Streak logic v1.7.2: 
    // - Overdrive, Normal, Maintenance increment the count (+1).
    // - Rest bridges the streak (doesn't break, doesn't increment).
    // - Survival and empty logs break the streak (reset to 0).
    
    let checkDate = today;
    // Grace period: if no entry today, start checking from yesterday
    if (!todayEntry) {
      checkDate = subDays(today, 1);
    }

    while (true) {
      const entryForDate = entries.find(e => isSameDay(startOfDay(new Date(e.timestamp)), checkDate));
      
      if (entryForDate) {
        if (entryForDate.identity === IdentityState.SURVIVAL) {
          break; // Survival breaks continuity
        }
        
        // If not Rest, it's an active training day that increments streak
        if (entryForDate.identity !== IdentityState.REST) {
          streakCount++;
        }
        
        // Continue checking previous days
        checkDate = subDays(checkDate, 1);
      } else {
        // Empty log breaks continuity
        break;
      }
    }
    
    return streakCount;
  }, [entries]);

  const integrityScore = useMemo(() => {
    if (entries.length === 0) return 0;
    
    const today = startOfDay(new Date());
    let weightedIntegrity = 0;
    const windowDays = 7;
    
    for (let i = 0; i < windowDays; i++) {
      const dayToCheck = subDays(today, i);
      const entry = entries.find(e => isSameDay(startOfDay(new Date(e.timestamp)), dayToCheck));
      
      if (entry) {
        if (entry.identity === IdentityState.OVERDRIVE || entry.identity === IdentityState.NORMAL) {
          weightedIntegrity += 100 / windowDays;
        } else if (entry.identity === IdentityState.MAINTENANCE || entry.identity === IdentityState.REST) {
          weightedIntegrity += 40 / windowDays; 
        } else if (entry.identity === IdentityState.SURVIVAL) {
          weightedIntegrity += 20 / windowDays;
        }
      }
    }
    
    return Math.min(100, Math.round(weightedIntegrity));
  }, [entries]);

  const healthColor = integrityScore > 80 ? 'text-emerald-500' : integrityScore > 40 ? 'text-amber-500' : 'text-rose-500';
  const healthBg = integrityScore > 80 ? 'bg-emerald-500/10' : integrityScore > 40 ? 'bg-amber-500/10' : 'bg-rose-500/10';

  return (
    <div className={`relative rounded-xl border p-6 flex flex-col justify-between transition-all overflow-hidden group ${integrityScore < 50 ? 'bg-rose-950/20 border-rose-900/50' : 'bg-neutral-900 border-neutral-800'}`}>
      
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
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-mono text-neutral-500 uppercase tracking-widest flex items-center gap-2">
              <Activity size={14} className={integrityScore > 40 ? 'text-emerald-500' : 'text-rose-500'} />
              System Integrity
            </h3>
            <div className="text-[9px] font-mono text-neutral-600 mt-1 uppercase">Diagnostics: v1.7_STABLE</div>
          </div>
          <div className={`px-3 py-1 rounded-md border font-mono text-xs font-bold transition-colors ${healthBg} ${healthColor} border-current/20`}>
            {integrityScore}%
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="text-[9px] font-mono text-neutral-600 uppercase flex items-center gap-1">
              <Target size={10} /> Active State
            </div>
            <div className="text-lg font-bold text-white tracking-tight truncate">
              {latestEntry ? IdentityState[latestEntry.identity] : 'OFFLINE'}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-[9px] font-mono text-neutral-600 uppercase flex items-center gap-1">
              <Flame size={10} className={currentStreak > 0 ? "text-orange-500" : "text-neutral-700"} /> Constancy Streak
            </div>
            <div className="text-lg font-bold text-white tracking-tight">
              {currentStreak} <span className="text-[10px] text-neutral-500 font-normal">DYS</span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-wider">Continuity Goal</span>
            <span className={`text-[9px] font-mono uppercase font-bold ${currentStreak >= 6 ? 'text-emerald-400' : 'text-neutral-600'}`}>
              {currentStreak >= 6 ? 'Peak Bonus Active' : `${currentStreak}/6 Days to +5 XP`}
            </span>
          </div>
          <div className="grid grid-cols-6 gap-1.5 h-1.5">
            {[...Array(6)].map((_, i) => {
              const isActive = i < currentStreak;
              const isTarget = i === 5;
              return (
                <div 
                  key={i} 
                  className={`rounded-full transition-all duration-500 ${
                    isActive 
                      ? (isTarget ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'bg-neutral-200') 
                      : 'bg-neutral-800'
                  }`}
                />
              );
            })}
          </div>
        </div>

        <div className="bg-black/40 border border-neutral-800/50 rounded-lg p-3 relative overflow-hidden">
          <div className="flex justify-between items-center mb-2">
             <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-wider">Neural Resonance</span>
             <span className="text-[9px] font-mono text-emerald-500 uppercase font-bold">Resonant</span>
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
        </div>

        {integrityScore < 70 ? (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg flex gap-3 items-start animate-in fade-in zoom-in-95 duration-300">
            <AlertCircle className="text-rose-500 shrink-0 mt-0.5" size={16} />
            <div className="text-[10px] text-rose-200 leading-tight font-mono">
              <span className="block font-bold mb-1 uppercase tracking-tighter text-rose-400">Integrity Warning</span>
              Identity drift detected. Missing logs or Survival states break continuity.
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-1">
            <CheckCircle2 size={12} className="text-emerald-500" />
            <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest">Axiom Matrix Synchronized</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatusPanel;