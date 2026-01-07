
import React, { useState } from 'react';
import { 
  addDays, 
  format, 
  isSameDay, 
  isToday
} from 'date-fns';
import { IdentityState, WorkoutEntry, IDENTITY_METADATA, WorkoutPlan } from '../types';
import { Plus } from 'lucide-react';
import { MuscleIcon } from './PlanBuilder';

// Fix: Local implementation of startOfDay
const startOfDay = (date: Date | number) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

// Fix: Local implementation of startOfWeek
const startOfWeek = (date: Date | number, options?: { weekStartsOn?: number }) => {
  const d = new Date(date);
  const day = d.getDay(); // 0 is Sunday
  const weekStartsOn = options?.weekStartsOn ?? 0;
  const diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

interface WeeklyGridProps {
  entries: WorkoutEntry[];
  plans: WorkoutPlan[];
  onEntryClick?: (id: string) => void;
  onCellClick?: (date: Date, identity: IdentityState) => void;
  weekStart?: Date;
}

const WeeklyGrid: React.FC<WeeklyGridProps> = ({ 
  entries, 
  plans, 
  onEntryClick, 
  onCellClick, 
  weekStart = startOfWeek(new Date(), { weekStartsOn: 0 }) 
}) => {
  const [activePopup, setActivePopup] = useState<IdentityState | null>(null);
  
  // Explicitly type 'days' to avoid unknown inference in some TS environments
  const days: Date[] = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  
  // Identity order: Survival = 3rd row, Rest = last row
  const identities = [
    IdentityState.OVERDRIVE,
    IdentityState.NORMAL,
    IdentityState.SURVIVAL,
    IdentityState.MAINTENANCE,
    IdentityState.REST
  ];

  // Added explicit return type to prevent type inference issues downstream
  const getEntriesForCell = (day: Date, identity: IdentityState): WorkoutEntry[] => {
    return entries.filter(e => 
      isSameDay(startOfDay(new Date(e.timestamp)), startOfDay(day)) && 
      e.identity === identity
    );
  };

  const getDayHasEntry = (day: Date) => {
    return entries.some(e => isSameDay(startOfDay(new Date(e.timestamp)), startOfDay(day)));
  };

  // Added explicit return type and generic for Array.from to resolve 'unknown' type error
  const getPlanMuscleTypes = (planId?: string): string[] => {
    if (!planId) return [];
    const plan = plans.find(p => p.id === planId);
    if (!plan) return [];
    return Array.from<string>(new Set(plan.exercises.map(ex => ex.muscleType)));
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden relative h-full flex flex-col">
      <style>{`
        @keyframes overdrive-blink {
          0%, 100% { 
            opacity: 1; 
            filter: brightness(1.4); 
            box-shadow: 0 0 15px rgba(139, 92, 246, 0.7), inset 0 0 8px rgba(139, 92, 246, 0.4);
          }
          50% { 
            opacity: 0.7; 
            filter: brightness(1); 
            box-shadow: 0 0 4px rgba(139, 92, 246, 0.2), inset 0 0 2px rgba(139, 92, 246, 0.1);
          }
        }
        .animate-overdrive-blink {
          animation: overdrive-blink 2s infinite ease-in-out;
        }
      `}</style>

      {/* Mobile Identity Popup */}
      {activePopup !== null && (
        <div className="sm:hidden absolute inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setActivePopup(null)} />
          <div className={`relative p-6 rounded-2xl border ${IDENTITY_METADATA[activePopup].borderColor} ${IDENTITY_METADATA[activePopup].color} shadow-2xl max-w-xs w-full text-white`}>
            <div className="flex justify-between items-start mb-4">
              <span className="text-xs font-mono font-bold uppercase opacity-70">IDENTITY_STATE: 0{activePopup}</span>
              <button onClick={() => setActivePopup(null)} className="p-1 hover:bg-white/10 rounded">
                <Plus size={20} className="rotate-45" />
              </button>
            </div>
            <h4 className="text-2xl font-bold mb-2">{IDENTITY_METADATA[activePopup].label}</h4>
            <p className="text-sm opacity-90 leading-relaxed mb-4">{IDENTITY_METADATA[activePopup].description}</p>
          </div>
        </div>
      )}

      {/* Grid Headers */}
      <div className="grid grid-cols-7 border-b border-neutral-800 shrink-0">
        {days.map((day) => (
          <div 
            key={day.toISOString()} 
            className={`p-2 sm:p-3 text-center border-r border-neutral-800 last:border-r-0 ${isToday(day) ? 'bg-neutral-800/50' : ''}`}
          >
            <div className={`text-[8px] sm:text-[10px] font-mono uppercase ${isToday(day) ? 'text-emerald-400' : 'text-neutral-500'}`}>
              {format(day, 'eee')}
            </div>
            <div className={`text-xs sm:text-sm font-bold ${isToday(day) ? 'text-white' : 'text-neutral-300'}`}>
              {format(day, 'dd')}
            </div>
          </div>
        ))}
      </div>

      {/* Grid Rows */}
      <div className="divide-y divide-neutral-800 flex-1 flex flex-col">
        {identities.map((idType) => {
          const meta = IDENTITY_METADATA[idType];
          return (
            <div key={idType} className="grid grid-cols-7 group flex-1">
              {days.map((day) => {
                const cellEntries = getEntriesForCell(day, idType);
                const hasAnyEntryInCol = getDayHasEntry(day);
                const canLog = !hasAnyEntryInCol;

                return (
                  <div 
                    key={`${day.toISOString()}-${idType}`}
                    onClick={() => canLog ? onCellClick?.(day, idType) : cellEntries.length > 0 ? onEntryClick?.(cellEntries[0].id) : null}
                    className={`p-1 border-r border-neutral-800 last:border-r-0 flex flex-col gap-1 transition-colors relative group/cell cursor-pointer min-h-[72px] sm:min-h-[84px]
                      ${cellEntries.length > 0 ? 'bg-neutral-900' : 'bg-neutral-950'}
                      ${!canLog && cellEntries.length === 0 ? 'opacity-20 cursor-not-allowed bg-black/40' : 'hover:bg-neutral-900/50'}
                    `}
                  >
                    {cellEntries.length === 0 && canLog && (
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/cell:opacity-100 transition-opacity">
                        <Plus size={14} className="text-neutral-700" />
                      </div>
                    )}
                    
                    {cellEntries.map(entry => {
                      const isOverdrive = entry.identity === IdentityState.OVERDRIVE;
                      const animationClass = isOverdrive ? 'animate-overdrive-blink' : '';
                      const muscleTypes = getPlanMuscleTypes(entry.planId);
                      
                      return (
                        <div 
                          key={entry.id}
                          onClick={(e) => { e.stopPropagation(); onEntryClick?.(entry.id); }} 
                          className={`group/entry relative p-1.5 sm:p-2 rounded sm:rounded-md border text-left transition-all hover:scale-[1.01] h-full flex flex-col justify-between overflow-hidden
                            ${meta.color} ${meta.borderColor} ${meta.textColor}
                            ${animationClass}
                          `}
                        >
                          <div className="text-[7px] sm:text-[10px] font-bold flex justify-between items-center opacity-80 mb-0.5">
                            <span>{format(new Date(entry.timestamp), 'HH:mm')}</span>
                            {/* Hidden on mobile, flex on sm and up */}
                            <div className="hidden sm:flex gap-0.5">
                              {muscleTypes.slice(0, 3).map((m, i) => (
                                <MuscleIcon key={`${m}-${i}`} type={m} className="w-2.5 h-2.5 sm:w-3 sm:h-3 opacity-90" />
                              ))}
                            </div>
                          </div>
                          <div className="flex-1 flex flex-col justify-center">
                            <div className="text-[8px] sm:text-[11px] font-black uppercase leading-none tracking-tight truncate">
                              <span className="hidden sm:inline">{meta.label}</span>
                              <span className="sm:hidden font-mono text-[9px]">ID-0{entry.identity}</span>
                            </div>
                            {entry.notes && (
                              <div className="text-[7px] sm:text-[9px] line-clamp-1 mt-1 leading-tight opacity-90 font-medium italic">
                                {entry.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WeeklyGrid;
