import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  LogOut
} from 'lucide-react';
import { format, addWeeks, addDays, isSameDay } from 'date-fns';

const STORAGE_KEY = 'axiom_os_data_v1';
const PLANS_STORAGE_KEY = 'axiom_os_plans_v1';
const VIEW_STORAGE_KEY = 'axiom_os_view_v1';

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

type ViewType = 'current' | 'history' | 'discovery' | 'plans';

const App: React.FC = () => {
  const [view, setView] = useState<ViewType>(() => {
    const savedView = localStorage.getItem(VIEW_STORAGE_KEY);
    return (savedView as any) || 'current';
  });
  
  const [isPlanEditing, setIsPlanEditing] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [entries, setEntries] = useState<WorkoutEntry[]>([]);
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [dashboardWeekOffset, setDashboardWeekOffset] = useState(0);
  const [preselectedLogData, setPreselectedLogData] = useState<{ date?: Date, identity?: IdentityState, editingEntry?: WorkoutEntry, initialPlanId?: string } | null>(null);
  const [exitWarning, setExitWarning] = useState(false);
  
  const [isNavVisible, setIsNavVisible] = useState(true);
  const lastScrollY = useRef(0);
  const exitTimerRef = useRef<number | null>(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  // Sync State Shared with DiscoveryPanel
  const [accessToken, setAccessToken] = useState<string | null>(() => localStorage.getItem('axiom_sync_token'));
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'loading' | 'success' | 'error'>('idle');
  const isInitialMount = useRef(true);
  const syncTimeoutRef = useRef<number | null>(null);

  // Requirement: Limit to 5 latest syncs.
  const performSync = useCallback(async (token: string, currentEntries: WorkoutEntry[], currentPlans: WorkoutPlan[]) => {
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

      // Cleanup Logic: Keep only latest 4 before adding the new one
      const q_files = encodeURIComponent(`'${folderId}' in parents and name contains "sync." and trashed = false`);
      const listFilesResponse = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q_files}&orderBy=createdTime desc&fields=files(id, name, createdTime)`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const filesData = await listFilesResponse.json();
      const existingSyncs = filesData.files || [];

      // If we have 5 or more, delete the older ones to make room (keeping top 4)
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
      console.error("AutoSync Failure:", e);
      setSyncStatus('error');
    }
  }, []);

  const loadLatestSyncOnStartup = useCallback(async (token: string) => {
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
          setTimeout(() => setSyncStatus('idle'), 2000);
        }
      } else {
        setSyncStatus('idle');
      }
    } catch (e) {
      console.error("Startup Sync Failure:", e);
      setSyncStatus('error');
    }
  }, []);

  // Initial Data Load
  useEffect(() => {
    const savedEntries = localStorage.getItem(STORAGE_KEY);
    const savedPlans = localStorage.getItem(PLANS_STORAGE_KEY);
    if (savedEntries) try { setEntries(JSON.parse(savedEntries)); } catch (e) {}
    if (savedPlans) try { setPlans(JSON.parse(savedPlans)); } catch (e) {}

    // Requirement: Auto import latest sync when found or on refresh
    if (accessToken) {
      loadLatestSyncOnStartup(accessToken);
    }
  }, [accessToken, loadLatestSyncOnStartup]);

  // Requirement: Auto sync when a change is detected
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (accessToken && (entries.length > 0 || plans.length > 0)) {
      if (syncTimeoutRef.current) window.clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = window.setTimeout(() => {
        performSync(accessToken, entries, plans);
      }, 3000) as unknown as number; // Debounced auto-sync
    }

    return () => {
      if (syncTimeoutRef.current) window.clearTimeout(syncTimeoutRef.current);
    };
  }, [entries, plans, accessToken, performSync]);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); }, [entries]);
  useEffect(() => { localStorage.setItem(PLANS_STORAGE_KEY, JSON.stringify(plans)); }, [plans]);

  // View and History Handling
  useEffect(() => {
    if (!window.history.state) {
      window.history.replaceState({ view, isSubPage: false }, '');
    }

    const handlePopState = (event: PopStateEvent) => {
      const state = event.state;
      if (state) {
        setView(state.view);
        setIsPlanEditing(state.isSubPage || false);
        if (!state.isSubPage) setEditingPlanId(null);
        setExitWarning(false);
      } else {
        if (view === 'current' && !isPlanEditing) {
          handleExitSequence();
        } else if (isPlanEditing) {
          setIsPlanEditing(false);
          setEditingPlanId(null);
          window.history.replaceState({ view, isSubPage: false }, '');
        } else {
          changeView('current');
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [view, isPlanEditing]);

  const handleExitSequence = () => {
    if (exitWarning) {
      window.history.back();
    } else {
      setExitWarning(true);
      window.history.pushState({ view: 'current', isSubPage: false }, '');
      if (exitTimerRef.current) window.clearTimeout(exitTimerRef.current);
      exitTimerRef.current = window.setTimeout(() => {
        setExitWarning(false);
      }, 3000) as unknown as number;
    }
  };

  const changeView = (newView: ViewType) => {
    if (newView === view && !isPlanEditing) return;
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

  const handlePlanEditorClose = () => {
    if (isPlanEditing) window.history.back();
  };

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY.current && currentScrollY > 50) setIsNavVisible(false);
      else setIsNavVisible(true);
      lastScrollY.current = currentScrollY;
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

  const deleteEntry = (id: string) => {
    if (window.confirm('Confirm Deletion?')) setEntries(prev => prev.filter(e => e.id !== id));
  };

  const handleUpdatePlans = (newPlans: WorkoutPlan[]) => setPlans(newPlans);

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

  const handleCloseModal = () => {
    setIsLogModalOpen(false);
    setPreselectedLogData(null);
  };

  const onTouchStart = (e: React.TouchEvent) => { if (window.innerWidth < 1024) setTouchStartX(e.targetTouches[0].clientX); };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX;
    if (deltaX > 60) setDashboardWeekOffset(prev => prev - 1);
    else if (deltaX < -60) setDashboardWeekOffset(prev => prev + 1);
    setTouchStartX(null);
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

  return (
    <div className="min-h-screen bg-[#121212] text-neutral-200 flex flex-col font-sans pb-20 sm:pb-0">
      <header className="border-b border-neutral-800 p-4 sticky top-0 bg-[#121212]/90 backdrop-blur-md z-30">
        <div className="max-w-7xl mx-auto flex flex-row justify-between items-center">
          <div className="flex items-center gap-3">
            <AxiomLogo className="w-8 h-8" />
            <div className="flex flex-col">
              <h1 className="text-lg font-mono font-bold tracking-tight uppercase leading-none text-white">Axiom v1.7</h1>
              <span className="text-[9px] text-neutral-500 font-mono hidden sm:inline uppercase">Personal Intelligence OS</span>
              <span className="text-[9px] text-neutral-500 font-mono sm:hidden uppercase tracking-tighter">Personal Intelligence OS</span>
            </div>
          </div>
          <nav className="hidden sm:flex items-center gap-2 bg-neutral-900/50 p-1.5 rounded-xl border border-neutral-800"><NavItems /></nav>
          <div className="sm:hidden flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${accessToken ? 'bg-emerald-500' : 'bg-neutral-600'} animate-pulse`} />
            <span className="text-[9px] font-mono text-neutral-600 uppercase tracking-tighter">{accessToken ? 'Linked' : 'Offline'}</span>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 space-y-8 bg-[#121212]">
        {view === 'current' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-stretch">
              <div className="lg:col-span-3 h-full" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} style={{ touchAction: 'pan-y' }}>
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
                    <div className="mt-auto">
                      <div className="pt-4 border-t border-neutral-800 mb-6">
                        <div className="text-[11px] font-mono text-neutral-400 bg-black/40 px-3 py-2 rounded border border-neutral-800 flex items-center gap-2">
                          <Calendar size={12} className="text-neutral-600" /> {format(dashboardWeekStart, 'MMM dd')} — {format(addDays(dashboardWeekStart, 7), 'MMM dd')}
                        </div>
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
              <StatusPanel entries={entries} onAction={() => setIsLogModalOpen(true)} />
              <PointsCard entries={entries} weekStart={dashboardWeekStart} />
              <div className="bg-[#1a1a1a] border border-neutral-800 rounded-xl p-6 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-mono text-neutral-500 uppercase tracking-widest mb-2">System Rules</h3>
                  <ul className="text-xs space-y-3 text-neutral-400">
                    <li className="flex gap-2"><ShieldAlert size={14} className="text-rose-500 shrink-0" /><span>Logging is restricted to 1 entry per day to ensure mapping fidelity.</span></li>
                    <li className="flex gap-2"><Zap size={14} className="text-violet-500 shrink-0" /><span>Streaks are sustained by any logged activity. Rest bridges the gap, while missing logs or Survival reset it.</span></li>
                  </ul>
                </div>
                <button onClick={() => todayHasEntry ? handleEditEntry(todayEntry!.id) : setIsLogModalOpen(true)} className="mt-6 w-full py-3 bg-neutral-100 hover:bg-white text-black font-bold rounded-lg transition-colors flex items-center justify-center gap-2">
                  {todayHasEntry ? <Edit3 size={20} /> : <Plus size={20} />}
                  <span>{todayHasEntry ? 'Modify Identity' : 'Log Session'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
        {view === 'plans' && (
          <PlanBuilder 
            plans={plans} 
            onUpdatePlans={handleUpdatePlans} 
            onLogPlan={handleLogPlan}
            externalIsEditing={isPlanEditing}
            externalEditingPlanId={editingPlanId}
            onOpenEditor={handlePlanEditorOpen}
            onCloseEditor={handlePlanEditorClose}
          />
        )}
        {view === 'history' && <History entries={entries} plans={plans} onEditEntry={handleEditEntry} />}
        {view === 'discovery' && (
          <DiscoveryPanel 
            entries={entries} 
            plans={plans} 
            onUpdateEntries={setEntries} 
            onUpdatePlans={setPlans} 
            externalSyncStatus={syncStatus}
            onManualSync={() => accessToken && performSync(accessToken, entries, plans)}
          />
        )}
      </main>
      <nav className={`sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#121212]/95 backdrop-blur-xl border-t border-neutral-800 px-6 py-4 flex justify-between items-center transition-transform duration-300 ease-in-out ${isNavVisible ? 'translate-y-0' : 'translate-y-full'}`}><NavItems /></nav>
      {isLogModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={handleCloseModal} />
          <div className="relative bg-[#1a1a1a] border border-neutral-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <LogAction 
              entries={entries} 
              plans={plans} 
              onSave={addOrUpdateEntry} 
              onDelete={deleteEntry} 
              onCancel={handleCloseModal} 
              initialDate={preselectedLogData?.date} 
              initialIdentity={preselectedLogData?.identity} 
              editingEntry={preselectedLogData?.editingEntry} 
              initialPlanId={preselectedLogData?.initialPlanId}
            />
          </div>
        </div>
      )}
      {exitWarning && (
        <div className="fixed bottom-24 sm:bottom-8 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="bg-neutral-100 text-black px-6 py-3 rounded-full font-mono text-[10px] font-bold uppercase tracking-[0.2em] shadow-2xl flex items-center gap-3 border border-white/20">
            <LogOut size={14} className="text-black" />
            Press back again to exit system
            <div className="w-1 h-1 rounded-full bg-rose-500 animate-pulse" />
          </div>
        </div>
      )}
      <footer className="hidden sm:flex border-t border-neutral-800 p-2 text-[10px] font-mono text-neutral-600 justify-between bg-[#0e0e0e]">
        <div className="flex gap-4">
          <span>&copy; 2026 Axiom</span>
          <a href="https://github.com/4kiu/axiom" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-neutral-400 hover:text-white transition-colors"><Github size={12} /> Source Access</a>
        </div>
        <div className="flex gap-4">
          <span className={syncStatus === 'syncing' ? 'animate-pulse text-emerald-500' : ''}>
            {syncStatus === 'syncing' ? 'SYNC_ACTIVE' : 'IDENTITY_STABLE: OK'}
          </span>
          <span>SYSTEM_VERSION: ALPHA_v1.7</span>
        </div>
      </footer>
    </div>
  );
};

export default App;