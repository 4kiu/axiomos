
import React, { useState, useMemo } from 'react';
import { 
  IdentityState, 
  WorkoutEntry, 
  IDENTITY_METADATA, 
  ContextTag,
  WorkoutPlan
} from '../types.ts';
import { 
  X, 
  Activity, 
  Shield, 
  Calendar,
  ChevronRight,
  Trash2,
  AlertCircle,
  BookOpen,
  Check,
  Edit3,
  Cpu
} from 'lucide-react';
import { isSameDay, format } from 'date-fns';
import { MuscleIcon } from './PlanBuilder.tsx';

// Local implementation of subDays as it was missing from date-fns export
const subDays = (date: Date | number, amount: number) => {
  const d = new Date(date);
  d.setDate(d.getDate() - amount);
  return d;
};

interface LogActionProps {
  entries: WorkoutEntry[];
  plans: WorkoutPlan[];
  onSave: (entry: Omit<WorkoutEntry, 'id'>, id?: string) => void;
  onDelete?: (id: string) => void;
  onCancel: () => void;
  initialDate?: Date;
  initialIdentity?: IdentityState;
  editingEntry?: WorkoutEntry;
}

const LogAction: React.FC<LogActionProps> = ({ 
  entries, 
  plans,
  onSave, 
  onDelete,
  onCancel, 
  initialDate, 
  initialIdentity,
  editingEntry 
}) => {
  const [selectedIdentity, setSelectedIdentity] = useState<IdentityState | null>(
    editingEntry?.identity ?? initialIdentity ?? null
  );
  const [selectedPlanId, setSelectedPlanId] = useState<string | undefined>(editingEntry?.planId);
  const [energy, setEnergy] = useState<number>(editingEntry?.energy ?? 3);
  const [notes, setNotes] = useState(editingEntry?.notes ?? '');
  const [selectedTags, setSelectedTags] = useState<ContextTag[]>(editingEntry?.tags ?? []);
  
  const getInitialTime = () => {
    if (editingEntry) return format(new Date(editingEntry.timestamp), "yyyy-MM-dd'T'HH:mm");
    const base = initialDate ? new Date(initialDate) : new Date();
    if (!initialDate || isSameDay(initialDate, new Date())) {
      return format(new Date(), "yyyy-MM-dd'T'HH:mm");
    } else {
      const d = new Date(initialDate);
      d.setHours(new Date().getHours(), new Date().getMinutes());
      return format(d, "yyyy-MM-dd'T'HH:mm");
    }
  };

  const [sessionTime, setSessionTime] = useState(getInitialTime());
  const tags: ContextTag[] = ['energized', 'normal', 'tired', 'exams', 'stress', 'injured'];

  const isRestSelected = selectedIdentity === IdentityState.REST;

  const dateCollision = useMemo(() => {
    const selectedDate = new Date(sessionTime);
    return entries.some(e => 
      isSameDay(new Date(e.timestamp), selectedDate) && 
      e.id !== editingEntry?.id
    );
  }, [sessionTime, entries, editingEntry]);

  const handleToggleTag = (tag: ContextTag) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleSave = () => {
    if (selectedIdentity === null || dateCollision) return;
    onSave({
      timestamp: new Date(sessionTime).getTime(),
      identity: selectedIdentity,
      energy,
      notes,
      tags: selectedTags,
      planId: isRestSelected ? undefined : selectedPlanId
    }, editingEntry?.id);
  };

  const handleDelete = () => {
    if (editingEntry) {
      onDelete?.(editingEntry.id);
      onCancel();
    }
  };

  const renderIdentityButton = (id: IdentityState) => {
    const meta = IDENTITY_METADATA[id];
    const isSelected = selectedIdentity === id;

    return (
      <button
        key={id}
        onClick={() => {
          setSelectedIdentity(id);
          if (id === IdentityState.REST) {
            setSelectedPlanId(undefined);
          }
        }}
        className={`relative flex flex-col p-4 rounded-xl border text-left transition-all overflow-hidden
          ${isSelected ? `${meta.borderColor} ${meta.color} shadow-lg shadow-${meta.color.split('-')[1]}/20 scale-[1.02]` : 
            'bg-white/5 border-neutral-800 hover:border-neutral-700'
          }
        `}
      >
        <div className="flex justify-between items-start mb-2">
          <span className={`text-[10px] font-mono font-bold uppercase ${isSelected ? 'text-white' : 'text-neutral-500'}`}>
            ID-0{id}
          </span>
          {isSelected && <ChevronRight size={14} className="text-white" />}
        </div>
        <div className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-neutral-200'}`}>
          {meta.label}
        </div>
        <div className={`text-[10px] mt-1 ${isSelected ? 'text-white/80' : 'text-neutral-500'} font-mono`}>
          {meta.duration}
        </div>
      </button>
    );
  };

  return (
    <div className="flex flex-col h-full max-h-[90vh]">
      <div className={`flex justify-between items-center p-6 border-b border-neutral-800/50 transition-colors ${editingEntry ? 'bg-amber-500/5' : 'bg-transparent'}`}>
        <div className="flex items-center gap-4">
          <div className={`p-2 rounded-xl border ${editingEntry ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'}`}>
            {editingEntry ? <Edit3 size={20} /> : <Activity size={20} />}
          </div>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              {editingEntry ? 'Edit Identity Session' : 'Training Entry'}
            </h2>
            <div className="flex items-center gap-2 mt-1">
               <Cpu size={10} className="text-neutral-600" />
               <p className="text-[9px] text-neutral-500 font-mono uppercase tracking-widest">
                 {editingEntry ? `MODIFY_SEQ: ${editingEntry.id.substring(0,8)}` : 'AXIOM_LOG_SEQUENCE.001'}
               </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {editingEntry && (
             <button onClick={handleDelete} className="p-2 hover:bg-rose-950/40 rounded-full transition-colors group" title="Purge Record">
              <Trash2 size={18} className="text-neutral-600 group-hover:text-rose-500" />
            </button>
          )}
          <button onClick={onCancel} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X size={20} className="text-neutral-400" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {dateCollision && (
          <div className="bg-rose-500/10 border border-rose-500/30 p-4 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-1">
            <AlertCircle className="text-rose-500 shrink-0 mt-0.5" size={18} />
            <div className="text-xs text-rose-200">
              <span className="font-bold">Temporal Collision:</span> A training log already exists for {format(new Date(sessionTime), 'PPP')}. Axiom requires a single primary identity per day.
            </div>
          </div>
        )}

        <section>
          <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest block mb-3">Temporal Anchor</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Calendar size={14} className="text-neutral-500" />
            </div>
            <input 
              type="datetime-local" 
              value={sessionTime}
              onChange={(e) => setSessionTime(e.target.value)}
              className="w-full bg-white/5 border border-neutral-800 rounded-xl py-3 pl-10 pr-4 text-sm text-neutral-200 focus:outline-none focus:border-neutral-600 transition-colors font-mono"
            />
          </div>
        </section>

        <section className={isRestSelected ? "opacity-40 pointer-events-none select-none" : ""}>
          <div className="flex justify-between items-center mb-3">
            <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest block">System Blueprint</label>
            {isRestSelected && <span className="text-[8px] font-mono text-rose-500 uppercase font-bold">Locked: Rest State Active</span>}
          </div>
          {plans.length > 0 ? (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-1 gap-2">
                {plans.map(plan => {
                  const targetMuscles: string[] = Array.from(new Set(plan.exercises.map(ex => ex.muscleType)));
                  return (
                    <button
                      key={plan.id}
                      onClick={() => setSelectedPlanId(selectedPlanId === plan.id ? undefined : plan.id)}
                      className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all
                        ${selectedPlanId === plan.id 
                          ? 'bg-neutral-100 border-neutral-100 text-black' 
                          : 'bg-white/5 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                        }
                      `}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${selectedPlanId === plan.id ? 'bg-black/10' : 'bg-black/40'}`}>
                           <BookOpen size={18} className={selectedPlanId === plan.id ? 'text-black' : 'text-neutral-500'} />
                        </div>
                        <div>
                          <div className="text-sm font-bold">{plan.name}</div>
                          <div className="flex gap-2 mt-1">
                            {targetMuscles.slice(0, 3).map(m => (
                              <div key={m} className="flex items-center gap-1 opacity-60">
                                <MuscleIcon type={m} className="w-2.5 h-2.5" />
                                <span className="text-[8px] font-mono uppercase">{m}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      {selectedPlanId === plan.id && <Check size={16} />}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-4 border border-dashed border-neutral-800 rounded-xl text-center">
              <p className="text-[10px] font-mono text-neutral-600 uppercase">No active blueprints detected in system memory.</p>
            </div>
          )}
        </section>

        <section>
          <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest block mb-3">Identity Selection</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[IdentityState.OVERDRIVE, IdentityState.NORMAL, IdentityState.MAINTENANCE, IdentityState.SURVIVAL, IdentityState.REST].map(renderIdentityButton)}
          </div>
        </section>

        <section>
          <div className="flex justify-between items-center mb-3">
            <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Pre-Training Energy</label>
            <span className="text-lg font-bold text-emerald-500">{energy}/5</span>
          </div>
          <input 
            type="range" 
            min="1" 
            max="5" 
            value={energy} 
            onChange={(e) => setEnergy(parseInt(e.target.value))}
            className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
        </section>

        <section>
          <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest block mb-3">Context Tags</label>
          <div className="flex flex-wrap gap-2">
            {tags.map(tag => (
              <button
                key={tag}
                onClick={() => handleToggleTag(tag)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-mono border transition-all uppercase
                  ${selectedTags.includes(tag) 
                    ? 'bg-neutral-100 border-neutral-100 text-black' 
                    : 'bg-white/5 border-neutral-800 text-neutral-400 hover:border-neutral-600'
                  }
                `}
              >
                {tag}
              </button>
            ))}
          </div>
        </section>

        <section>
          <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest block mb-3">Notes / Logs</label>
          <textarea 
            className="w-full bg-white/5 border border-neutral-800 rounded-xl p-4 text-sm text-neutral-200 focus:outline-none focus:border-neutral-600 min-h-[100px] placeholder-neutral-700 font-sans"
            placeholder="Document technical patterns or fatigue specifics..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </section>
      </div>

      <div className="p-6 border-t border-neutral-800/50 bg-black/40">
        <button
          onClick={handleSave}
          disabled={selectedIdentity === null || dateCollision}
          className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all group/btn
            ${selectedIdentity !== null && !dateCollision
              ? editingEntry ? 'bg-amber-500 text-black hover:bg-amber-400' : 'bg-neutral-100 text-black hover:bg-white' 
              : 'bg-neutral-800 text-neutral-600 cursor-not-allowed'
            }
          `}
        >
          <Shield size={18} className="group-hover/btn:scale-110 transition-transform" />
          {editingEntry ? 'Synchronize Updates' : 'Commit to Identity'}
        </button>
      </div>
    </div>
  );
};

export default LogAction;
