
import React from 'react';
import { 
  addDays, 
  format, 
  isSameDay, 
  isToday
} from 'date-fns';
import { IdentityState, WorkoutEntry, IDENTITY_METADATA, WorkoutPlan } from '../types.ts';
import { Plus, Sparkles } from 'lucide-react';

const startOfDay = (date: Date | number) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

// Fix: Corrected invalid syntax where type annotation was placed in runtime code on line 20.
const startOfWeek = (date: Date | number, options?: { weekStartsOn?: number }) => {
  const d = new Date(date);
  const day = d.getDay();
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
  isCompact?: boolean; 
}

const WeeklyGrid: React.FC<WeeklyGridProps> = ({ 
  entries, 
  plans, 
  onEntryClick, 
  onCellClick, 
  weekStart = startOfWeek(new Date(), { weekStartsOn: 0 }),
  isCompact = false
}) => {
  const days: Date[] = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  
  const identities = [
    IdentityState.OVERDRIVE,
    IdentityState.NORMAL,
    IdentityState.MAINTENANCE,
    IdentityState.SURVIVAL,
    IdentityState.REST
  ];

  const getEntriesForCell = (day: Date, identity: IdentityState): WorkoutEntry[] => {
    return entries.filter(e => 
      isSameDay(startOfDay(new Date(e.timestamp)), startOfDay(day)) && 
      e.identity === identity
    );
  };

  const getDayEntries = (day: Date): WorkoutEntry[] => {
    return entries.filter(e => isSameDay(startOfDay(new Date(e.timestamp)), startOfDay(day)));
  };

  const getDayHasEntry = (day: Date) => {
    return entries.some(e => isSameDay(startOfDay(new Date(e.timestamp)), startOfDay(day)));
  };

  const EntryCard = ({ entry }: { entry: WorkoutEntry }) => {
    const meta = IDENTITY_METADATA[entry.identity];
    const isOverdrive = entry.identity === IdentityState.OVERDRIVE;
    const animationClass = isOverdrive ? 'animate-[pulse-overdrive_2s_infinite_ease-in-out]' : '';
    const plan = entry.planId ? plans.find(p => p.id === entry.planId) : null;
    
    return (
      <div 
        onClick={(e) => { e.stopPropagation(); onEntryClick?.(entry.id); }} 
        className={`group/entry relative p-2 rounded-lg border transition-all h-full flex flex-col items-center justify-center
          ${meta.color} ${meta.borderColor} ${meta.textColor}
          ${animationClass}
          hover:brightness-110 active:scale-[0.98] shadow-md min-h-[58px] sm:min-h-[85px]
        `}
      >
        <div className="relative z-10 flex flex-col items-center justify-center w-full text-center">
          {/* Time */}
          <div className="flex items-center justify-center gap-1 mb-1">
              <span className="text-[9px] sm:text-[11px] font-mono font-bold tracking-tight opacity-90">
                {format(new Date(entry.timestamp), 'HH:mm')}
              </span>
              {isOverdrive && <Sparkles size={11} className="text-white" />}
          </div>
          
          <div className="flex flex-col items-center w-full">
            {/* Identity Title */}
            <div className={`text-[10px] sm:text-[14px] font-black uppercase leading-none tracking-tight ${isCompact ? 'hidden sm:block' : 'block'}`}>
                {meta.label}
            </div>
            
            {/* Blueprint: Included in mobile view as requested */}
            {plan && (
              <div className={`text-[9px] sm:text-[11px] font-mono text-white/70 truncate w-[92%] mt-1 leading-tight border-t border-white/20 pt-1`}>
                  {plan.name}
              </div>
            )}
          </div>

          {/* Energy Dots: Made smaller for mobile */}
          <div className="flex gap-1 sm:gap-1.5 justify-center mt-1.5 sm:mt-2.5">
            {[...Array(5)].map((_, i) => (
              <div 
                key={i} 
                className={`w-1 h-1 sm:w-2 sm:h-2 rounded-full ${i < entry.energy ? 'bg-white' : 'bg-white/30'}`} 
              />
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-[#0d0d0d] border border-neutral-800 rounded-2xl overflow-hidden relative h-full flex flex-col shadow-2xl">
      <div className="absolute inset-0 pointer-events-none opacity-[0.12]" 
           style={{ backgroundImage: 'radial-gradient(#555 1px, transparent 1px)', backgroundSize: '24px 24px' }} 
      />

      <style>{`
        @keyframes pulse-overdrive {
          0%, 100% { 
            opacity: 1; 
            filter: brightness(1); 
            box-shadow: 0 0 15px rgba(124, 58, 237, 0.4); 
          }
          50% { 
            opacity: 0.9; 
            filter: brightness(1.2); 
            box-shadow: 0 0 25px rgba(124, 58, 237, 0.7); 
          }
        }
        .matrix-cell {
          transition: background-color 0.2s ease, border-color 0.2s ease;
        }
        .matrix-cell:hover {
          background-color: rgba(255, 255, 255, 0.03);
        }
        /* Mobile: show plus on active touch or hover if supported */
        .mobile-add-zone:active .add-icon,
        .mobile-add-zone:hover .add-icon {
          opacity: 1 !important;
          transform: scale(1.1);
          color: #10b981;
        }
      `}</style>

      {/* Row 1: Grid Headers */}
      <div className="grid grid-cols-7 border-b border-neutral-800 shrink-0 bg-neutral-900/40 relative z-10">
        {days.map((day, i) => (
          <div 
            key={day.toISOString()} 
            className={`p-2 sm:p-4 text-center border-r border-neutral-800 last:border-r-0 transition-colors ${isToday(day) ? 'bg-emerald-500/5' : ''}`}
          >
            <div className={`text-[7px] sm:text-[8px] font-mono uppercase mb-0.5 sm:mb-1 tracking-widest ${isToday(day) ? 'text-emerald-400 font-bold' : 'text-neutral-600'}`}>
              D{i+1}
            </div>
            <div className={`text-sm sm:text-xl font-bold tracking-tight ${isToday(day) ? 'text-white' : 'text-neutral-400'}`}>
              {format(day, 'dd')}
            </div>
            <div className={`text-[7px] sm:text-[9px] font-mono uppercase mt-0.5 ${isToday(day) ? 'text-emerald-500/80' : 'text-neutral-700'}`}>
              {format(day, 'eee')}
            </div>
          </div>
        ))}
      </div>

      {/* MOBILE DASHBOARD: Strict 2nd row for entries/logging */}
      <div className={`${isCompact ? 'grid' : 'hidden'} sm:hidden grid-cols-7 relative z-10 min-h-[160px]`}>
        {days.map((day) => {
          const dayEntries = getDayEntries(day);
          const hasEntry = dayEntries.length > 0;
          return (
            <div 
              key={`mobile-cell-${day.toISOString()}`}
              className={`p-1 border-r border-neutral-800 last:border-r-0 flex flex-col items-center justify-center transition-all mobile-add-zone
                ${!hasEntry ? 'bg-neutral-900/5 cursor-pointer' : ''}
              `}
              onClick={() => !hasEntry ? onCellClick?.(day, IdentityState.NORMAL) : null}
            >
              {hasEntry ? (
                <div className="w-full h-full flex flex-col gap-1">
                  {dayEntries.map(entry => (
                    <EntryCard key={entry.id} entry={entry} />
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center w-full h-full">
                  <Plus size={18} className="text-neutral-700 opacity-0 transition-all duration-100 add-icon" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* DESKTOP/HISTORY: Full 5-Identity Row Layout */}
      <div className={`${isCompact ? 'hidden sm:flex' : 'flex'} flex-col divide-y divide-neutral-800 flex-1 relative z-10`}>
        {identities.map((idType) => (
          <div key={idType} className="grid grid-cols-7 flex-1 min-h-[90px] sm:min-h-[120px] relative">
            {days.map((day) => {
              const cellEntries = getEntriesForCell(day, idType);
              const hasAnyEntryInCol = getDayHasEntry(day);
              const canLog = !hasAnyEntryInCol;

              return (
                <div 
                  key={`${day.toISOString()}-${idType}`}
                  onClick={() => canLog ? onCellClick?.(day, idType) : cellEntries.length > 0 ? onEntryClick?.(cellEntries[0].id) : null}
                  className={`p-1.5 sm:p-2 border-r border-neutral-800 last:border-r-0 flex flex-col transition-all relative group/cell cursor-pointer matrix-cell mobile-add-zone
                    ${!canLog && cellEntries.length === 0 ? 'opacity-[0.05] pointer-events-none' : ''}
                  `}
                >
                  {cellEntries.length === 0 && canLog && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/cell:opacity-100 transition-opacity">
                      <Plus size={16} className="text-neutral-600 add-icon" />
                    </div>
                  )}
                  {cellEntries.map(entry => (
                    <EntryCard key={entry.id} entry={entry} />
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default WeeklyGrid;
