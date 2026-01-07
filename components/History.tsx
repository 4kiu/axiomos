import React, { useState } from 'react';
import { WorkoutEntry, WorkoutPlan } from '../types.ts';
import { format, addDays } from 'date-fns';
import WeeklyGrid from './WeeklyGrid.tsx';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

// Fix: Local implementation of startOfWeek as it was missing from date-fns export
const startOfWeek = (date: Date | number, options?: { weekStartsOn?: number }) => {
  const d = new Date(date);
  const day = d.getDay();
  const weekStartsOn = options?.weekStartsOn ?? 0;
  const diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

// Fix: Local implementation of subWeeks as it was missing from date-fns export
const subWeeks = (date: Date | number, amount: number) => {
  const d = new Date(date);
  d.setDate(d.getDate() - amount * 7);
  return d;
};

interface HistoryProps {
  entries: WorkoutEntry[];
  plans: WorkoutPlan[];
  onEditEntry?: (id: string) => void;
}

const History: React.FC<HistoryProps> = ({ entries, plans, onEditEntry }) => {
  const [weekOffset, setWeekOffset] = useState(0);

  // Ensure Sunday start
  const selectedWeekStart = startOfWeek(subWeeks(new Date(), weekOffset), { weekStartsOn: 0 });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-neutral-800 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <Calendar className="text-neutral-500" />
            Archive Explorer
          </h2>
          <p className="text-sm text-neutral-500 font-mono">Temporal training pattern navigation</p>
        </div>

        <div className="flex items-center gap-4 bg-neutral-900 p-2 rounded-xl border border-neutral-800 self-stretch sm:self-auto justify-between">
          <button 
            onClick={() => setWeekOffset(prev => prev + 1)}
            className="p-2 hover:bg-neutral-800 rounded-lg transition-colors text-neutral-400 hover:text-white"
          >
            <ChevronLeft size={20} />
          </button>
          
          <div className="text-sm font-bold min-w-[200px] text-center font-mono">
            {format(selectedWeekStart, 'MMM dd')} — {format(addDays(selectedWeekStart, 7), 'MMM dd, yyyy')}
          </div>

          <button 
            onClick={() => setWeekOffset(prev => Math.max(0, prev - 1))}
            disabled={weekOffset === 0}
            className={`p-2 rounded-lg transition-colors ${weekOffset === 0 ? 'text-neutral-700 cursor-not-allowed' : 'hover:bg-neutral-800 text-neutral-400 hover:text-white'}`}
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <WeeklyGrid 
          entries={entries} 
          plans={plans}
          weekStart={selectedWeekStart} 
          onEntryClick={onEditEntry}
          isCompact={false} // Full table view for History
        />
      </div>

      <div className="bg-neutral-900/30 border border-neutral-800 rounded-xl p-8 text-center">
        <div className="max-w-md mx-auto space-y-3">
          <div className="text-neutral-500 font-mono text-[10px] uppercase tracking-widest">Archive Insight</div>
          <p className="text-sm text-neutral-400 italic">
            "We do not rise to the level of our goals, we fall to the level of our training identity." 
          </p>
        </div>
      </div>
    </div>
  );
};

export default History;