
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { IdentityState, WorkoutEntry, IDENTITY_METADATA, WorkoutPlan } from './types.ts';
import WeeklyGrid from './components/WeeklyGrid.tsx';
import LogAction from './components/LogAction.tsx';
import StatusPanel from './components/StatusPanel.tsx';
import PointsCard from './components/PointsCard.tsx';
import History from './components/History.tsx';
import DiscoveryPanel from './components/DiscoveryPanel.tsx';
import PlanBuilder from './components/PlanBuilder.tsx';
import { 
  LayoutDashboard, 
  History as HistoryIcon, 
  BrainCircuit, 
  Plus, 
  ShieldAlert, 
  BookOpen, 
  ChevronLeft, 
  ChevronRight, 
  RotateCcw,
  Calendar,
  Edit3,
  Github,
  Zap,
  LogOut,
  Cloud,
  CloudOff,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ArrowUp,
  X,
  Trash2,
  AlertCircle
} from 'lucide-react';
import { format, addWeeks, addDays, isSameDay, formatDistanceToNow } from 'date-fns';

const STORAGE_KEY = 'axiom_os_data_v1';
const PLANS_STORAGE_KEY = 'axiom_os_plans_v1';
const VIEW_STORAGE_KEY = 'axiom_os_view_v1';
const LAST_SYNC_TS_KEY = 'axiom_last_sync_ts';
const SYNC_TOKEN_TS_KEY = 'axiom_sync_token_ts';
const SESSION_DURATION_DAYS = 30;

const AxiomLogo = ({ className = "w-8 h-8" }: { className?: string }) => (
  <svg 
    viewBox="0 0 100 100" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg" 
    className={className}
  >
    <path 
      d="M50 15L85 80H15L50 15Z" 
      stroke="white" 
      strokeWidth="8" 
      strokeLinejoin="round" 
    />
    <path 
      d="M35 55H65" 
      stroke="white" 
      strokeWidth="8" 
      strokeLinecap="round" 
    />
    <path 
      d="M50 15L50 40" 
      stroke="white" 
      strokeLinecap="round" 
    />
  </svg>
);

