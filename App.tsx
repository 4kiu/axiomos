
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { IdentityState, WorkoutEntry, IDENTITY_METADATA, WorkoutPlan, SyncMode } from './types.ts';
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
import { format, addWeeks, addDays, isSameDay } from 'date-fns';

const STORAGE_KEY = 'axiom_os_data_v1';
const PLANS_STORAGE_KEY = 'axiom_os_plans_v1';
const VIEW_STORAGE_KEY = 'axiom_os_view_v1';
const LAST_SYNC_TS_KEY = 'axiom_last_sync_ts';
const SYNC_TOKEN_TS_KEY = 'axiom_sync_token_ts';
const SYNC_MODE_KEY = 'axiom_sync_mode_v1';
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
  
  // Track dirty state for navigation guard
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
  
  const [syncMode, setSyncMode] = useState<SyncMode>(() => {
    const saved = localStorage.getItem(SYNC_MODE_KEY);
    return (saved as SyncMode) || 'sync';
  });

  const exitTimerRef = useRef<number | null>(null);
  
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
  
  const isInitialMount = useRef(true);
  const syncTimeoutRef = useRef<number | null>(null);

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

      const q_files = encodeURIComponent(`'${folderId}' in parents and name contains "sync." and trashed = false`);
      const listFilesResponse = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q_files}&orderBy=createdTime desc&fields=files(id, name, createdTime)`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const filesData = await listFilesResponse.json();
      const existingSyncs = filesData.files || [];

      if (existingSyncs.length >= 5) {
        const toDelete = existingSyncs.slice(4);
        for (const file of toDelete) {
          await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
        }
      }

      const syncName = `sync.${format(new Date(), 'ss.mm.HH.dd.MM.yyyy')}.json`;
      const manifest = { version: '1.7', timestamp: Date.now(), data: { entries: currentEntries, plans: currentPlans } };
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
        setSyncStatus('success');
        setTimeout(() => setSyncStatus('idle'), 2000);
      } else {
        if (response.status === 401) {
          setAccessToken(null);
          localStorage.removeItem('axiom_sync_token');
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
      const listFilesResponse = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q_files}&orderBy=createdTime desc&pageSize=1&fields=files(id, name)`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const filesData = await listFilesResponse.json();
      const latestFile = filesData.files?.[0];

      if (latestFile) {
        const fileResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${latestFile.id}?alt=media`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const manifest = await fileResponse.json();
        if (manifest.data) {
          if (manifest.data.entries) setEntries(manifest.data.entries);
          if (manifest.data.plans) setPlans(manifest.data.plans);
          setSyncStatus('success');
          setHasImported(true);
          setTimeout(() => setSyncStatus('idle'), 2000);
        }
      } else {
        setSyncStatus('idle');
        setHasImported(true);
      }
    } catch (e) {
      setSyncStatus('error');
    }
  }, []);

  useEffect(() => { localStorage.setItem(SYNC_MODE_KEY, syncMode); }, [syncMode]);

  useEffect(() => {
    const savedEntries = localStorage.getItem(STORAGE_KEY);
    const savedPlans = localStorage.getItem(PLANS_STORAGE_KEY);
    if (savedEntries) try { setEntries(JSON.parse(savedEntries)); } catch (e) {}
    if (savedPlans) try { setPlans(JSON.parse(savedPlans)); } catch (e) {}

    if (accessToken) {
      if (syncMode === 'sync' || syncMode === 'load') {
        loadLatestSync(accessToken);
      }
    } else {
      setSyncNotice(true);
      const timer = setTimeout(() => setSyncNotice(false), 8000);
      return () => clearTimeout(timer);
    }
  }, [accessToken, loadLatestSync, syncMode]);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    
    if (accessToken && syncMode === 'sync' && hasImported) {
      if (syncTimeoutRef.current) window.clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = window.setTimeout(() => {
        performSync(accessToken, entries, plans);
      }, 3000) as unknown as number;
    }

    return () => {
      if (syncTimeoutRef.current) window.clearTimeout(syncTimeoutRef.current);
    };
  }, [entries, plans, accessToken, performSync, syncMode, hasImported]);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); }, [entries]);
  useEffect(() => { localStorage.setItem(PLANS_STORAGE_KEY, JSON.stringify(plans)); }, [plans]);

  useEffect(() => {
    if (!window.history.state) window.history.replaceState({ view, isSubPage: false }, '');
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state;
      if (state) {
        setView(state.view);
        setIsPlanEditing(state.isSubPage || false);
        if (!state.isSubPage) setEditingPlanId(null);
        setExitWarning(false);
      } else {
        if (view === 'current' && !isPlanEditing) handleExitSequence();
        else if (isPlanEditing) {
          setIsPlanEditing(false);
          setEditingPlanId(null);
          window.history.replaceState({ view, isSubPage: false }, '');
        } else changeView('current');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [view, isPlanEditing]);

  const handleExitSequence = () => {
    if (exitWarning) window.history.back();
    else {
      setExitWarning(true);
      window.history.pushState({ view: 'current', isSubPage: false }, '');
      if (exitTimerRef.current) window.clearTimeout(exitTimerRef.current);
      exitTimerRef.current = window.setTimeout(() => setExitWarning(false), 3000) as unknown as number;
    }
  };

  const changeView = (newView: ViewType) => {
    if (newView === view && !isPlanEditing) return;

    // Navigation Guard for unsaved changes
    if (isPlanDirty) {
      setConfirmModal({
        title: "Unsaved Sequences",
        message: "You have unsaved blueprint modifications. Abort changes and navigate away?",
        type: 'warning',
        confirmText: "Abort Changes",
        onConfirm: () => {
          setConfirmModal(null);
          setIsPlanDirty(false);
          performViewChange(newView);
        }
      });
      return;
    }

    performViewChange(newView);
  };

  const performViewChange = (newView: ViewType) => {
    setView(newView);
    setIsPlanEditing(false);
    setEditingPlanId(null);
    window.history.pushState({ view: newView, isSubPage: false }, '');
    localStorage.setItem(VIEW_STORAGE_KEY, newView);
  };

  const handlePlanEditorOpen = (planId: string | null) => {
    setIsPlanEditing(true);
    setEditingPlanId(planId);
    window.history.pushState({ view: 'plans', isSubPage: true }, '');
  };

  const handlePlanEditorClose = (force: boolean = false) => { 
    if (!force && isPlanDirty) {
      setConfirmModal({
        title: "Unsaved Changes",
        message: "System detect unsaved modifications. Exit blueprint editor?",
        type: 'warning',
        confirmText: "Exit Editor",
        onConfirm: () => {
          setConfirmModal(null);
          setIsPlanDirty(false);
          if (isPlanEditing) window.history.back();
        }
      });
      return;
    }
    if (isPlanEditing) window.history.back(); 
  };

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > 300) setShowScrollTop(true);
      else setShowScrollTop(false);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const addOrUpdateEntry = (entryData: Omit<WorkoutEntry, 'id'>, id?: string) => {
    if (id) setEntries(prev => prev.map(e => e.id === id ? { ...entryData, id } : e));
    else setEntries(prev => [...prev, { ...entryData, id: crypto.randomUUID() }]);
    setIsLogModalOpen(false);
    setPreselectedLogData(null);
  };

  const openLogModal = () => {
    setPreselectedLogData(null);
    setIsLogModalOpen(true);
  };

  const onUpdatePlans = (newPlans: WorkoutPlan[]) => {
    setPlans(newPlans);
  };

  const handleDeletePlan = (planId: string) => {
    setConfirmModal({
      title: "Purge Blueprint?",
      message: "All modules and settings within this training profile will be permanently lost from local memory.",
      type: 'danger',
      confirmText: "Purge Blueprint",
      onConfirm: () => {
        setPlans(prev => prev.filter(p => p.id !== planId));
        setConfirmModal(null);
      }
    });
  };

  const deleteEntry = (id: string) => {
    setConfirmModal({
      title: "Purge Identity Log?",
      message: "This record will be permanently deleted from the Axiom system matrix.",
      type: 'danger',
      confirmText: "Purge Record",
      onConfirm: () => {
        setEntries(prev => prev.filter(e => e.id !== id));
        setConfirmModal(null);
        setIsLogModalOpen(false);
        setPreselectedLogData(null);
      }
    });
  };

  const handleLogPlan = (planId: string) => {
    const today = new Date();
    const existingToday = entries.find(e => isSameDay(new Date(e.timestamp), today));
    if (existingToday) setEntries(prev => prev.map(e => e.id === existingToday.id ? { ...e, planId } : e));
    else {
      setPreselectedLogData({ date: today, identity: IdentityState.NORMAL, initialPlanId: planId });
      setIsLogModalOpen(true);
    }
  };

  const handleCellClick = (date: Date, identity: IdentityState) => {
    setPreselectedLogData({ date, identity });
    setIsLogModalOpen(true);
  };

  const handleEditEntry = (id: string) => {
    const entry = entries.find(e => e.id === id);
    if (entry) {
      setPreselectedLogData({ editingEntry: entry });
      setIsLogModalOpen(true);
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
      <button onClick={() => changeView('current')} className={`px-4 sm:px-6 py-2 rounded-lg flex items-center justify-center transition-all ${view === 'current' ? 'bg-neutral-100 text-black' : 'hover:bg-neutral-800 text-neutral-400'}`}><LayoutDashboard size={22} /></button>
      <button onClick={() => changeView('plans')} className={`px-4 sm:px-6 py-2 rounded-lg flex items-center justify-center transition-all ${view === 'plans' ? 'bg-neutral-100 text-black' : 'hover:bg-neutral-800 text-neutral-400'}`}><BookOpen size={22} /></button>
      <button onClick={() => changeView('history')} className={`px-4 sm:px-6 py-2 rounded-lg flex items-center justify-center transition-all ${view === 'history' ? 'bg-neutral-100 text-black' : 'hover:bg-neutral-800 text-neutral-400'}`}><HistoryIcon size={22} /></button>
      <button onClick={() => changeView('discovery')} className={`px-4 sm:px-6 py-2 rounded-lg flex items-center justify-center transition-all ${view === 'discovery' ? 'bg-neutral-100 text-black' : 'hover:bg-neutral-800 text-neutral-400'}`}><BrainCircuit size={22} /></button>
    </>
  );

  const StatusIndicator = () => {
    let statusText = accessToken ? 'Linked' : 'Offline';
    let dotColor = accessToken ? 'bg-emerald-500' : 'bg-neutral-600';
    let Icon = accessToken ? Cloud : CloudOff;
    
    if (syncStatus === 'loading') {
      statusText = 'Importing...';
      dotColor = 'bg-amber-500';
      Icon = RefreshCw;
    } else if (syncStatus === 'syncing') {
      statusText = 'Syncing...';
      dotColor = 'bg-blue-500';
      Icon = RefreshCw;
    } else if (syncStatus === 'success' && accessToken) {
      statusText = 'Success';
      Icon = CheckCircle2;
    } else if (syncStatus === 'error') {
      statusText = 'Auth Error';
      dotColor = 'bg-rose-500';
      Icon = AlertTriangle;
    }

    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-900/40 border border-neutral-800 rounded-lg">
        <div className={`w-1.5 h-1.5 rounded-full ${dotColor} ${syncStatus !== 'idle' ? 'animate-pulse' : ''}`} />
        <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-tighter whitespace-nowrap">{statusText}</span>
        <Icon size={12} className={`text-neutral-500 ${syncStatus !== 'idle' && syncStatus !== 'success' && syncStatus !== 'error' ? 'animate-spin' : ''}`} />
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#121212] text-neutral-200 flex flex-col font-sans pb-20 sm:pb-0">
      <header className="border-b border-neutral-800 p-4 sticky top-0 bg-[#121212]/90 backdrop-blur-md z-30">
        <div className="max-w-7xl mx-auto flex flex-row justify-between items-center">
          <div className="flex items-center gap-3">
            <AxiomLogo className="w-8 h-8" />
            <div className="flex flex-col">
              <h1 className="text-lg font-mono font-bold tracking-tight uppercase leading-none text-white">Axiom v1.9</h1>
              <span className="text-[9px] text-neutral-500 font-mono uppercase tracking-tighter">Personal Intelligence OS</span>
            </div>
          </div>
          <nav className="hidden sm:flex items-center gap-2 bg-neutral-900/50 p-1.5 rounded-xl border border-neutral-800"><NavItems /></nav>
          <StatusIndicator />
        </div>
      </header>
      
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 space-y-8 bg-[#121212] relative transition-all duration-300">
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

      <nav className={`sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#121212]/95 backdrop-blur-xl border-t border-neutral-800 px-6 py-4 flex justify-between items-center transition-transform duration-300 ease-in-out translate-y-0`}><NavItems /></nav>
      
      <button 
        onClick={scrollToTop}
        className={`fixed right-6 sm:right-8 z-[60] bg-neutral-900 border border-neutral-700 p-3 rounded-full shadow-2xl transition-all duration-300 hover:bg-white hover:text-black active:scale-95 group 
        ${showScrollTop ? 'bottom-24 sm:bottom-12 opacity-100 scale-100' : 'bottom-12 opacity-0 scale-50 pointer-events-none'}`}
        aria-label="Scroll to Top"
      >
        <ArrowUp size={24} className="group-hover:-translate-y-0.5 transition-transform" />
      </button>

      {/* Custom Confirmation Modal */}
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
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsLogModalOpen(false)} />
          <div className="relative bg-[#1a1a1a] border border-neutral-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <LogAction 
              entries={entries} 
              plans={plans} 
              onSave={addOrUpdateEntry} 
              onDelete={deleteEntry} 
              onCancel={() => setIsLogModalOpen(false)} 
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
