
import React, { useMemo } from 'react';
import { WorkoutEntry, IdentityState, IDENTITY_METADATA } from '../types';
import { Trophy, Star, TrendingUp, Zap } from 'lucide-react';
import { isSameDay, addDays } from 'date-fns';

interface PointsCardProps {
  entries: WorkoutEntry[];
  weekStart: Date;
}

const PointsCard: React.FC<PointsCardProps> = ({ entries, weekStart }) => {
  const weekEntries = useMemo(() => {
    const end = addDays(weekStart, 7);
    return entries.filter(e => {
      const d = new Date(e.timestamp);
      return d >= weekStart && d < end;
    }).sort((a, b) => a.timestamp - b.timestamp);
  }, [entries, weekStart]);

  const calculation = useMemo(() => {
    let basePoints = 0;
    let odCount = 0;
    let maxNormalStreak = 0;
    let currentStreak = 0;

    // First pass: Calculate Base & Count ODs
    weekEntries.forEach(e => {
      if (e.identity === IdentityState.OVERDRIVE) {
        odCount++;
      } else if (e.identity === IdentityState.NORMAL) {
        basePoints += 10;
      } else if (e.identity === IdentityState.MAINTENANCE) {
        basePoints += 6;
      } else if (e.identity === IdentityState.SURVIVAL) {
        basePoints += 3;
      } else if (e.identity === IdentityState.REST) {
        basePoints += 0; // Rest provides 0 XP but maintains streak
      }
    });

    // Handle Overdrive Tiers
    let odPoints = 0;
    if (odCount === 2) odPoints = odCount * 20;
    else if (odCount >= 3) odPoints = odCount * 25;
    else odPoints = odCount * 15;

    // Handle Normal Streaks for XP (Weekly specific)
    const dayMap = new Map();
    weekEntries.forEach(e => {
        const d = new Date(e.timestamp).toDateString();
        dayMap.set(d, e.identity);
    });

    for (let i = 0; i < 7; i++) {
        const d = addDays(weekStart, i).toDateString();
        const id = dayMap.get(d);
        // Note: For XP bonus, we only count 'Normal' days as streak-building.
        // Rest preserves the system integrity streak, but for XP bonus we keep it stricter.
        if (id === IdentityState.NORMAL) {
            currentStreak++;
            maxNormalStreak = Math.max(maxNormalStreak, currentStreak);
        } else {
            currentStreak = 0;
        }
    }

    let streakBonus = 0;
    if (maxNormalStreak === 3) streakBonus = 2;
    else if (maxNormalStreak === 4) streakBonus = 3;
    else if (maxNormalStreak === 5) streakBonus = 4;
    else if (maxNormalStreak >= 6) streakBonus = 5;

    return {
      total: basePoints + odPoints + streakBonus,
      odPoints,
      odCount,
      streakBonus,
      maxNormalStreak,
      basePoints
    };
  }, [weekEntries, weekStart]);

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 flex flex-col justify-between relative overflow-hidden group">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 -mr-4 -mt-4 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
        <Trophy size={120} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-mono text-neutral-500 uppercase tracking-widest flex items-center gap-2">
            <Star size={14} className="text-amber-500" />
            Axiom XP
          </h3>
          <div className="text-[10px] font-mono text-neutral-600">WEEKLY_REWARD_SEQ</div>
        </div>

        <div className="flex items-baseline gap-2">
          <div className="text-5xl font-black text-white tracking-tighter">
            {calculation.total}
          </div>
          <div className="text-xs font-mono text-emerald-500 font-bold">XP</div>
        </div>

        <div className="mt-6 space-y-2">
          <div className="flex justify-between items-center text-[10px] font-mono uppercase">
            <span className="text-neutral-500">Identity Base</span>
            <span className="text-neutral-300">+{calculation.basePoints}</span>
          </div>
          
          <div className="flex justify-between items-center text-[10px] font-mono uppercase">
            <span className="text-neutral-500">
                Overdrive {calculation.odCount >= 2 ? `Tier ${calculation.odCount >= 3 ? '3' : '2'}` : 'Base'}
            </span>
            <span className={calculation.odCount >= 2 ? "text-violet-400 font-bold" : "text-neutral-300"}>
                +{calculation.odPoints}
            </span>
          </div>

          {calculation.streakBonus > 0 && (
            <div className="flex justify-between items-center text-[10px] font-mono uppercase">
              <span className="text-neutral-500">Normal Streak ({calculation.maxNormalStreak})</span>
              <span className="text-emerald-400 font-bold">+{calculation.streakBonus}</span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-neutral-800 flex items-center gap-3">
        <div className="p-2 bg-neutral-950 rounded-lg border border-neutral-800">
           <Zap size={14} className={calculation.odCount >= 2 ? "text-violet-500" : "text-neutral-700"} />
        </div>
        <div className="text-[9px] font-mono text-neutral-500 leading-tight">
            {calculation.odCount >= 2 
                ? "MULTIPLIER_ACTIVE: OVERDRIVE_REWARDS_ENHANCED" 
                : "STABLE_GAIN: MAINTAIN_CONTINUITY_FOR_BONUS"}
        </div>
      </div>
    </div>
  );
};

export default PointsCard;
