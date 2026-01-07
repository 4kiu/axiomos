
export enum IdentityState {
  OVERDRIVE = 0,
  NORMAL = 1,
  MAINTENANCE = 2,
  SURVIVAL = 3,
  REST = 4
}

export type ContextTag = 'tired' | 'exams' | 'stress' | 'normal' | 'injured' | 'energized';

export interface Exercise {
  id: string;
  name: string;
  muscleType: string;
  sets: number;
  reps: string;
  weight: number;
  notes?: string;
  image?: string; // base64 or URL
}

export interface WorkoutPlan {
  id: string;
  name: string;
  description: string;
  exercises: Exercise[];
  createdAt: number;
}

export interface WorkoutEntry {
  id: string;
  timestamp: number;
  identity: IdentityState;
  energy: number; // 1-5
  notes?: string;
  tags: ContextTag[];
  planId?: string; // Reference to a WorkoutPlan
}

export interface AppState {
  entries: WorkoutEntry[];
  currentWeekOffset: number; // 0 for this week, -1 for last week, etc.
}

export const IDENTITY_METADATA = {
  [IdentityState.OVERDRIVE]: {
    label: 'Overdrive',
    color: 'bg-violet-600',
    borderColor: 'border-violet-500',
    textColor: 'text-violet-100',
    description: 'High performance peak state. Unlocked post-completion only.',
    duration: '60m+'
  },
  [IdentityState.NORMAL]: {
    label: 'Normal',
    color: 'bg-emerald-600',
    borderColor: 'border-emerald-500',
    textColor: 'text-emerald-100',
    description: 'Standard volume and intensity.',
    duration: '45-60m'
  },
  [IdentityState.MAINTENANCE]: {
    label: 'Maintenance',
    color: 'bg-amber-600',
    borderColor: 'border-amber-500',
    textColor: 'text-amber-100',
    description: 'Preserving baseline capacity.',
    duration: '30-45m'
  },
  [IdentityState.SURVIVAL]: {
    label: 'Survival',
    color: 'bg-rose-600',
    borderColor: 'border-rose-500',
    textColor: 'text-rose-100',
    description: 'Minimum dose. Does not sustain high-performance streaks.',
    duration: '10-20m'
  },
  [IdentityState.REST]: {
    label: 'Rest',
    color: 'bg-neutral-600',
    borderColor: 'border-neutral-500',
    textColor: 'text-neutral-100',
    description: 'Strategic recovery. Sustains continuity with 0 XP load.',
    duration: '0m'
  }
};
