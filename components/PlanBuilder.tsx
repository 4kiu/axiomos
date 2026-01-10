

import React, { useState, useEffect, useRef } from 'react';
import { WorkoutPlan, Exercise } from '../types';
import ConfirmationModal from './ConfirmationModal.tsx';
import { 
  Plus, 
  Trash2, 
  ImageIcon,
  Dumbbell,
  Edit2,
  Check,
  X,
  FileText,
  BookOpen,
  ChevronDown,
  Activity,
  ArrowLeft
} from 'lucide-react';

// Custom SVG Icons for Muscle Groups
export const MuscleIcon: React.FC<{ type: string, className?: string }> = ({ type, className = "w-5 h-5" }) => {
  const icons: Record<string, React.ReactNode> = {
    'Chest': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
        <path d="M6 12C6 12 8 8 12 8C16 8 18 12 18 12" />
        <path d="M6 15C6 15 8 11 12 11C16 11 18 15 18 15" />
        <path d="M12 8V21" strokeOpacity="0.3" />
      </svg>
    ),
    'Back': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
        <path d="M12 4L4 8V16L12 20L20 16V8L12 4Z" />
        <path d="M12 4V20" strokeOpacity="0.3" />
        <path d="M4 8L20 16" strokeOpacity="0.3" />
        <path d="M20 8L4 16" strokeOpacity="0.3" />
      </svg>
    ),
    'Shoulders': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
        <circle cx="6" cy="10" r="3" />
        <circle cx="18" cy="10" r="3" />
        <path d="M9 10H15" strokeOpacity="0.3" />
      </svg>
    ),
    'Biceps': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
        <path d="M5 15C5 15 6 10 10 10C14 10 15 15 15 15" />
        <path d="M10 10V18" strokeOpacity="0.3" />
        <rect x="15" y="13" width="4" height="4" rx="1" />
      </svg>
    ),
    'Triceps': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
        <path d="M19 15C19 15 18 10 14 10C10 10 9 15 9 15" />
        <rect x="5" y="13" width="4" height="4" rx="1" />
      </svg>
    ),
    'Forearms': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
        <path d="M8 6V18M16 6V18" strokeOpacity="0.3" />
        <rect x="6" y="8" width="12" height="8" rx="2" />
        <path d="M10 12H14" />
      </svg>
    ),
    'Abs': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
        <rect x="7" y="5" width="4" height="4" rx="1" />
        <rect x="13" y="5" width="4" height="4" rx="1" />
        <rect x="7" y="10" width="4" height="4" rx="1" />
        <rect x="13" y="10" width="4" height="4" rx="1" />
        <rect x="7" y="15" width="4" height="4" rx="1" />
        <rect x="13" y="15" width="4" height="4" rx="1" />
      </svg>
    ),
    'Glutes': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
        <path d="M7 12C7 15.3137 9.68629 18 13 18C16.3137 18 19 15.3137 19 12" />
        <path d="M5 12C5 15.3137 7.68629 18 11 18C14.3137 18 17 15.3137 17 12" strokeOpacity="0.4" />
      </svg>
    ),
    'Quads': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
        <path d="M8 4L6 20M16 4L18 20" />
        <path d="M9 7H15M9 12H15M9 17H15" strokeOpacity="0.3" />
      </svg>
    ),
    'Hamstrings': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
        <path d="M8 4L10 20M16 4L14 20" />
        <path d="M10 8H14M10 13H14M10 18H14" strokeOpacity="0.3" />
      </svg>
    ),
    'Calves': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
        <path d="M9 4V20M15 4V20" strokeOpacity="0.2" />
        <path d="M7 10C7 10 8 16 12 16C16 16 17 10 17 10" />
      </svg>
    ),
    'Neck': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
        <path d="M8 8C8 8 9 14 12 14C15 14 16 8 16 8" />
        <path d="M12 4V14" strokeOpacity="0.3" />
      </svg>
    ),
  };

  return icons[type] || <Dumbbell className={className} />;
};

const MUSCLE_GROUPS = [
  'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 
  'Forearms', 'Abs', 'Glutes', 'Quads', 'Hamstrings', 
  'Calves', 'Neck'
];