const startOfWeek = (date: Date | number, options?: { weekStartsOn?: number }) => {
  const d = new Date(date);
  const day = d.getDay();
  const weekStartsOn = options?.weekStartsOn ?? 0;
  const diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

type ViewType = 'current' | 'plans' | 'history' | 'discovery';

const App: React.FC = () => {
  const [view, setView] = useState<ViewType>(() => {
    const savedView = localStorage.getItem(VIEW_STORAGE_KEY);
    return (savedView as any) || 'current';
  });
  
  const [isPlanEditing, setIsPlanEditing] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  
  const [isPlanDirty, _setIsPlanDirty] = useState(false);
  const isPlanDirtyRef = useRef(false);
  const setIsPlanDirty = useCallback((val: boolean) => {
    _setIsPlanDirty(val);
    isPlanDirtyRef.current = val;
  }, []);

  const [entries, setEntries] = useState<WorkoutEntry[]>([]);
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [dashboardWeekOffset, setDashboardWeekOffset] = useState(0);
  const [preselectedLogData, setPreselectedLogData] = useState<{ date?: Date, identity?: IdentityState, editingEntry?: WorkoutEntry, initialPlanId?: string } | null>(null);
  const [exitWarning, setExitWarning] = useState(false);
  const [syncNotice, setSyncNotice] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    type?: 'danger' | 'warning';
  } | null>(null);
  
  const [isNavVisible, setIsNavVisible] = useState(true);
  const lastScrollY = useRef(0);
  const exitTimerRef = useRef<number | null>(null);
  
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const touchStartTarget = useRef<EventTarget | null>(null);

  const [hasImported, setHasImported] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(() => {
    const token = localStorage.getItem('axiom_sync_token');
    const ts = localStorage.getItem(SYNC_TOKEN_TS_KEY);
    if (token && ts) {
      const daysElapsed = (Date.now() - parseInt(ts)) / (1000 * 60 * 60 * 24);
      if (daysElapsed < SESSION_DURATION_DAYS) return token;
    }
    return null;
  });
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'loading' | 'success' | 'error'>('idle');
  
  const syncTimeoutRef = useRef<number | null>(null);
  const [lastSyncTs, setLastSyncTs] = useState<number>(Number(localStorage.getItem(LAST_SYNC_TS_KEY) || 0));
  const [now, setNow] = useState(Date.now());
  const lastKnownStateRef = useRef<string>('');

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  const performSync = useCallback(async (token: string, currentEntries: WorkoutEntry[], currentPlans: WorkoutPlan[]) => {
    if (!hasImported) return;

    setSyncStatus('syncing');
    try {
      const q_folder = encodeURIComponent("name = 'Axiom' and mimeType = 'application/vnd.google-apps.folder' and trashed = false");
      const listFolderResponse = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q_folder}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const folderData = await listFolderResponse.json();
      let folderId = folderData.files?.[0]?.id;

      if (!folderId) {
        const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Axiom', mimeType: 'application/vnd.google-apps.folder' }),
        });
        const createData = await createResponse.json();
        folderId = createData.id;
      }

      const ts = Date.now();
      const syncName = `sync.${format(new Date(ts), 'ss.mm.HH.dd.MM.yyyy')}.json`;
      const manifest = { version: '1.9', timestamp: ts, data: { entries: currentEntries, plans: currentPlans } };
      const metadata = { name: syncName, mimeType: 'application/json', parents: [folderId] };

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', new Blob([JSON.stringify(manifest)], { type: 'application/json' }));

      const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      if (response.ok) {
        lastKnownStateRef.current = JSON.stringify({ entries: currentEntries, plans: currentPlans });
        setSyncStatus('success');
        setLastSyncTs(ts);
        localStorage.setItem(LAST_SYNC_TS_KEY, ts.toString());
        localStorage.setItem(SYNC_TOKEN_TS_KEY, ts.toString());

        try {
          const q_cleanup = encodeURIComponent(`'${folderId}' in parents and name contains "sync." and trashed = false`);
          const listFilesResponse = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q_cleanup}&orderBy=createdTime desc&fields=files(id, name, createdTime)`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const cleanupData = await listFilesResponse.json();
          if (cleanupData.files && cleanupData.files.length > 20) {
            const filesToDelete = cleanupData.files.slice(20);
            for (const file of filesToDelete) {
              await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
              });
            }
          }
        } catch (cleanupErr) {
          console.warn("Axiom Sync: Cleanup failed", cleanupErr);
        }

        setTimeout(() => setSyncStatus('idle'), 2000);
      } else {
        if (response.status === 401) {
          setAccessToken(null);
          localStorage.removeItem('axiom_sync_token');
          localStorage.removeItem(SYNC_TOKEN_TS_KEY);
        }
        setSyncStatus('error');
      }
    } catch (e) {
      setSyncStatus('error');
    }
  }, [hasImported]);

  const loadLatestSync = useCallback(async (token: string) => {
    setSyncStatus('loading');
    try {
      const q_folder = encodeURIComponent("name = 'Axiom' and mimeType = 'application/vnd.google-apps.folder' and trashed = false");
      const listFolderResponse = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q_folder}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const folderData = await listFolderResponse.json();
      const folderId = folderData.files?.[0]?.id;
      if (!folderId) {
        setSyncStatus('idle');
        setHasImported(true);
        return;
      }

      const q_files = encodeURIComponent(`'${folderId}' in parents and name contains "sync." and trashed = false`);
      const listFilesResponse = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q_files}&orderBy=createdTime desc&pageSize=1&fields=files(id, name, createdTime)`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const filesData = await listFilesResponse.json();
      const latestFile = filesData.files?.[0];

      if (latestFile) {
        const driveTs = new Date(latestFile.createdTime).getTime();
        if (driveTs > lastSyncTs) {
          const fileResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${latestFile.id}?alt=media`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const manifest = await fileResponse.json();
          if (manifest.data) {
            const newEntries = manifest.data.entries || [];
            const newPlans = manifest.data.plans || [];
            setEntries(newEntries);
            setPlans(newPlans);
            lastKnownStateRef.current = JSON.stringify({ entries: newEntries, plans: newPlans });
            const ts = manifest.timestamp || driveTs;
            setLastSyncTs(ts);
            localStorage.setItem(LAST_SYNC_TS_KEY, ts.toString());
            setSyncStatus('success');
            setHasImported(true);
            setTimeout(() => setSyncStatus('idle'), 2000);
          }
        } else {
          setSyncStatus('idle');
          setHasImported(true);
        }
      } else {
        setSyncStatus('idle');
        setHasImported(true);
      }
    } catch (e) {
      setSyncStatus('error');
    }
  }, [lastSyncTs]);

  useEffect(() => {
    const savedEntriesStr = localStorage.getItem(STORAGE_KEY);
    const savedPlansStr = localStorage.getItem(PLANS_STORAGE_KEY);
    const initialEntries = savedEntriesStr ? JSON.parse(savedEntriesStr) : [];
    const initialPlans = savedPlansStr ? JSON.parse(savedPlansStr) : [];
    
    setEntries(initialEntries);
    setPlans(initialPlans);
    lastKnownStateRef.current = JSON.stringify({ entries: initialEntries, plans: initialPlans });

    if (accessToken) {
      loadLatestSync(accessToken);
    } else {
      setSyncNotice(true);
      setHasImported(true);
    }
  }, [accessToken, loadLatestSync]);

  useEffect(() => {
    let syncTimer: number | null = null;
    if (syncNotice && !accessToken) {
      syncTimer = window.setTimeout(() => setSyncNotice(false), 10000);
    }
    return () => {
      if (syncTimer) window.clearTimeout(syncTimer);
    };
  }, [syncNotice, accessToken]);

  useEffect(() => {
    if (!hasImported || !accessToken) return;

    const currentState = JSON.stringify({ entries, plans });
    if (currentState === lastKnownStateRef.current) return;

    if (syncTimeoutRef.current) window.clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = window.setTimeout(() => {
      performSync(accessToken, entries, plans);
    }, 3000) as unknown as number;

    return () => {
      if (syncTimeoutRef.current) window.clearTimeout(syncTimeoutRef.current);
    };
  }, [entries, plans, accessToken, performSync, hasImported]);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); }, [entries]);
  useEffect(() => { localStorage.setItem(PLANS_STORAGE_KEY, JSON.stringify(plans)); }, [plans]);

  const handleExitSequence = useCallback(() => {
    if (exitWarning) return;
    setExitWarning(true);
    if (exitTimerRef.current) window.clearTimeout(exitTimerRef.current);
    exitTimerRef.current = window.setTimeout(() => {
      setExitWarning(false);
    }, 2000);
    window.history.pushState({ view, isSubPage: isPlanEditing, isLogging: isLogModalOpen }, '');
  }, [exitWarning, view, isPlanEditing, isLogModalOpen]);

  useEffect(() => {
    if (!window.history.state) window.history.replaceState({ view, isSubPage: false, isLogging: false }, '');
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state;
      if (state) {
        setView(state.view);
        setIsPlanEditing(state.isSubPage || false);
        setIsLogModalOpen(state.isLogging || false);
        if (!state.isSubPage) {
          setEditingPlanId(null);
          setIsPlanDirty(false);
        }
        if (!state.isLogging) setPreselectedLogData(null);
        setExitWarning(false);
      } else {
        if (view === 'current' && !isPlanEditing && !isLogModalOpen) handleExitSequence();
        else if (isLogModalOpen) {
          setIsLogModalOpen(false);
          setPreselectedLogData(null);
          window.history.replaceState({ view, isSubPage: isPlanEditing, isLogging: false }, '');
        } else if (isPlanEditing) {
          if (isPlanDirtyRef.current) {
             window.history.pushState({ view, isSubPage: true, isLogging: false }, '');
             confirmDiscardChanges(() => {
               setIsPlanDirty(false);
               setIsPlanEditing(false);
               setEditingPlanId(null);
               window.history.back();
             });
          } else {
            setIsPlanEditing(false);
            setEditingPlanId(null);
            window.history.replaceState({ view, isSubPage: false, isLogging: false }, '');
          }
        } else changeView('current');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [view, isPlanEditing, isLogModalOpen, isPlanDirty, handleExitSequence]);

  const confirmDiscardChanges = (onConfirm: () => void) => {
    setConfirmModal({
      title: 'Discard Changes?',
      message: 'You have unsaved modifications to this training blueprint. Leaving will result in data loss.',
      confirmText: 'Discard & Leave',
      type: 'danger',
      onConfirm: () => {
        setIsPlanDirty(false);
        setConfirmModal(null);
        onConfirm();
      }
    });
  };

  const performViewChange = (newView: ViewType) => {
    if (newView === view && !isPlanEditing && !isLogModalOpen) return;
    
    if (newView === 'current') {
      setIsPlanEditing(false);
      setEditingPlanId(null);
      setIsPlanDirty(false);
      setIsLogModalOpen(false);
      setPreselectedLogData(null);
      
      window.history.pushState({ view: 'current', isSubPage: false, isLogging: false }, '');
      setView('current');
      localStorage.setItem(VIEW_STORAGE_KEY, 'current');
      return;
    }

    setIsPlanEditing(false);
    setEditingPlanId(null);
    setIsPlanDirty(false);
    setIsLogModalOpen(false);

    if (view === 'current') {
      window.history.pushState({ view: newView, isSubPage: false, isLogging: false }, '');
    } else {
      window.history.replaceState({ view: newView, isSubPage: false, isLogging: false }, '');
    }
    
    setView(newView);
    localStorage.setItem(VIEW_STORAGE_KEY, newView);
  };

  const changeView = (newView: ViewType) => {
    if (isPlanDirtyRef.current) {
      confirmDiscardChanges(() => performViewChange(newView));
      return;
    }
    performViewChange(newView);
  };

  const handlePlanEditorOpen = (planId: string | null) => {
    setIsPlanEditing(true);
    setEditingPlanId(planId);
    setIsPlanDirty(false);
    window.history.pushState({ view: 'plans', isSubPage: true, isLogging: false }, '');
  };

  const handlePlanEditorClose = () => { 
    if (isPlanDirtyRef.current) {
      confirmDiscardChanges(() => window.history.back());
    } else if (isPlanEditing) {
      window.history.back(); 
    }
  };

  const openLogModal = useCallback((data?: { date?: Date, identity?: IdentityState, editingEntry?: WorkoutEntry, initialPlanId?: string }) => {
    if (data) setPreselectedLogData(data);
    setIsLogModalOpen(true);
    window.history.pushState({ view, isSubPage: isPlanEditing, isLogging: true }, '');
  }, [view, isPlanEditing]);

  const closeLogModal = useCallback(() => {
    if (isLogModalOpen) window.history.back();
  }, [isLogModalOpen]);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY.current && currentScrollY > 50) setIsNavVisible(false);
      else setIsNavVisible(true);
      
      if (currentScrollY > 300) setShowScrollTop(true);
      else setShowScrollTop(false);
      
      lastScrollY.current = currentScrollY;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
    touchStartY.current = e.targetTouches[0].clientY;
    touchStartTarget.current = e.target;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartX.current || !touchEndX.current || !touchStartY.current) return;
    
    const distanceX = touchStartX.current - touchEndX.current;
    const distanceY = Math.abs(touchStartY.current - e.changedTouches[0].clientY);
    
    if (distanceY > 100) return;

    const target = touchStartTarget.current as HTMLElement;
    const isWeekGrid = target?.closest('.week-grid-container');

    if (isWeekGrid && view === 'current') {
      if (distanceX > 50) setDashboardWeekOffset(prev => prev + 1);
      else if (distanceX < -50) setDashboardWeekOffset(prev => prev - 1);
    } else if (Math.abs(distanceX) > 70) {
      if (isPlanDirtyRef.current) {
        confirmDiscardChanges(() => {
          const viewOrder: ViewType[] = ['current', 'plans', 'history', 'discovery'];
          const currentIndex = viewOrder.indexOf(view);
          if (distanceX > 70 && currentIndex < viewOrder.length - 1) changeView(viewOrder[currentIndex + 1]);
          else if (distanceX < -70 && currentIndex > 0) changeView(viewOrder[currentIndex - 1]);
        });
      } else {
        const viewOrder: ViewType[] = ['current', 'plans', 'history', 'discovery'];
        const currentIndex = viewOrder.indexOf(view);
        if (distanceX > 70 && currentIndex < viewOrder.length - 1) changeView(viewOrder[currentIndex + 1]);
        else if (distanceX < -70 && currentIndex > 0) changeView(viewOrder[currentIndex - 1]);
      }
    }
    
    touchStartX.current = null;
    touchStartY.current = null;
    touchEndX.current = null;
    touchStartTarget.current = null;
  };

  const addOrUpdateEntry = (entryData: Omit<WorkoutEntry, 'id'>, id?: string) => {
    if (id) setEntries(prev => prev.map(e => e.id === id ? { ...entryData, id } : e));
    else setEntries(prev => [...prev, { ...entryData, id: crypto.randomUUID() }]);
    closeLogModal();
  };

  const handleDeleteEntry = (id: string) => {
    setConfirmModal({
      title: 'Purge Record?',
      message: 'This identity sequence will be permanently erased from system memory. This action is irreversible.',
      confirmText: 'Execute Purge',
      type: 'danger',
      onConfirm: () => {
        setEntries(prev => prev.filter(e => e.id !== id));
        closeLogModal();
        setConfirmModal(null);
      }
    });
  };

  const handleDeletePlan = (id: string) => {
    setConfirmModal({
      title: 'Decommission Blueprint?',
      message: 'Removing this blueprint will delete all modular exercise configurations. Existing training logs will persist but without blueprint reference.',
      confirmText: 'Decommission',
      type: 'danger',
      onConfirm: () => {
        onUpdatePlans(plans.filter(p => p.id !== id));
        setConfirmModal(null);
      }
    });
  };

  const onUpdatePlans = useCallback((newPlans: WorkoutPlan[]) => {
    setPlans(newPlans);
    setIsPlanDirty(false);
  }, [setIsPlanDirty]);

  const handleLogPlan = (planId: string) => {
    const today = new Date();
    const existingToday = entries.find(e => isSameDay(new Date(e.timestamp), today));
    if (existingToday) setEntries(prev => prev.map(e => e.id === existingToday.id ? { ...e, planId } : e));
    else {
      openLogModal({ date: today, identity: IdentityState.NORMAL, initialPlanId: planId });
    }
  };

  const handleCellClick = (date: Date, identity: IdentityState) => {
    openLogModal({ date, identity });
  };

  const handleEditEntry = (id: string) => {
    const entry = entries.find(e => e.id === id);
    if (entry) {
      openLogModal({ editingEntry: entry });
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const dashboardWeekStart = startOfWeek(addWeeks(new Date(), dashboardWeekOffset), { weekStartsOn: 0 });
  const todayEntry = entries.find(e => isSameDay(new Date(e.timestamp), new Date()));
  const todayHasEntry = !!todayEntry;

  const NavItems = () => (
    <>
      <button onClick={() => changeView('current')} className={`px-4 sm:px-6 py-2 rounded-lg flex items-center justify-center transition-all ${view === 'current' ? 'bg-neutral-100 text-black' : 'hover:bg-neutral-800 text-neutral-400'}`} title="Dashboard"><LayoutDashboard size={22} /></button>
      <button onClick={() => changeView('plans')} className={`px-4 sm:px-6 py-2 rounded-lg flex items-center justify-center transition-all ${view === 'plans' ? 'bg-neutral-100 text-black' : 'hover:bg-neutral-800 text-neutral-400'}`} title="Blueprints"><BookOpen size={22} /></button>
      <button onClick={() => changeView('history')} className={`px-4 sm:px-6 py-2 rounded-lg flex items-center justify-center transition-all ${view === 'history' ? 'bg-neutral-100 text-black' : 'hover:bg-neutral-800 text-neutral-400'}`} title="History"><HistoryIcon size={22} /></button>
      <button onClick={() => changeView('discovery')} className={`px-4 sm:px-6 py-2 rounded-lg flex items-center justify-center transition-all ${view === 'discovery' ? 'bg-neutral-100 text-black' : 'hover:bg-neutral-800 text-neutral-400'}`} title="Intelligence"><BrainCircuit size={22} /></button>
    </>
  );

  const StatusIndicator = () => {
    const lastSyncStr = useMemo(() => {
      if (!lastSyncTs) return 'Never';
      try {
        return formatDistanceToNow(lastSyncTs, { addSuffix: true });
      } catch (e) {
        return 'Recently';
      }
    }, [lastSyncTs, now]);

    let label = 'Offline';
    let dotColor = 'bg-neutral-600';
    let Icon = CloudOff;
    let bgColor = 'bg-neutral-900/40';
    let textColor = 'text-neutral-500';

    if (accessToken) {
      label = 'Linked';
      dotColor = 'bg-emerald-500';
      Icon = Cloud;
      textColor = 'text-neutral-400';

      if (syncStatus === 'syncing') {
        label = 'Syncing';
        dotColor = 'bg-blue-500';
        Icon = RefreshCw;
      } else if (syncStatus === 'loading') {
        label = 'Importing';
        dotColor = 'bg-amber-500';
        Icon = RefreshCw;
      } else if (syncStatus === 'success') {
        label = 'Success';
        dotColor = 'bg-emerald-400';
        Icon = CheckCircle2;
        bgColor = 'bg-emerald-500/5';
        textColor = 'text-emerald-400/80';
      }
    }

    const handleStatusClick = () => {
      if (accessToken) {
        performSync(accessToken, entries, plans);
      } else {
        changeView('discovery');
      }
    };

    const isSpinning = syncStatus === 'syncing' || syncStatus === 'loading';

    return (
      <button 
        onClick={handleStatusClick}
        className={`flex items-center gap-3 px-3 py-1.5 ${bgColor} border border-neutral-800 rounded-lg hover:border-neutral-600 transition-all group overflow-hidden relative max-w-[140px] sm:max-w-none`}
      >
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor} ${isSpinning ? 'animate-pulse' : ''}`} />
          <div className="flex flex-col items-start leading-none text-left">
            <span className={`text-[10px] font-mono font-bold uppercase tracking-tighter whitespace-nowrap ${textColor}`}>{label}</span>
            {accessToken && (
              <span className="text-[7px] font-mono text-neutral-600 uppercase tracking-tighter mt-0.5 group-hover:text-neutral-400 transition-colors">
                Last: {lastSyncStr}
              </span>
            )}
          </div>
        </div>
        <Icon size={12} className={`text-neutral-500 shrink-0 ${isSpinning ? 'animate-spin' : 'group-hover:scale-110 transition-transform'}`} />
      </button>
    );
  };

  return (
    <div 
      className="min-h-screen bg-[#121212] text-neutral-200 flex flex-col font-sans pb-20 sm:pb-0 select-none overflow-x-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#121212]/90 backdrop-blur-md border-b border-neutral-800 p-4">
        <div className="max-w-7xl mx-auto flex flex-row justify-between items-center">
          <div className="flex items-center gap-3">
            <AxiomLogo className="w-8 h-8 shrink-0" />
            <div className="flex flex-col">
              <h1 className="text-lg font-mono font-bold tracking-tight uppercase leading-none text-white whitespace-nowrap">Axiom v1.9</h1>
              <span className="text-[9px] text-neutral-500 font-mono uppercase tracking-tighter whitespace-nowrap">Personal Intelligence OS</span>
            </div>
          </div>
          <nav className="hidden sm:flex items-center gap-2 bg-neutral-900/50 p-1.5 rounded-xl border border-neutral-800"><NavItems /></nav>
          <div className="flex items-center gap-2">
            {dashboardWeekOffset !== 0 ? (
              <button onClick={() => setDashboardWeekOffset(0)} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500 text-black rounded-lg font-mono text-[9px] font-bold uppercase tracking-tight shadow-lg animate-in fade-in zoom-in-95">
                <RotateCcw size={12} /><span>Return to Current</span>
              </button>
            ) : <StatusIndicator />}
          </div>
        </div>
      </header>
      
      <main className="flex-1 max-w-7xl mx-auto w-full pt-24 pb-12 px-4 md:px-6 space-y-8 bg-[#121212] relative transition-all duration-300">
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          {view === 'current' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-stretch">
                <div className="lg:col-span-3 h-full relative week-grid-container">
                  <WeeklyGrid isCompact={true} entries={entries} plans={plans} onEntryClick={handleEditEntry} onCellClick={handleCellClick} weekStart={dashboardWeekStart} />
                </div>
                <div className="hidden lg:block h-full">
                   <div className="bg-[#1a1a1a] border border-neutral-800 rounded-xl p-5 h-full flex flex-col">
                      <h3 className="text-xs font-mono text-neutral-500 uppercase tracking-widest mb-4">Identity Matrix</h3>
                      <div className="space-y-4 mb-6">
                        {Object.entries(IDENTITY_METADATA).map(([key, meta]) => (
                          <div key={key} className="flex gap-3">
                            <div className={`w-3 h-3 rounded-full mt-1 shrink-0 ${meta.color}`} />
                            <div><div className="text-sm font-bold text-neutral-200">{meta.label}</div><div className="text-[10px] text-neutral-500 leading-tight">{meta.description}</div></div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-auto pt-4 border-t border-neutral-800">
                        <div className="text-[11px] font-mono text-neutral-400 bg-black/40 px-3 py-2 rounded border border-neutral-800 flex items-center gap-2 mb-6">
                          <Calendar size={12} className="text-neutral-600" /> {format(dashboardWeekStart, 'MMM dd')} — {format(addDays(dashboardWeekStart, 7), 'MMM dd')}
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setDashboardWeekOffset(prev => prev - 1)} className="flex-1 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 p-2 rounded flex justify-center text-neutral-400"><ChevronLeft size={16} /></button>
                          <button onClick={() => setDashboardWeekOffset(0)} className="bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 p-2 rounded flex justify-center text-neutral-400"><RotateCcw size={16} /></button>
                          <button onClick={() => setDashboardWeekOffset(prev => prev + 1)} className="flex-1 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 p-2 rounded flex justify-center text-neutral-400"><ChevronRight size={16} /></button>
                        </div>
                      </div>
                   </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatusPanel entries={entries} onAction={() => openLogModal()} />
                <PointsCard entries={entries} weekStart={dashboardWeekStart} />
                <div className="bg-[#1a1a1a] border border-neutral-800 rounded-xl p-6 flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-mono text-neutral-500 uppercase tracking-widest mb-2">System Rules</h3>
                    <ul className="text-xs space-y-3 text-neutral-400">
                      <li className="flex gap-2"><ShieldAlert size={14} className="text-rose-500 shrink-0" /><span>Logging is restricted to 1 entry per day to ensure mapping fidelity.</span></li>
                      <li className="flex gap-2"><Zap size={14} className="text-violet-500 shrink-0" /><span>Streaks are sustained by any logged activity except Survival states.</span></li>
                    </ul>
                  </div>
                  <button onClick={() => todayHasEntry && todayEntry ? handleEditEntry(todayEntry.id) : openLogModal()} className="mt-6 w-full py-3 bg-neutral-100 hover:bg-white text-black font-bold rounded-lg transition-colors flex items-center justify-center gap-2">
                    {todayHasEntry ? <Edit3 size={20} /> : <Plus size={20} />}<span>{todayHasEntry ? 'Modify Identity' : 'Log Session'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
          {view === 'plans' && (
            <PlanBuilder 
              plans={plans} 
              onUpdatePlans={onUpdatePlans} 
              onLogPlan={handleLogPlan} 
              onDeletePlan={handleDeletePlan} 
              externalIsEditing={isPlanEditing} 
              externalEditingPlanId={editingPlanId} 
              onOpenEditor={handlePlanEditorOpen} 
              onCloseEditor={handlePlanEditorClose} 
              onDirtyChange={setIsPlanDirty}
            />
          )}
          {view === 'history' && <History entries={entries} plans={plans} onEditEntry={handleEditEntry} />}
          {view === 'discovery' && <DiscoveryPanel entries={entries} plans={plans} onUpdateEntries={setEntries} onUpdatePlans={setPlans} externalSyncStatus={syncStatus} onManualSync={() => accessToken && performSync(accessToken, entries, plans)} />}
        </div>
      </main>

      <nav className={`sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#121212]/95 backdrop-blur-xl border-t border-neutral-800 px-6 py-4 flex justify-between items-center transition-transform duration-300 ease-in-out ${isNavVisible ? 'translate-y-0' : 'translate-y-full'}`}><NavItems /></nav>
      
      <button 
        onClick={scrollToTop}
        className={`fixed right-6 sm:right-8 z-[60] bg-neutral-900 border border-neutral-700 p-3 rounded-full shadow-2xl transition-all duration-300 hover:bg-white hover:text-black active:scale-95 group 
        ${showScrollTop ? 'bottom-24 sm:bottom-12 opacity-100 scale-100' : 'bottom-12 opacity-0 scale-50 pointer-events-none'}`}
        aria-label="Scroll to Top"
      >
        <ArrowUp size={24} className="group-hover:-translate-y-0.5 transition-transform" />
      </button>

      {confirmModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setConfirmModal(null)} />
          <div className="relative bg-[#1a1a1a] border border-neutral-800 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 text-center space-y-4">
              <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-2 ${confirmModal.type === 'danger' ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-500'}`}>
                <AlertCircle size={32} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">{confirmModal.title}</h3>
                <p className="text-sm text-neutral-400 leading-relaxed font-sans">{confirmModal.message}</p>
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <button 
                  onClick={confirmModal.onConfirm}
                  className={`w-full py-3 rounded-xl font-bold transition-all ${confirmModal.type === 'danger' ? 'bg-rose-600 hover:bg-rose-500 text-white' : 'bg-neutral-100 hover:bg-white text-black'}`}
                >
                  {confirmModal.confirmText || 'Confirm'}
                </button>
                <button 
                  onClick={() => setConfirmModal(null)}
                  className="w-full py-3 rounded-xl font-bold bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isLogModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeLogModal} />
          <div className="relative bg-[#1a1a1a] border border-neutral-800 w-full max-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <LogAction 
              entries={entries} 
              plans={plans} 
              onSave={addOrUpdateEntry} 
              onDelete={handleDeleteEntry} 
              onCancel={closeLogModal} 
              initialDate={preselectedLogData?.date} 
              initialIdentity={preselectedLogData?.identity} 
              editingEntry={preselectedLogData?.editingEntry} 
              initialPlanId={preselectedLogData?.initialPlanId} 
            />
          </div>
        </div>
      )}
      {syncNotice && (
        <div className="fixed bottom-24 sm:bottom-8 left-0 right-0 px-4 sm:left-0 sm:right-0 z-[100] flex justify-center animate-in slide-in-from-bottom-4 fade-in duration-300">
          <button onClick={() => { setSyncNotice(false); changeView('discovery'); }} className="w-full sm:w-auto bg-amber-500 text-black px-4 sm:px-6 py-2.5 sm:py-3 rounded-full font-mono text-[9px] sm:text-[10px] font-bold uppercase tracking-tight shadow-2xl flex items-center justify-center gap-2 border border-white/20 hover:bg-amber-400 transition-colors">
            <CloudOff size={14} className="shrink-0" /><span className="sm:hidden">Sync Disabled: Link Now</span><span className="hidden sm:inline">Cloud Sync Disabled: Data is Local Only</span><div className="hidden sm:block px-1.5 py-0.5 bg-black/20 rounded text-[8px]">Link Now</div>
          </button>
        </div>
      )}
      {exitWarning && (
        <div className="fixed bottom-24 sm:bottom-8 left-0 right-0 px-4 sm:left-0 sm:right-0 z-[100] flex justify-center animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="bg-neutral-100 text-black px-6 py-3 rounded-full font-mono text-[10px] font-bold uppercase tracking-[0.2em] shadow-2xl flex items-center gap-3 border border-white/20">
            <LogOut size={14} className="text-black" /> Press back again to exit system <div className="w-1 h-1 rounded-full bg-rose-500 animate-pulse" />
          </div>
        </div>
      )}
      <footer className="hidden sm:flex border-t border-neutral-800 p-2 text-[10px] font-mono text-neutral-600 justify-between bg-[#0e0e0e]">
        <div className="flex gap-4"><span>&copy; 2026 Axiom</span><a href="https://github.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-neutral-400 hover:text-white transition-colors"><Github size={12} /> Source Access</a></div>
        <div className="flex gap-4"><span className={syncStatus !== 'idle' ? 'animate-pulse text-emerald-500' : ''}> {syncStatus !== 'idle' ? 'SYNC_ACTIVE' : 'IDENTITY_STABLE: OK'} </span><span>SYSTEM_VERSION: ALPHA_v1.9</span></div>
      </footer>
    </div>
  );
};

export default App;
