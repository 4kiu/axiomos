
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { IdentityState, WorkoutEntry, IDENTITY_METADATA, WorkoutPlan } from './types.ts';
import WeeklyGrid from './components/WeeklyGrid.tsx';
import LogAction from './components/LogAction.tsx';
import StatusPanel from './components/StatusPanel.tsx';
import PointsCard from './components/PointsCard.tsx';
import History from './components/History.tsx';
import UtilitiesPanel from './components/UtilitiesPanel.tsx';
import PlanBuilder from './components/PlanBuilder.tsx';
import ConfirmationModal from './components/ConfirmationModal.tsx';
import { 
  LayoutDashboard, 
  History as HistoryIcon, 
  Settings, 
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
  ArrowUp
} from 'lucide-react';
import { format, addWeeks, addDays, isSameDay } from 'date-fns';

const STORAGE_KEY = 'axiom_os_data_v1';
const PLANS_STORAGE_KEY = 'axiom_os_plans_v1';
const VIEW_STORAGE_KEY = 'axiom_os_view_v1';
const LAST_SYNC_TS_KEY = 'axiom_last_sync_ts';
const LAST_ACTIVE_TS_KEY = 'axiom_last_active_ts';

const VIEW_ORDER: ViewType[] = ['current', 'plans', 'history', 'discovery'];

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
  const weekStartsOn = options?.weekStartsOn ?? 6; // Updated default to 6 (Saturday)
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
  const [syncNotice, setSyncNotice] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<string | null>(null);
  
  const [isNavVisible, setIsNavVisible] = useState(true);
  const lastScrollY = useRef(0);
  const exitTimerRef = useRef<number | null>(null);
  
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const pageTouchStartX = useRef<number | null>(null);
  const pageTouchStartY = useRef<number | null>(null);
  const pageTouchEndX = useRef<number | null>(null);
  const isSwipePrevented = useRef<boolean>(false);

  const [hasImported, setHasImported] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(() => localStorage.getItem('axiom_sync_token'));
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'loading' | 'success' | 'error' | 'importing'>('idle');
  
  const lastKnownSyncTs = useRef<number>(Number(localStorage.getItem(LAST_SYNC_TS_KEY) || 0));
  const isSyncInProgress = useRef(false);
  const syncQueued = useRef(false);

  // Use a ref to always have access to the absolute latest data during sync cycles
  const latestDataRef = useRef({ entries, plans });
  useEffect(() => {
    latestDataRef.current = { entries, plans };
  }, [entries, plans]);

  const [isDirty, setIsDirty] = useState(false);
  const [pendingView, setPendingView] = useState<ViewType | null>(null);

  const performSync = useCallback(async (token: string) => {
    if (!hasImported) return;
    if (isSyncInProgress.current) {
      syncQueued.current = true;
      return;
    }

    const { entries: currentEntries, plans: currentPlans } = latestDataRef.current;

    isSyncInProgress.current = true;
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
      const manifest = { version: '1.7', timestamp: ts, data: { entries: currentEntries, plans: currentPlans } };
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
        lastKnownSyncTs.current = ts;
        localStorage.setItem(LAST_SYNC_TS_KEY, ts.toString());
        localStorage.setItem(LAST_ACTIVE_TS_KEY, Date.now().toString());

        // Cleanup: Limit to 20 latest sync files
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
          console.warn("Axiom Sync: Cleanup of old versions failed", cleanupErr);
        }

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
    } finally {
      isSyncInProgress.current = false;
      if (syncQueued.current) {
        syncQueued.current = false;
        // Re-trigger sync to catch up with any changes made while the previous sync was running
        performSync(token);
      }
    }
  }, [hasImported]);

  const loadLatestSync = useCallback(async (token: string) => {
    setSyncStatus('importing');
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
        
        // Auto-import only if new sync file is found (higher timestamp than local)
        if (driveTs > lastKnownSyncTs.current) {
          const fileResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${latestFile.id}?alt=media`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const manifest = await fileResponse.json();
          if (manifest.data) {
            if (manifest.data.entries) setEntries(manifest.data.entries);
            if (manifest.data.plans) setPlans(manifest.data.plans);
            lastKnownSyncTs.current = manifest.timestamp || driveTs;
            localStorage.setItem(LAST_SYNC_TS_KEY, lastKnownSyncTs.current.toString());
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
      setHasImported(true); // Ensure continuity of local usage even if cloud fails
    }
  }, []);

  useEffect(() => {
    // 30 day inactivity check: logout only if user has been away for more than 30 days
    const lastActive = localStorage.getItem(LAST_ACTIVE_TS_KEY);
    const now = Date.now();
    const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;

    if (lastActive && (now - parseInt(lastActive) > thirtyDaysInMs)) {
      localStorage.removeItem('axiom_sync_token');
      localStorage.removeItem('axiom_sync_profile');
      localStorage.removeItem(LAST_ACTIVE_TS_KEY);
      setAccessToken(null);
    } else {
      localStorage.setItem(LAST_ACTIVE_TS_KEY, now.toString());
    }

    const savedEntries = localStorage.getItem(STORAGE_KEY);
    const savedPlans = localStorage.getItem(PLANS_STORAGE_KEY);
    if (savedEntries) try { setEntries(JSON.parse(savedEntries)); } catch (e) {}
    if (savedPlans) try { setPlans(JSON.parse(savedPlans)); } catch (e) {}

    if (accessToken) {
      loadLatestSync(accessToken);
    } else {
      setHasImported(true); // Allow sync if user links later
      setSyncNotice(true);
      const timer = setTimeout(() => setSyncNotice(false), 10000);
      return () => clearTimeout(timer);
    }
  }, [accessToken, loadLatestSync]);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); }, [entries]);
  useEffect(() => { localStorage.setItem(PLANS_STORAGE_KEY, JSON.stringify(plans)); }, [plans]);

  // AUTO-SYNC ON CHANGES: Push to cloud whenever entries or plans change
  useEffect(() => {
    if (accessToken && hasImported) {
      const timeoutId = setTimeout(() => {
        performSync(accessToken);
      }, 1000); // Debounce reduced to 1s for better catch-up responsiveness
      return () => clearTimeout(timeoutId);
    }
  }, [entries, plans, accessToken, hasImported, performSync]);

  useEffect(() => {
    if (!window.history.state) window.history.replaceState({ view, isSubPage: false, isLogOpen: false }, '');
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state;

      // Intercept back gesture if there are unsaved exercise changes
      if (isDirty && isPlanEditing) {
        const isLeavingEditor = !state || state.view !== 'plans' || !state.isSubPage;
        if (isLeavingEditor) {
          // Push current state back to keep user in editor and show confirmation alert
          window.history.pushState({ view, isSubPage: true, isLogOpen: isLogModalOpen }, '');
          setPendingView(state?.view || 'current');
          return;
        }
      }

      if (state) {
        setView(state.view);
        setIsPlanEditing(state.isSubPage || false);
        setIsLogModalOpen(state.isLogOpen || false);
        if (!state.isSubPage) setEditingPlanId(null);
        setExitWarning(false);
      } else {
        if (view === 'current' && !isPlanEditing && !isLogModalOpen) handleExitSequence();
        else if (isLogModalOpen) {
          setIsLogModalOpen(false);
          window.history.replaceState({ view, isSubPage: isPlanEditing, isLogOpen: false }, '');
        } else if (isPlanEditing) {
          setIsPlanEditing(false);
          setEditingPlanId(null);
          window.history.replaceState({ view, isSubPage: false, isLogOpen: false }, '');
        } else changeView('current');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [view, isPlanEditing, isLogModalOpen, isDirty]);

  const handleExitSequence = () => {
    if (exitWarning) window.history.back();
    else {
      setExitWarning(true);
      window.history.pushState({ view: 'current', isSubPage: false, isLogOpen: false }, '');
      if (exitTimerRef.current) window.clearTimeout(exitTimerRef.current);
      exitTimerRef.current = window.setTimeout(() => setExitWarning(false), 3000) as unknown as number;
    }
  };

  const changeView = (newView: ViewType, force = false) => {
    if (newView === view && !isPlanEditing) return;

    const isClosingEditor = newView === view && isPlanEditing;
    const isChangingView = newView !== view;

    if (!force && isDirty && (isChangingView || isClosingEditor)) {
      setPendingView(newView);
      return;
    }
    
    const currentIndex = VIEW_ORDER.indexOf(view);
    const newIndex = VIEW_ORDER.indexOf(newView);
    setSwipeDirection(newIndex > currentIndex ? 'right' : 'left');

    setView(newView);
    setIsPlanEditing(false);
    setEditingPlanId(null);
    setIsLogModalOpen(false);
    window.history.pushState({ view: newView, isSubPage: false, isLogOpen: false }, '');
    localStorage.setItem(VIEW_STORAGE_KEY, newView);
  };

  const handlePlanEditorOpen = (planId: string | null) => {
    setIsPlanEditing(true);
    setEditingPlanId(planId);
    window.history.pushState({ view: 'plans', isSubPage: true, isLogOpen: false }, '');
  };

  const handlePlanEditorClose = () => { 
    if (isPlanEditing) changeView(view); 
  };

  const handleOpenLogModal = (data: { date?: Date, identity?: IdentityState, editingEntry?: WorkoutEntry, initialPlanId?: string } | null = null) => {
    setPreselectedLogData(data);
    setIsLogModalOpen(true);
    window.history.pushState({ view, isSubPage: isPlanEditing, isLogOpen: true }, '');
  };

  const handleCloseLogModal = () => {
    if (isLogModalOpen) {
      window.history.back();
    }
  };

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

  // Grid level swipe handlers (Week switching)
  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation(); // Priority: Prevent page swipe from triggering when interacting with table
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation(); // Priority: Prevent page swipe from tracking when interacting with table
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation(); // Priority: Prevent page swipe from ending when interacting with table
    if (!touchStartX.current || !touchEndX.current) return;
    const distance = touchStartX.current - touchEndX.current;
    
    if (Math.abs(distance) > 50) {
      if (distance > 50) setDashboardWeekOffset(prev => prev + 1);
      else if (distance < -50) setDashboardWeekOffset(prev => prev - 1);
    }

    touchStartX.current = null;
    touchEndX.current = null;
  };

  // Page level swipe handlers (View switching)
  const handlePageTouchStart = (e: React.TouchEvent) => {
    if (isPlanEditing || isLogModalOpen) return;
    pageTouchStartX.current = e.targetTouches[0].clientX;
    pageTouchStartY.current = e.targetTouches[0].clientY;
    isSwipePrevented.current = false;
  };

  const handlePageTouchMove = (e: React.TouchEvent) => {
    if (isPlanEditing || isLogModalOpen || isSwipePrevented.current) return;
    
    const currentX = e.targetTouches[0].clientX;
    const currentY = e.targetTouches[0].clientY;
    
    const dx = Math.abs(currentX - (pageTouchStartX.current || currentX));
    const dy = Math.abs(currentY - (pageTouchStartY.current || currentY));
    
    // If vertical movement is larger than horizontal, or there is significant vertical movement
    // mark the swipe as prevented until the touch is released.
    if (dy > dx || dy > 10) {
      isSwipePrevented.current = true;
      return;
    }
    
    pageTouchEndX.current = currentX;
  };

  const handlePageTouchEnd = () => {
    if (!pageTouchStartX.current || !pageTouchEndX.current || isSwipePrevented.current) {
      pageTouchStartX.current = null;
      pageTouchStartY.current = null;
      pageTouchEndX.current = null;
      isSwipePrevented.current = false;
      return;
    }
    
    const distance = pageTouchStartX.current - pageTouchEndX.current;
    const threshold = 15; // Reduced for higher sensitivity

    if (Math.abs(distance) > threshold) {
      const currentIndex = VIEW_ORDER.indexOf(view);
      if (distance > threshold && currentIndex < VIEW_ORDER.length - 1) {
        changeView(VIEW_ORDER[currentIndex + 1]);
      } else if (distance < -threshold && currentIndex > 0) {
        changeView(VIEW_ORDER[currentIndex - 1]);
      }
    }

    pageTouchStartX.current = null;
    pageTouchStartY.current = null;
    pageTouchEndX.current = null;
    isSwipePrevented.current = false;
  };

  const addOrUpdateEntry = (entryData: Omit<WorkoutEntry, 'id'>, id?: string) => {
    if (id) setEntries(prev => prev.map(e => e.id === id ? { ...entryData, id } : e));
    else setEntries(prev => [...prev, { ...entryData, id: crypto.randomUUID() }]);
    localStorage.setItem(LAST_ACTIVE_TS_KEY, Date.now().toString());
    handleCloseLogModal();
  };

  const deleteEntry = (id: string) => {
    setDeleteConfirmationId(id);
  };

  const confirmDeleteEntry = () => {
    if (deleteConfirmationId) {
      setEntries(prev => prev.filter(e => e.id !== deleteConfirmationId));
      localStorage.setItem(LAST_ACTIVE_TS_KEY, Date.now().toString());
      setDeleteConfirmationId(null);
    }
  };

  const handleLogPlan = (planId: string) => {
    const today = new Date();
    const existingToday = entries.find(e => isSameDay(new Date(e.timestamp), today));
    if (existingToday) setEntries(prev => prev.map(e => e.id === existingToday.id ? { ...e, planId } : e));
    else {
      handleOpenLogModal({ date: today, identity: IdentityState.NORMAL, initialPlanId: planId });
    }
  };

  const handleCellClick = (date: Date, identity: IdentityState) => {
    handleOpenLogModal({ date, identity });
  };

  const handleEditEntry = (id: string) => {
    const entry = entries.find(e => e.id === id);
    if (entry) {
      handleOpenLogModal({ editingEntry: entry });
    }
  };

  const dashboardWeekStart = startOfWeek(addWeeks(new Date(), dashboardWeekOffset), { weekStartsOn: 6 }); // Changed to 6 (Saturday)
  const todayEntry = entries.find(e => isSameDay(new Date(e.timestamp), new Date()));
  const todayHasEntry = !!todayEntry;

  const NavItems = () => (
    <>
      <button onClick={() => changeView('current')} className={`px-4 sm:px-6 py-2 rounded-lg flex items-center justify-center transition-all ${view === 'current' ? 'bg-neutral-100 text-black' : 'hover:bg-neutral-800 text-neutral-400'}`}><LayoutDashboard size={22} /></button>
      <button onClick={() => changeView('plans')} className={`px-4 sm:px-6 py-2 rounded-lg flex items-center justify-center transition-all ${view === 'plans' ? 'bg-neutral-100 text-black' : 'hover:bg-neutral-800 text-neutral-400'}`}><BookOpen size={22} /></button>
      <button onClick={() => changeView('history')} className={`px-4 sm:px-6 py-2 rounded-lg flex items-center justify-center transition-all ${view === 'history' ? 'bg-neutral-100 text-black' : 'hover:bg-neutral-800 text-neutral-400'}`}><HistoryIcon size={22} /></button>
      <button onClick={() => changeView('discovery')} className={`px-4 sm:px-6 py-2 rounded-lg flex items-center justify-center transition-all ${view === 'discovery' ? 'bg-neutral-100 text-black' : 'hover:bg-neutral-800 text-neutral-400'}`}><Settings size={22} /></button>
    </>
  );

  const StatusIndicator = () => {
    let statusText = accessToken ? 'Linked' : 'Offline';
    let dotColor = accessToken ? 'bg-emerald-500' : 'bg-neutral-600';
    let Icon = accessToken ? Cloud : CloudOff;
    
    if (syncStatus === 'importing') {
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
        <div className={`w-1.5 h-1.5 rounded-full ${dotColor} ${syncStatus !== 'idle' && syncStatus !== 'success' && syncStatus !== 'error' ? 'animate-pulse' : ''}`} />
        <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-tighter whitespace-nowrap">{statusText}</span>
        <Icon size={12} className={`text-neutral-500 ${syncStatus !== 'idle' && syncStatus !== 'success' && syncStatus !== 'error' ? 'animate-spin' : ''}`} />
      </div>
    );
  };

  return (
    <div 
      className="min-h-screen bg-[#121212] text-neutral-200 flex flex-col font-sans pb-20 sm:pb-0 select-none"
      onTouchStart={handlePageTouchStart}
      onTouchMove={handlePageTouchMove}
      onTouchEnd={handlePageTouchEnd}
    >
      <header className="border-b border-neutral-800 p-4 sticky top-0 bg-[#121212]/90 backdrop-blur-md z-30">
        <div className="max-w-7xl mx-auto flex flex-row justify-between items-center">
          <div className="flex items-center gap-3">
            <AxiomLogo className="w-8 h-8" />
            <div className="flex flex-col">
              <h1 className="text-lg font-mono font-bold tracking-tight uppercase leading-none text-white">Axiom v2.1</h1>
              <span className="text-[9px] text-neutral-500 font-mono uppercase tracking-tighter">Personal Intelligence OS</span>
            </div>
          </div>
          <nav className="hidden sm:flex items-center gap-2 bg-neutral-900/50 p-1.5 rounded-xl border border-neutral-800"><NavItems /></nav>
          
          <div className="flex items-center gap-2">
            {dashboardWeekOffset !== 0 ? (
              <button 
                onClick={() => {
                  setDashboardWeekOffset(0);
                }}
                className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500 text-black rounded-lg font-mono text-[9px] font-bold uppercase tracking-tight shadow-lg animate-in fade-in zoom-in-95"
              >
                <RotateCcw size={12} />
                <span>Return to Current</span>
              </button>
            ) : (
              <StatusIndicator />
            )}
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 space-y-8 bg-[#121212] page-transition-wrapper">
        <div key={view} className={swipeDirection === 'right' ? 'page-enter-right' : 'page-enter-left'}>
          {view === 'current' && (
            <div className="space-y-6">
              <div 
                className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-stretch"
              >
                <div 
                  className="lg:col-span-3 h-full relative"
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                >
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
                <StatusPanel entries={entries} onAction={() => handleOpenLogModal()} />
                <PointsCard entries={entries} weekStart={dashboardWeekStart} />
                <div className="bg-[#1a1a1a] border border-neutral-800 rounded-xl p-6 flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-mono text-neutral-500 uppercase tracking-widest mb-2">System Rules</h3>
                    <ul className="text-xs space-y-3 text-neutral-400">
                      <li className="flex gap-2"><ShieldAlert size={14} className="text-rose-500 shrink-0" /><span>Logging is restricted to 1 entry per day to ensure mapping fidelity.</span></li>
                      <li className="flex gap-2"><Zap size={14} className="text-violet-500 shrink-0" /><span>Streaks are sustained by any logged activity except Survival states.</span></li>
                    </ul>
                  </div>
                  <button onClick={() => todayHasEntry ? handleEditEntry(todayEntry!.id) : handleOpenLogModal()} className="mt-6 w-full py-3 bg-neutral-100 hover:bg-white text-black font-bold rounded-lg transition-colors flex items-center justify-center gap-2">
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
              onUpdatePlans={setPlans} 
              onLogPlan={handleLogPlan} 
              onBack={() => changeView('current')}
              externalIsEditing={isPlanEditing} 
              externalEditingPlanId={editingPlanId} 
              onOpenEditor={handlePlanEditorOpen} 
              onCloseEditor={handlePlanEditorClose} 
              onDirtyChange={setIsDirty}
            />
          )}
          {view === 'history' && <History entries={entries} plans={plans} onEditEntry={handleEditEntry} />}
          {view === 'discovery' && (
            <UtilitiesPanel 
              entries={entries} 
              plans={plans} 
              onUpdateEntries={setEntries} 
              onUpdatePlans={setPlans} 
              externalSyncStatus={syncStatus}
              onManualSync={() => accessToken && performSync(accessToken)}
            />
          )}
        </div>
      </main>
      <nav className={`sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#121212]/95 backdrop-blur-xl border-t border-neutral-800 px-6 py-4 flex justify-between items-center transition-transform duration-300 ease-in-out ${isNavVisible ? 'translate-y-0' : 'translate-y-full'}`}><NavItems /></nav>
      
      <button 
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className={`fixed right-6 sm:right-8 z-[60] bg-neutral-900 border border-neutral-700 p-3 rounded-full shadow-2xl transition-all duration-300 hover:bg-white hover:text-black active:scale-95 group backdrop-blur-sm
        ${showScrollTop && !isLogModalOpen ? 'bottom-24 sm:bottom-12 opacity-100 scale-100' : 'bottom-12 opacity-0 scale-50 pointer-events-none'}`}
        aria-label="Scroll to Top"
      >
        <ArrowUp size={24} className="group-hover:-translate-y-0.5 transition-transform" />
      </button>

      {isLogModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={handleCloseLogModal} />
          <div className="relative bg-[#1a1a1a] border border-neutral-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <LogAction 
              entries={entries} 
              plans={plans} 
              onSave={addOrUpdateEntry} 
              onDelete={deleteEntry} 
              onCancel={handleCloseLogModal} 
              initialDate={preselectedLogData?.date} 
              initialIdentity={preselectedLogData?.identity} 
              editingEntry={preselectedLogData?.editingEntry} 
              initialPlanId={preselectedLogData?.initialPlanId}
            />
          </div>
        </div>
      )}

      <ConfirmationModal 
        isOpen={!!deleteConfirmationId}
        title="Purge Identity Trace"
        message="This operation will permanently delete the selected training log from the system matrix. This action cannot be undone."
        confirmLabel="Purge Record"
        onConfirm={confirmDeleteEntry}
        onCancel={() => setDeleteConfirmationId(null)}
      />

      <ConfirmationModal 
        isOpen={!!pendingView}
        title="Unsaved Sequence Detected"
        message="Your blueprint modifications have not been committed to the system matrix. Navigating away will purge these unsaved parameters."
        confirmLabel="Discard & Exit"
        onConfirm={() => {
          setIsDirty(false);
          const target = pendingView!;
          setPendingView(null);
          changeView(target, true);
        }}
        onCancel={() => setPendingView(null)}
        variant="warning"
      />

      {syncNotice && (
        <div className="fixed bottom-24 sm:bottom-8 left-0 right-0 px-4 z-[100] flex justify-center animate-in slide-in-from-bottom-4 fade-in duration-300">
          <button 
            onClick={() => { setSyncNotice(false); changeView('discovery'); }} 
            className="w-full sm:w-auto bg-amber-500 text-black px-4 sm:px-6 py-2.5 sm:py-3 rounded-full font-mono text-[9px] sm:text-[10px] font-bold uppercase tracking-tight sm:tracking-[0.1em] shadow-2xl flex items-center justify-center gap-2 sm:gap-3 border border-white/20 hover:bg-amber-400 transition-colors"
          >
            <CloudOff size={14} className="shrink-0" />
            <span className="sm:hidden">Sync Disabled: Link Now</span>
            <span className="hidden sm:inline">Cloud Sync Disabled: Data is Local Only</span>
            <div className="hidden sm:block px-1.5 py-0.5 bg-black/20 rounded text-[8px]">Link Now</div>
          </button>
        </div>
      )}
      {exitWarning && (
        <div className="fixed bottom-24 sm:bottom-8 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="bg-neutral-100 text-black px-6 py-3 rounded-full font-mono text-[10px] font-bold uppercase tracking-[0.2em] shadow-2xl flex items-center gap-3 border border-white/20">
            <LogOut size={14} className="text-black" /> Press back again to exit system <div className="w-1 h-1 rounded-full bg-rose-500 animate-pulse" />
          </div>
        </div>
      )}
      <footer className="hidden sm:flex border-t border-neutral-800 p-2 text-[10px] font-mono text-neutral-600 justify-between bg-[#0e0e0e]">
        <div className="flex gap-4">
          <span>&copy; 2026 Axiom</span>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-neutral-400 hover:text-white transition-colors"><Github size={12} /> Source Access</a>
        </div>
        <div className="flex gap-4">
          <span className={syncStatus !== 'idle' ? 'animate-pulse text-emerald-500' : ''}> {syncStatus !== 'idle' ? 'SYNC_ACTIVE' : 'IDENTITY_STABLE: OK'} </span>
          <span>SYSTEM_VERSION: ALPHA_v2.1</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
