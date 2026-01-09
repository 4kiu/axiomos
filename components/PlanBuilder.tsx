
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { WorkoutPlan, Exercise } from '../types';
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
  GripVertical,
  ArrowUpDown,
  MoveUp,
  MoveDown,
  ChevronLeft,
  AlertCircle
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
  onDeletePlan?: (planId: string) => void;
  externalIsEditing?: boolean;
  externalEditingPlanId?: string | null;
  onOpenEditor?: (planId: string | null) => void;
  onCloseEditor?: (force?: boolean) => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

const PlanBuilder: React.FC<PlanBuilderProps> = ({ 
  plans, 
  onUpdatePlans, 
  onLogPlan,
  onDeletePlan,
  externalIsEditing,
  externalEditingPlanId,
  onOpenEditor,
  onCloseEditor,
  onDirtyChange
}) => {
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [activePicker, setActivePicker] = useState<string | null>(null);
  const [isReordering, setIsReordering] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  const [isExReordering, setIsExReordering] = useState(false);
  const [draggedExIdx, setDraggedExIdx] = useState<number | null>(null);
  const [hasExReordered, setHasExReordered] = useState(false);
  
  const [confirmExDeletion, setConfirmExDeletion] = useState<string | null>(null);
  
  const longPressTimer = useRef<number | null>(null);
  const blueprintLongPressTimer = useRef<number | null>(null);
  const scrollInterval = useRef<number | null>(null);

  const [tempPlan, setTempPlan] = useState<Partial<WorkoutPlan>>({
    name: '',
    description: '',
    exercises: []
  });

  const [initialPlanString, setInitialPlanString] = useState<string>('');
  const [inputStates, setInputStates] = useState<Record<string, string>>({});

  // Deep comparison to check for dirtiness
  useEffect(() => {
    if (editingPlanId || isCreating) {
      const currentString = JSON.stringify(tempPlan);
      const isDirty = currentString !== initialPlanString;
      onDirtyChange?.(isDirty);
    } else {
      onDirtyChange?.(false);
    }
  }, [tempPlan, initialPlanString, editingPlanId, isCreating]);

  useEffect(() => {
    if (externalIsEditing !== undefined) {
      if (!externalIsEditing) {
        setIsCreating(false);
        setEditingPlanId(null);
        setInputStates({});
        setIsReordering(false);
        setIsExReordering(false);
        setHasExReordered(false);
      } else {
        if (externalEditingPlanId && editingPlanId !== externalEditingPlanId) {
          const plan = plans.find(p => p.id === externalEditingPlanId);
          if (plan) {
            setTempPlan(plan);
            setInitialPlanString(JSON.stringify(plan));
            setEditingPlanId(externalEditingPlanId);
          }
        } else if (!externalEditingPlanId && !isCreating) {
           const newPlan = {
             id: crypto.randomUUID(),
             name: 'New Blueprint',
             description: '',
             exercises: [],
             createdAt: Date.now()
           };
           setTempPlan(newPlan);
           setInitialPlanString(JSON.stringify(newPlan));
           setIsCreating(true);
        }
      }
    }
  }, [externalIsEditing, externalEditingPlanId, plans]);

  useEffect(() => {
    return () => {
      if (scrollInterval.current) window.clearInterval(scrollInterval.current);
    };
  }, []);

  const startNewPlan = () => {
    if (onOpenEditor) onOpenEditor(null);
    else {
      const newPlan = {
        id: crypto.randomUUID(),
        name: 'New Blueprint',
        description: '',
        exercises: [],
        createdAt: Date.now()
      };
      setTempPlan(newPlan);
      setInitialPlanString(JSON.stringify(newPlan));
      setIsCreating(true);
    }
  };

  const savePlan = (stayInEditor: boolean = false) => {
    if (!tempPlan.name) return;
    const finalPlan = tempPlan as WorkoutPlan;
    const exists = plans.find(p => p.id === finalPlan.id);
    if (exists) onUpdatePlans(plans.map(p => p.id === finalPlan.id ? finalPlan : p));
    else onUpdatePlans([...plans, finalPlan]);
    
    setInitialPlanString(JSON.stringify(finalPlan));

    if (stayInEditor) {
      setIsExReordering(false);
      setHasExReordered(false);
      return;
    }

    if (onCloseEditor) onCloseEditor(true);
    else {
      setIsCreating(false);
      setEditingPlanId(null);
      setInputStates({});
      setIsExReordering(false);
      setHasExReordered(false);
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
    const filtered = val.replace(/[^0-9.]/g, '');
    const dotCount = (filtered.match(/\./g) || []).length;
    if (dotCount > 1) return;
    const stateKey = `${exerciseId}-${field}`;
    setInputStates(prev => ({ ...prev, [stateKey]: filtered }));
    if (field === 'reps') updateExercise(exerciseId, { reps: filtered });
    else {
      const parsed = parseFloat(filtered);
      if (!isNaN(parsed)) updateExercise(exerciseId, { [field]: parsed });
      else if (filtered === '') updateExercise(exerciseId, { [field]: 0 });
    }
  };

  const removeExercise = (exerciseId: string) => {
    setTempPlan(prev => ({
      ...prev,
      exercises: prev.exercises?.filter(ex => ex.id !== exerciseId)
    }));
    setConfirmExDeletion(null);
  };

  const handleImageUpload = (exerciseId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => updateExercise(exerciseId, { image: reader.result as string });
      reader.readAsDataURL(file);
    }
  };

  const startAutoScroll = (direction: 'up' | 'down') => {
    if (scrollInterval.current) return;
    scrollInterval.current = window.setInterval(() => {
      window.scrollBy(0, direction === 'up' ? -15 : 15);
    }, 20);
  };

  const stopAutoScroll = () => {
    if (scrollInterval.current) {
      window.clearInterval(scrollInterval.current);
      scrollInterval.current = null;
    }
  };

  const checkDragEdges = (e: React.DragEvent) => {
    const threshold = 100;
    const { clientY } = e;
    const { innerHeight } = window;
    if (clientY < threshold) startAutoScroll('up');
    else if (clientY > innerHeight - threshold) startAutoScroll('down');
    else stopAutoScroll();
  };

  const handleExDragStart = (idx: number) => {
    if (!isExReordering) return;
    setDraggedExIdx(idx);
  };

  const handleExDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    checkDragEdges(e);
    if (draggedExIdx === null || draggedExIdx === idx) return;
    const newExs = [...(tempPlan.exercises || [])];
    const item = newExs.splice(draggedExIdx, 1)[0];
    newExs.splice(idx, 0, item);
    setTempPlan(prev => ({ ...prev, exercises: newExs }));
    setDraggedExIdx(idx);
    setHasExReordered(true);
  };

  const handleExDragEnd = () => {
    setDraggedExIdx(null);
    stopAutoScroll();
  };

  const handleExPointerDown = (idx: number) => {
    if (isExReordering) return;
    longPressTimer.current = window.setTimeout(() => {
      setIsExReordering(true);
      setDraggedExIdx(idx);
    }, 600);
  };

  const handleExPointerUp = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const movePlan = (idx: number, direction: 'up' | 'down') => {
    const newPlans = [...plans];
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= plans.length) return;
    [newPlans[idx], newPlans[targetIdx]] = [newPlans[targetIdx], newPlans[idx]];
    onUpdatePlans(newPlans);
  };

  const handleDragStart = (idx: number) => {
    if (!isReordering) return;
    setDraggedIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    checkDragEdges(e);
    if (draggedIdx === null || draggedIdx === idx) return;
    const newPlans = [...plans];
    const item = newPlans.splice(draggedIdx, 1)[0];
    newPlans.splice(idx, 0, item);
    onUpdatePlans(newPlans);
    setDraggedIdx(idx);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
    stopAutoScroll();
  };

  const handleBlueprintPointerDown = (idx: number) => {
    if (isReordering) return;
    blueprintLongPressTimer.current = window.setTimeout(() => {
      setIsReordering(true);
      setDraggedIdx(idx);
    }, 600);
  };

  const handleBlueprintPointerUp = () => {
    if (blueprintLongPressTimer.current) {
      window.clearTimeout(blueprintLongPressTimer.current);
      blueprintLongPressTimer.current = null;
    }
  };

  if (isCreating || editingPlanId) {
    return (
      <div 
        className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300 relative min-h-screen pb-20"
        onClick={(e) => {
          if (isExReordering && e.target === e.currentTarget) {
            savePlan(true);
          }
        }}
      >
        {/* Exercise Deletion Confirmation Dialog */}
        {confirmExDeletion && (
           <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setConfirmExDeletion(null)} />
            <div className="relative bg-[#1a1a1a] border border-neutral-800 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="p-6 text-center space-y-4">
                <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-2 bg-rose-500/10 text-rose-500">
                  <Trash2 size={32} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">Delete Exercise?</h3>
                  <p className="text-sm text-neutral-400 leading-relaxed">This exercise module will be removed from the current training blueprint.</p>
                </div>
                <div className="flex flex-col gap-2 pt-2">
                  <button onClick={() => removeExercise(confirmExDeletion)} className="w-full py-3 rounded-xl font-bold bg-rose-600 hover:bg-rose-500 text-white transition-all">Remove Module</button>
                  <button onClick={() => setConfirmExDeletion(null)} className="w-full py-3 rounded-xl font-bold bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-all">Cancel</button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center border-b border-neutral-800 pb-4">
          <div className="flex-1 max-xl flex items-center gap-4">
            <button 
              onClick={() => onCloseEditor?.()} 
              className="p-2 -ml-2 text-neutral-400 hover:text-white transition-colors"
            >
              <ChevronLeft size={24} />
            </button>
            <div className="hidden sm:block shrink-0"><BookOpen className="text-neutral-500" size={28} /></div>
            <div className="flex flex-col flex-1">
              <input 
                type="text" 
                disabled={isExReordering}
                value={tempPlan.name} 
                onFocus={(e) => e.target.select()} 
                onChange={(e) => setTempPlan({ ...tempPlan, name: e.target.value })} 
                className={`bg-transparent border-none text-xl sm:text-2xl font-bold text-white focus:ring-0 w-full placeholder-neutral-700 p-0 leading-tight ${isExReordering ? 'opacity-50' : ''}`} 
                placeholder="Blueprint Name..." 
              />
              <input 
                type="text" 
                disabled={isExReordering}
                value={tempPlan.description} 
                onChange={(e) => setTempPlan({ ...tempPlan, description: e.target.value })} 
                className={`bg-transparent border-none text-[10px] sm:text-xs text-neutral-500 font-mono focus:ring-0 p-0 uppercase tracking-wider mt-1 ${isExReordering ? 'opacity-50' : ''}`} 
                placeholder="System objective" 
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setIsExReordering(!isExReordering)} 
              className={`p-2 rounded-lg border transition-all ${isExReordering ? 'bg-amber-500 border-amber-400 text-black shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:text-white'}`}
            >
              <ArrowUpDown size={20} />
            </button>
            <button 
              onClick={() => savePlan(isExReordering)} 
              className={`${isExReordering || hasExReordered ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-[0_0_15px_rgba(245,158,11,0.4)]' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/10'} px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all active:scale-95`}
            >
              <Check size={18} />
              Save
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tempPlan.exercises?.map((ex, index) => (
            <div 
              key={ex.id} 
              draggable={isExReordering} 
              onDragStart={() => handleExDragStart(index)} 
              onDragOver={(e) => handleExDragOver(e, index)} 
              onDragEnd={handleExDragEnd} 
              onPointerDown={() => handleExPointerDown(index)} 
              onPointerUp={handleExPointerUp} 
              onPointerLeave={handleExPointerUp} 
              className={`bg-neutral-900 border rounded-xl overflow-hidden flex flex-col group relative shadow-xl transition-all duration-200
                ${isExReordering ? 'ring-2 ring-amber-500 border-amber-500 scale-[0.98] cursor-grab active:cursor-grabbing shadow-[0_0_20px_rgba(245,158,11,0.2)]' : 'border-neutral-800'} 
                ${draggedExIdx === index ? 'opacity-50' : ''}`}
            >
              {activePicker === ex.id && !isExReordering && (
                <div className="absolute inset-0 z-50 bg-neutral-950/95 backdrop-blur-md p-4 flex flex-col animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex justify-between items-center mb-4"><span className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest">Select Target Muscle</span><button onClick={() => setActivePicker(null)} className="p-1 text-neutral-500 hover:text-white transition-colors"><X size={16} /></button></div>
                  <div className="grid grid-cols-3 gap-2 flex-1 overflow-y-auto">
                    {MUSCLE_GROUPS.map(group => (
                      <button key={group} onClick={() => { updateExercise(ex.id, { muscleType: group }); setActivePicker(null); }} className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all ${ex.muscleType === group ? 'bg-neutral-100 border-neutral-100 text-black' : 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:border-neutral-700'}`}>
                        <MuscleIcon type={group} className="w-6 h-6" /><span className="text-[9px] font-bold uppercase">{group}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="relative h-32 sm:h-40 bg-black/40 flex items-center justify-center overflow-hidden">
                {ex.image ? <img src={ex.image} alt={ex.name} className="w-full h-full object-cover opacity-60" /> : <div className="flex flex-col items-center gap-2 opacity-20"><MuscleIcon type={ex.muscleType} className="w-12 h-12" /></div>}
                <div className="absolute top-2 right-2 flex gap-1"><div className="bg-neutral-900/80 p-2 rounded-lg border border-neutral-800 text-white"><MuscleIcon type={ex.muscleType} className="w-4 h-4" /></div></div>
                {!isExReordering && <label className="absolute bottom-2 right-2 bg-black/60 p-2 rounded-full cursor-pointer hover:bg-black transition-colors border border-neutral-800"><Plus size={16} className="text-neutral-400" /><input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(ex.id, e)} /></label>}
                <div className="absolute top-2 left-2 bg-neutral-900/80 px-2 py-1 rounded text-[10px] font-mono text-neutral-500 border border-neutral-800">EX-{index + 1}</div>
              </div>
              <div className={`p-4 space-y-4 flex-1 ${isExReordering ? 'pointer-events-none' : ''}`}>
                <input 
                  type="text" 
                  disabled={isExReordering}
                  value={ex.name} 
                  onFocus={(e) => e.target.select()} 
                  onChange={(e) => updateExercise(ex.id, { name: e.target.value })} 
                  className="bg-transparent border-none p-0 text-base font-bold text-white w-full focus:ring-0 mb-1" 
                />
                <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr] md:grid-cols-2 gap-2">
                  <div className="space-y-1 relative">
                    <span className="text-[9px] font-mono text-neutral-600 uppercase tracking-tighter block truncate">Muscle</span>
                    <button 
                      disabled={isExReordering}
                      onClick={() => !isExReordering && setActivePicker(ex.id)} 
                      className="flex items-center justify-center bg-neutral-950 border border-neutral-800 rounded px-1 py-2 text-[10px] w-full text-center hover:border-neutral-600 transition-colors h-10 font-bold uppercase truncate"
                    >
                      {ex.muscleType}
                    </button>
                  </div>
                  <div className="space-y-1 relative">
                    <span className="text-[9px] font-mono text-neutral-600 uppercase tracking-tighter block truncate">Load</span>
                    <div className="relative group/load">
                      <input 
                        type="text" 
                        inputMode="decimal" 
                        disabled={isExReordering}
                        value={inputStates[`${ex.id}-weight`] ?? (ex.weight === 0 ? '' : ex.weight.toString())} 
                        onFocus={(e) => e.target.select()} 
                        onChange={(e) => updateNumericField(ex.id, 'weight', e.target.value)} 
                        className="bg-neutral-950 border border-neutral-800 rounded px-1 py-2 text-[11px] w-full focus:border-neutral-700 outline-none h-10 text-center font-bold" 
                        placeholder="0" 
                      />
                      {(inputStates[`${ex.id}-weight`] || (ex.weight > 0)) && <span className="absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 text-[8px] text-neutral-600 font-mono pointer-events-none">kg</span>}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] font-mono text-neutral-600 uppercase tracking-tighter block truncate">Sets</span>
                    <input 
                      type="text" 
                      inputMode="decimal" 
                      disabled={isExReordering}
                      value={inputStates[`${ex.id}-sets`] ?? (ex.sets === 0 ? '' : ex.sets.toString())} 
                      onFocus={(e) => e.target.select()} 
                      onChange={(e) => updateNumericField(ex.id, 'sets', e.target.value)} 
                      className="bg-neutral-950 border border-neutral-800 rounded px-1 py-2 text-[11px] w-full focus:border-neutral-700 outline-none h-10 text-center font-bold" 
                      placeholder="0" 
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] font-mono text-neutral-600 uppercase tracking-tighter block truncate">Reps</span>
                    <input 
                      type="text" 
                      inputMode="decimal" 
                      disabled={isExReordering}
                      value={inputStates[`${ex.id}-reps`] ?? ex.reps} 
                      onFocus={(e) => e.target.select()} 
                      onChange={(e) => updateNumericField(ex.id, 'reps', e.target.value)} 
                      className="bg-neutral-950 border border-neutral-800 rounded px-1 py-2 text-[11px] w-full focus:border-neutral-700 outline-none h-10 text-center font-bold" 
                      placeholder="0" 
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] font-mono text-neutral-600 uppercase tracking-widest block">Notes</span>
                  <textarea 
                    disabled={isExReordering}
                    value={ex.notes} 
                    onChange={(e) => updateExercise(ex.id, { notes: e.target.value })} 
                    className="bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-[11px] w-full focus:border-neutral-700 outline-none min-h-[60px] text-neutral-300" 
                    placeholder="Specific setup details..." 
                  />
                </div>
              </div>
              {!isExReordering && <div className="p-3 border-t border-neutral-800 flex justify-end"><button onClick={() => setConfirmExDeletion(ex.id)} className="text-neutral-600 hover:text-rose-500 transition-colors p-1"><Trash2 size={16} /></button></div>}
            </div>
          ))}
          {!isExReordering && <button onClick={addExercise} className="border-2 border-dashed border-neutral-800 rounded-xl flex flex-col items-center justify-center p-8 hover:bg-neutral-900/50 hover:border-neutral-700 transition-all group min-h-[300px]"><div className="w-12 h-12 rounded-full bg-neutral-900 flex items-center justify-center mb-4 border border-neutral-800 group-hover:scale-110 transition-transform"><Plus className="text-neutral-500" /></div><span className="text-sm font-mono text-neutral-600 uppercase">Append Module</span></button>}
        </div>
      </div>
    );
  }

  return (
    <div 
      className="space-y-8 pb-12 relative min-h-[60vh]" 
      onClick={(e) => {
       if (isReordering && e.target === e.currentTarget) {
         setIsReordering(false);
       }
    }}>
      <div className="flex justify-between items-center border-b border-neutral-800 pb-4">
        <div className="flex items-center gap-4"><div className="shrink-0"><BookOpen className="text-neutral-500" size={28} /></div><div className="flex flex-col"><h2 className="text-2xl font-bold text-white leading-none">Blueprints</h2><p className="text-[10px] sm:text-xs text-neutral-500 font-mono uppercase tracking-wider mt-1">Modular training profile creation</p></div></div>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsReordering(!isReordering)} 
            className={`px-3 sm:px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all border ${isReordering ? 'bg-amber-500 border-amber-400 text-black shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'}`}
          >
            <ArrowUpDown size={18} />
            <span className="hidden sm:inline">{isReordering ? 'Lock Order' : 'Reorder'}</span>
          </button>
          <button onClick={startNewPlan} className="bg-neutral-100 hover:bg-white text-black px-3 sm:px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all shadow-lg shadow-white/5"><Plus size={18} /><span className="hidden sm:inline">New Blueprint</span></button>
        </div>
      </div>
      {plans.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 opacity-40"><Dumbbell size={48} className="text-neutral-700" /><div className="max-w-xs"><p className="text-sm"> No training blueprints found in local storage.</p><p className="text-[10px] font-mono mt-2 uppercase">Create a profile to begin pattern mapping</p></div></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan, idx) => (
            <div 
              key={plan.id} 
              draggable={isReordering} 
              onDragStart={() => handleDragStart(idx)} 
              onDragOver={(e) => handleDragOver(e, idx)} 
              onDragEnd={handleDragEnd} 
              onPointerDown={() => handleBlueprintPointerDown(idx)}
              onPointerUp={handleBlueprintPointerUp}
              onPointerLeave={handleBlueprintPointerUp}
              onClick={() => { if (isReordering) return; if (onOpenEditor) onOpenEditor(plan.id); else { setEditingPlanId(plan.id); setTempPlan(plan); } }} 
              className={`bg-neutral-900 border rounded-xl overflow-hidden group transition-all duration-200 shadow-xl relative
                ${isReordering ? 'cursor-grab border-amber-500 ring-2 ring-amber-500 scale-[0.98] active:cursor-grabbing shadow-[0_0_20px_rgba(245,158,11,0.25)]' : 'cursor-pointer hover:border-neutral-700 border-neutral-800'} 
                ${draggedIdx === idx ? 'opacity-50' : ''}`}
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-start gap-3">{isReordering && <GripVertical className="text-amber-500 shrink-0 mt-1" size={20} />}<div><h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors">{plan.name}</h3><p className="text-xs text-neutral-500 font-mono mt-1">{plan.exercises.length} Active Modules</p></div></div>
                  
                  <div className="flex gap-2">
                    {isReordering ? (
                      <>
                        <button 
                          onClick={(e) => { e.stopPropagation(); movePlan(idx, 'up'); }} 
                          className="p-2 bg-neutral-800 hover:bg-amber-500/20 rounded-lg text-amber-500 transition-all border border-amber-500/20 w-9 h-9 flex items-center justify-center"
                        >
                          <MoveUp size={16} />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); movePlan(idx, 'down'); }} 
                          className="p-2 bg-neutral-800 hover:bg-amber-500/20 rounded-lg text-amber-500 transition-all border border-amber-500/20 w-9 h-9 flex items-center justify-center"
                        >
                          <MoveDown size={16} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button 
                          onClick={(e) => { e.stopPropagation(); onLogPlan?.(plan.id); }} 
                          className="p-2 bg-emerald-950/40 hover:bg-emerald-900/60 rounded-lg text-emerald-400 hover:text-emerald-300 border border-emerald-500/20 transition-all w-9 h-9 flex items-center justify-center"
                        >
                          <Activity size={16} />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); onDeletePlan?.(plan.id); }} 
                          className="p-2 bg-neutral-800 hover:bg-rose-900/30 rounded-lg text-neutral-400 hover:text-rose-500 transition-all w-9 h-9 flex items-center justify-center"
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="space-y-4">
                  {plan.description && <div className="flex gap-2 items-start opacity-70"><FileText size={14} className="text-neutral-500 shrink-0 mt-0.5" /><p className="text-xs text-neutral-400 line-clamp-2">{plan.description}</p></div>}
                  <div className="flex flex-wrap gap-2">
                    {Array.from(new Set(plan.exercises.map(ex => ex.muscleType))).map((muscle: string) => (
                      <span key={muscle} className="px-2 py-1 rounded bg-black/40 border border-neutral-800 text-[10px] font-mono text-neutral-400 uppercase flex items-center gap-2">
                        <span className="sm:hidden flex items-center gap-2">
                          <MuscleIcon type={muscle} className="w-3.5 h-3.5" />
                          {muscle}
                        </span>
                        <span className="hidden sm:inline">{muscle}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 bg-black/20 border-t border-neutral-800 flex justify-between items-center"><div className="flex -space-x-2">{plan.exercises.slice(0, 4).map((ex) => (<div key={ex.id} className="w-9 h-9 rounded-full bg-neutral-800 border-2 border-neutral-900 flex items-center justify-center text-neutral-300" title={ex.name}><MuscleIcon type={ex.muscleType} className="w-5 h-5" /></div>))}{plan.exercises.length > 4 && <div className="w-9 h-9 rounded-full bg-neutral-900 border-2 border-neutral-900 flex items-center justify-center text-[10px] font-bold text-neutral-500">+{plan.exercises.length - 4}</div>}</div><div className="text-[10px] font-mono text-emerald-500 hover:text-emerald-400 font-bold uppercase tracking-wider">{isReordering ? 'Position ' + (idx + 1) : 'Expand Blueprint →'}</div></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PlanBuilder;