interface PlanBuilderProps {
  plans: WorkoutPlan[];
  onUpdatePlans: (plans: WorkoutPlan[]) => void;
  onLogPlan?: (planId: string) => void;
  onBack?: () => void;
  // External navigation props from App.tsx
  externalIsEditing?: boolean;
  externalEditingPlanId?: string | null;
  onOpenEditor?: (planId: string | null) => void;
  onCloseEditor?: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

const PlanBuilder: React.FC<PlanBuilderProps> = ({ 
  plans, 
  onUpdatePlans, 
  onLogPlan,
  onBack,
  externalIsEditing,
  externalEditingPlanId,
  onOpenEditor,
  onCloseEditor,
  onDirtyChange
}) => {
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [activePicker, setActivePicker] = useState<string | null>(null); // Exercise ID
  const [planToDeleteId, setPlanToDeleteId] = useState<string | null>(null);
  const [exerciseToDeleteId, setExerciseToDeleteId] = useState<string | null>(null);

  const [tempPlan, setTempPlan] = useState<Partial<WorkoutPlan>>({
    name: '',
    description: '',
    exercises: []
  });

  const initialPlanRef = useRef<string | null>(null);

  // Intermediate input state to handle typing decimals naturally
  const [inputStates, setInputStates] = useState<Record<string, string>>({});

  // Synchronize internal state with external navigation state for back-gesture support
  useEffect(() => {
    if (externalIsEditing !== undefined) {
      if (!externalIsEditing) {
        setIsCreating(false);
        setEditingPlanId(null);
        setInputStates({});
        initialPlanRef.current = null;
      } else {
        // If external says editing but internal doesn't have plan yet, populate it
        if (externalEditingPlanId && editingPlanId !== externalEditingPlanId) {
          const plan = plans.find(p => p.id === externalEditingPlanId);
          if (plan) {
            setTempPlan(plan);
            setEditingPlanId(externalEditingPlanId);
            initialPlanRef.current = JSON.stringify(plan);
          }
        } else if (!externalEditingPlanId && !isCreating) {
           // External says creating
           const newPlan = {
             id: crypto.randomUUID(),
             name: 'New Blueprint',
             description: '',
             exercises: [],
             createdAt: Date.now()
           };
           setTempPlan(newPlan);
           setIsCreating(true);
           initialPlanRef.current = JSON.stringify(newPlan);
        }
      }
    }
  }, [externalIsEditing, externalEditingPlanId, plans]);

  // Derive local dirty state for UI feedback (Save vs Saved)
  // Ensured boolean type via explicit comparison to prevent TS mapping errors
  const isDirty = (isCreating || editingPlanId !== null) && 
                  initialPlanRef.current !== null && 
                  JSON.stringify(tempPlan) !== initialPlanRef.current;

  // Track dirty state for parent
  useEffect(() => {
    onDirtyChange?.(Boolean(isDirty));
  }, [isDirty, onDirtyChange]);

  const startNewPlan = () => {
    if (onOpenEditor) {
      onOpenEditor(null);
    } else {
      const newPlan = {
        id: crypto.randomUUID(),
        name: 'New Blueprint',
        description: '',
        exercises: [],
        createdAt: Date.now()
      };
      setTempPlan(newPlan);
      setIsCreating(true);
      initialPlanRef.current = JSON.stringify(newPlan);
    }
  };

  const savePlan = () => {
    if (!tempPlan.name) return;
    const finalPlan = tempPlan as WorkoutPlan;
    const exists = plans.find(p => p.id === finalPlan.id);
    
    if (exists) {
      onUpdatePlans(plans.map(p => p.id === finalPlan.id ? finalPlan : p));
    } else {
      onUpdatePlans([...plans, finalPlan]);
    }
    
    // Update the baseline reference so button shows "Saved" and editor stays open
    initialPlanRef.current = JSON.stringify(tempPlan);
    onDirtyChange?.(false);
    
    // Explicitly re-set local state to trigger render update for isDirty recalculation
    setTempPlan({ ...tempPlan });
  };

  const deletePlan = (id: string) => {
    setPlanToDeleteId(id);
  };

  const confirmDeletePlan = () => {
    if (planToDeleteId) {
      onUpdatePlans(plans.filter(p => p.id !== planToDeleteId));
      setPlanToDeleteId(null);
    }
  };

  const addExercise = () => {
    const newExercise: Exercise = {
      id: crypto.randomUUID(),
      name: 'New Exercise',
      muscleType: 'Chest',
      sets: 3,
      reps: '10',
      weight: 0,
      notes: ''
    };
    setTempPlan(prev => ({
      ...prev,
      exercises: [...(prev.exercises || []), newExercise]
    }));
  };

  const updateExercise = (exerciseId: string, updates: Partial<Exercise>) => {
    setTempPlan(prev => ({
      ...prev,
      exercises: prev.exercises?.map(ex => ex.id === exerciseId ? { ...ex, ...updates } : ex)
    }));
  };

  const updateNumericField = (exerciseId: string, field: keyof Exercise, val: string) => {
    // Only allow digits and a single dot
    const filtered = val.replace(/[^0-9.]/g, '');
    const dotCount = (filtered.match(/\./g) || []).length;
    if (dotCount > 1) return;

    // Track visual state locally so user can type "0." or "10."
    const stateKey = `${exerciseId}-${field}`;
    setInputStates(prev => ({ ...prev, [stateKey]: filtered }));

    if (field === 'reps') {
      updateExercise(exerciseId, { reps: filtered });
    } else {
      const parsed = parseFloat(filtered);
      if (!isNaN(parsed)) {
        updateExercise(exerciseId, { [field]: parsed });
      } else if (filtered === '') {
        updateExercise(exerciseId, { [field]: 0 });
      }
    }
  };

  const removeExercise = (exerciseId: string) => {
    setTempPlan(prev => ({
      ...prev,
      exercises: prev.exercises?.filter(ex => ex.id !== exerciseId)
    }));
  };

  const handleImageUpload = (exerciseId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateExercise(exerciseId, { image: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  if (isCreating || editingPlanId) {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="flex justify-between items-center border-b border-neutral-800 pb-4">
          <div className="flex-1 max-w-xl flex items-center gap-4">
            <button 
              onClick={() => { 
                if (onCloseEditor) onCloseEditor(); 
                else { setIsCreating(false); setEditingPlanId(null); setInputStates({}); initialPlanRef.current = null; } 
              }} 
              className="p-2 -ml-2 text-neutral-500 hover:text-white transition-colors"
            >
              <ArrowLeft size={24} />
            </button>
            <div className="shrink-0">
               <BookOpen className="text-neutral-500" size={28} />
            </div>
            <div className="flex flex-col flex-1">
              <input 
                type="text"
                value={tempPlan.name}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setTempPlan({ ...tempPlan, name: e.target.value })}
                className="bg-transparent border-none text-2xl font-bold text-white focus:ring-0 w-full placeholder-neutral-700 p-0 leading-tight"
                placeholder="Blueprint Name..."
              />
              <input 
                type="text"
                value={tempPlan.description}
                onChange={(e) => setTempPlan({ ...tempPlan, description: e.target.value })}
                className="bg-transparent border-none text-[10px] sm:text-xs text-neutral-500 font-mono focus:ring-0 p-0 uppercase tracking-wider mt-1"
                placeholder="System objective"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={savePlan} 
              disabled={!isDirty || !tempPlan.name}
              className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all active:scale-95 ${!isDirty ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
            >
              <Check size={18} />
              {isDirty ? 'Save' : 'Saved'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tempPlan.exercises?.map((ex, index) => (
            <div key={ex.id} className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden flex flex-col group relative">
              
              {activePicker === ex.id && (
                <div className="absolute inset-0 z-50 bg-neutral-950/95 backdrop-blur-md p-4 flex flex-col animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest">Select Target Muscle</span>
                    <button onClick={() => setActivePicker(null)} className="p-1 text-neutral-500 hover:text-white transition-colors">
                      <X size={16} />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 flex-1 overflow-y-auto">
                    {MUSCLE_GROUPS.map(group => (
                      <button
                        key={group}
                        onClick={() => {
                          updateExercise(ex.id, { muscleType: group });
                          setActivePicker(null);
                        }}
                        className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all
                          ${ex.muscleType === group ? 'bg-neutral-100 border-neutral-100 text-black' : 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:border-neutral-700'}
                        `}
                      >
                        <MuscleIcon type={group} className="w-6 h-6" />
                        <span className="text-[9px] font-bold uppercase">{group}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="relative h-40 bg-black/40 flex items-center justify-center overflow-hidden">
                {ex.image ? (
                  <img src={ex.image} alt={ex.name} className="w-full h-full object-cover opacity-60" />
                ) : (
                  <div className="flex flex-col items-center gap-2 opacity-20">
                    <MuscleIcon type={ex.muscleType} className="w-12 h-12" />
                  </div>
                )}
                
                <div className="absolute top-2 right-2 flex gap-1">
                  <div className="bg-neutral-900/80 p-2 rounded-lg border border-neutral-800 text-white">
                    <MuscleIcon type={ex.muscleType} className="w-4 h-4" />
                  </div>
                </div>

                <label className="absolute bottom-2 right-2 bg-black/60 p-2 rounded-full cursor-pointer hover:bg-black transition-colors border border-neutral-800">
                  <Plus size={16} className="text-neutral-400" />
                  <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(ex.id, e)} />
                </label>
                <div className="absolute top-2 left-2 bg-neutral-900/80 px-2 py-1 rounded text-[10px] font-mono text-neutral-500 border border-neutral-800">
                  EX-{index + 1}
                </div>
              </div>

              <div className="p-4 space-y-3 flex-1">
                <input 
                  type="text"
                  value={ex.name}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => updateExercise(ex.id, { name: e.target.value })}
                  className="bg-transparent border-none p-0 text-sm font-bold text-white w-full focus:ring-0"
                />
                
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1 relative">
                    <span className="text-[10px] font-mono text-neutral-600 uppercase">Target Muscle</span>
                    <button 
                      onClick={() => setActivePicker(ex.id)}
                      className="flex items-center justify-between bg-neutral-950 border border-neutral-800 rounded px-2 py-1.5 text-[11px] w-full text-left hover:border-neutral-600 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <MuscleIcon type={ex.muscleType} className="w-3 h-3 text-neutral-400" />
                        <span className="truncate">{ex.muscleType}</span>
                      </div>
                      <ChevronDown size={10} className="text-neutral-600" />
                    </button>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono text-neutral-600 uppercase">Load (kg)</span>
                    <input 
                      type="text"
                      inputMode="decimal"
                      value={inputStates[`${ex.id}-weight`] ?? (ex.weight === 0 ? '' : ex.weight.toString())}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => updateNumericField(ex.id, 'weight', e.target.value)}
                      className="bg-neutral-950 border border-neutral-800 rounded px-2 py-1.5 text-[11px] w-full focus:border-neutral-700 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono text-neutral-600 uppercase">Sets</span>
                    <input 
                      type="text"
                      inputMode="decimal"
                      value={inputStates[`${ex.id}-sets`] ?? (ex.sets === 0 ? '' : ex.sets.toString())}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => updateNumericField(ex.id, 'sets', e.target.value)}
                      className="bg-neutral-950 border border-neutral-800 rounded px-2 py-1.5 text-[11px] w-full focus:border-neutral-700 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono text-neutral-600 uppercase">Reps</span>
                    <input 
                      type="text"
                      inputMode="decimal"
                      value={inputStates[`${ex.id}-reps`] ?? ex.reps}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => updateNumericField(ex.id, 'reps', e.target.value)}
                      className="bg-neutral-950 border border-neutral-800 rounded px-2 py-1.5 text-[11px] w-full focus:border-neutral-700 outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-mono text-neutral-600 uppercase">Notes</span>
                  <textarea 
                    value={ex.notes}
                    onChange={(e) => updateExercise(ex.id, { notes: e.target.value })}
                    className="bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-[11px] w-full focus:border-neutral-700 outline-none min-h-[60px]"
                    placeholder="Tempo, cues, specific setup..."
                  />
                </div>
              </div>

              <div className="p-3 border-t border-neutral-800 flex justify-end">
                <button onClick={() => setExerciseToDeleteId(ex.id)} className="text-neutral-600 hover:text-rose-500 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}

          <button 
            onClick={addExercise}
            className="border-2 border-dashed border-neutral-800 rounded-xl flex flex-col items-center justify-center p-8 hover:bg-neutral-900/50 hover:border-neutral-700 transition-all group min-h-[300px]"
          >
            <div className="w-12 h-12 rounded-full bg-neutral-900 flex items-center justify-center mb-4 border border-neutral-800 group-hover:scale-110 transition-transform">
              <Plus className="text-neutral-500" />
            </div>
            <span className="text-sm font-mono text-neutral-600 uppercase">Append Module</span>
          </button>
        </div>

        <ConfirmationModal 
          isOpen={!!exerciseToDeleteId}
          title="Dismantle Module"
          message="Are you sure you want to purge this exercise module from the blueprint? The specific load, set, and rep patterns will be lost."
          confirmLabel="Purge Module"
          onConfirm={() => {
            if (exerciseToDeleteId) {
              removeExercise(exerciseToDeleteId);
              setExerciseToDeleteId(null);
            }
          }}
          onCancel={() => setExerciseToDeleteId(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center border-b border-neutral-800 pb-4">
        <div className="flex items-center gap-4">
          <div className="shrink-0">
             <BookOpen className="text-neutral-500" size={28} />
          </div>
          <div className="flex flex-col">
            <h2 className="text-2xl font-bold text-white leading-none">Blueprints</h2>
            <p className="text-[10px] sm:text-xs text-neutral-500 font-mono uppercase tracking-wider mt-1">Modular training profile creation</p>
          </div>
        </div>
        <button 
          onClick={startNewPlan}
          className="bg-neutral-100 hover:bg-white text-black px-2 sm:px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all"
        >
          <Plus size={18} />
          <span className="hidden sm:inline">New Blueprint</span>
        </button>
      </div>

      <ConfirmationModal 
        isOpen={!!planToDeleteId}
        title="Dismantle Blueprint"
        message="You are about to permanently delete this training blueprint and all its associated modular data. This action cannot be reversed."
        confirmLabel="Confirm Deletion"
        onConfirm={confirmDeletePlan}
        onCancel={() => setPlanToDeleteId(null)}
      />

      {plans.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 opacity-40">
          <Dumbbell size={48} className="text-neutral-700" />
          <div className="max-w-xs">
            <p className="text-sm">No training blueprints found in local storage.</p>
            <p className="text-[10px] font-mono mt-2 uppercase">Create a profile to begin pattern mapping</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan: WorkoutPlan) => (
            <div 
              key={plan.id} 
              onClick={() => { if (onOpenEditor) onOpenEditor(plan.id); else { setEditingPlanId(plan.id); setTempPlan(plan); } }}
              className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden group hover:border-neutral-700 transition-all shadow-xl cursor-pointer"
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors">{plan.name}</h3>
                    <p className="text-xs text-neutral-500 font-mono mt-1">{plan.exercises.length} Active Modules</p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={(e) => { e.stopPropagation(); onLogPlan?.(plan.id); }}
                      title="Log this blueprint today"
                      className="p-2 bg-emerald-950/40 hover:bg-emerald-900/60 rounded-lg text-emerald-400 hover:text-emerald-300 border border-emerald-500/20 transition-all"
                    >
                      <Activity size={16} />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); deletePlan(plan.id); }}
                      className="p-2 bg-neutral-800 hover:bg-rose-900/30 rounded-lg text-neutral-400 hover:text-rose-500 transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                   {plan.description && (
                     <div className="flex gap-2 items-start opacity-70">
                       <FileText size={14} className="text-neutral-500 shrink-0 mt-0.5" />
                       <p className="text-xs text-neutral-400 line-clamp-2">{plan.description}</p>
                     </div>
                   )}

                   <div className="flex flex-wrap gap-2">
                     {Array.from(new Set(plan.exercises.map(ex => ex.muscleType))).map((muscle: string) => (
                       <span key={muscle} className="px-2 py-1 rounded bg-black/40 border border-neutral-800 text-[10px] font-mono text-neutral-400 uppercase flex items-center gap-2">
                         <MuscleIcon type={muscle} className="w-3.5 h-3.5" />
                         {muscle}
                       </span>
                     ))}
                   </div>
                </div>
              </div>
              
              <div className="px-6 py-4 bg-black/20 border-t border-neutral-800 flex justify-between items-center">
                 <div className="flex -space-x-2">
                    {plan.exercises.slice(0, 4).map((ex, i) => (
                      <div key={ex.id} className="w-9 h-9 rounded-full bg-neutral-800 border-2 border-neutral-900 flex items-center justify-center text-neutral-300" title={ex.name}>
                        <MuscleIcon type={ex.muscleType} className="w-5 h-5" />
                      </div>
                    ))}
                    {plan.exercises.length > 4 && (
                      <div className="w-9 h-9 rounded-full bg-neutral-900 border-2 border-neutral-900 flex items-center justify-center text-[10px] font-bold text-neutral-500">
                        +{plan.exercises.length - 4}
                      </div>
                    )}
                 </div>
                 <div className="text-[10px] font-mono text-emerald-500 hover:text-emerald-400 font-bold uppercase tracking-wider">
                   Expand Blueprint &rarr;
                 </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PlanBuilder;
