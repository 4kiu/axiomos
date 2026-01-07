
import React, { useState, useEffect, useRef } from 'react';
import { IdentityState, WorkoutEntry, IDENTITY_METADATA, WorkoutPlan } from './types';
import WeeklyGrid from './components/WeeklyGrid';
import LogAction from './components/LogAction';
import StatusPanel from './components/StatusPanel';
import PointsCard from './components/PointsCard';
import History from './components/History';
import DiscoveryPanel from './components/DiscoveryPanel';
import PlanBuilder from './components/PlanBuilder';
import { 
  LayoutDashboard, 
  History as HistoryIcon, 
  BrainCircuit, 
  Plus, 
  ShieldAlert, 
  Zap, 
  BookOpen, 
  ChevronLeft, 
  ChevronRight, 
  RotateCcw,
  Calendar,
  Edit3,
  Download,
  GitBranch,
  ChevronDown,
  GitFork,
  Github
} from 'lucide-react';
import { format, addWeeks, addDays, isSameDay } from 'date-fns';

const STORAGE_KEY = 'axiom_os_data_v1';
const PLANS_STORAGE_KEY = 'axiom_os_plans_v1';
const ACTIVE_BRANCH_KEY = 'axiom_os_active_branch';
const BRANCHES_KEY = 'axiom_os_branches';

// Axiom Stylized Logo Component
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
      strokeWidth="8" 
      strokeLinecap="round" 
    />
  </svg>
);

// Helper for week start
const startOfWeek = (date: Date | number, options?: { weekStartsOn?: number }) => {
  const d = new Date(date);
  const day = d.getDay();
  const weekStartsOn = options?.weekStartsOn ?? 0; // Default to Sunday
  const diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const App: React.FC = () => {
  const [view, setView] = useState<'current' | 'history' | 'discovery' | 'plans'>('current');
  const [entries, setEntries] = useState<WorkoutEntry[]>([]);
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [activeBranch, setActiveBranch] = useState<string>('main');
  const [branches, setBranches] = useState<string[]>(['main']);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [isBranchMenuOpen, setIsBranchMenuOpen] = useState(false);
  const [dashboardWeekOffset, setDashboardWeekOffset] = useState(0);
  const [preselectedLogData, setPreselectedLogData] = useState<{ date?: Date, identity?: IdentityState, editingEntry?: WorkoutEntry } | null>(null);
  
  // PWA Install Logic
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  // Scroll visibility for mobile nav
  const [isNavVisible, setIsNavVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY.current && currentScrollY > 50) {
        setIsNavVisible(false); // Scrolling down - hide
      } else {
        setIsNavVisible(true); // Scrolling up - show
      }
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Load data on mount
  useEffect(() => {
    const savedEntries = localStorage.getItem(STORAGE_KEY);
    const savedPlans = localStorage.getItem(PLANS_STORAGE_KEY);
    const savedBranch = localStorage.getItem(ACTIVE_BRANCH_KEY);
    const savedBranches = localStorage.getItem(BRANCHES_KEY);
    
    if (savedEntries) {
      try {
        setEntries(JSON.parse(savedEntries));
      } catch (e) {
        console.error("Failed to parse saved entries", e);
      }
    }

    if (savedPlans) {
      try {
        setPlans(JSON.parse(savedPlans));
      } catch (e) {
        console.error("Failed to parse saved plans", e);
      }
    }

    if (savedBranch) setActiveBranch(savedBranch);
    if (savedBranches) setBranches(JSON.parse(savedBranches));
  }, []);

  // Save data on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }, [entries]);

  useEffect(() => {
    localStorage.setItem(PLANS_STORAGE_KEY, JSON.stringify(plans));
  }, [plans]);

  useEffect(() => {
    localStorage.setItem(ACTIVE_BRANCH_KEY, activeBranch);
  }, [activeBranch]);

  useEffect(() => {
    localStorage.setItem(BRANCHES_KEY, JSON.stringify(branches));
  }, [branches]);

  // Derived data: Filter entries by active branch
  const filteredEntries = entries.filter(e => e.branch === activeBranch);

  const addOrUpdateEntry = (entryData: Omit<WorkoutEntry, 'id' | 'branch'>, id?: string) => {
    if (id) {
      // Update existing (preserve branch)
      setEntries(prev => prev.map(e => e.id === id ? { ...entryData, id, branch: e.branch } : e));
    } else {
      // Add new to active branch
      const newEntry: WorkoutEntry = {
        ...entryData,
        id: crypto.randomUUID(),
        branch: activeBranch
      };
      setEntries(prev => [...prev, newEntry]);
    }
    setIsLogModalOpen(false);
    setPreselectedLogData(null);
  };

  const deleteEntry = (id: string) => {
    if (window.confirm('Confirm Deletion: Identity persistence is integrity. Proceed?')) {
      setEntries(prev => prev.filter(e => e.id !== id));
    }
  };

  const handleUpdatePlans = (newPlans: WorkoutPlan[]) => {
    setPlans(newPlans);
  };

  const createNewBranch = () => {
    const name = prompt("Enter Branch Identifier (e.g. rehab-v1, hypertrophy-peak):");
    if (name && !branches.includes(name)) {
      setBranches(prev => [...prev, name]);
      setActiveBranch(name);
      setIsBranchMenuOpen(false);
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

  const dashboardWeekStart = startOfWeek(addWeeks(new Date(), dashboardWeekOffset), { weekStartsOn: 0 });

  const todayHasEntry = filteredEntries.some(e => isSameDay(new Date(e.timestamp), new Date()));
  const todayEntry = filteredEntries.find(e => isSameDay(new Date(e.timestamp), new Date()));

  const NavItems = () => (
    <>
      <button 
        onClick={() => setView('current')}
        title="Dashboard"
        className={`px-4 sm:px-6 py-2 rounded-lg flex items-center justify-center transition-all ${view === 'current' ? 'bg-neutral-100 text-black shadow-lg scale-[1.02]' : 'hover:bg-neutral-800 text-neutral-400'}`}
      >
        <LayoutDashboard size={22} />
      </button>
      <button 
        onClick={() => setView('plans')}
        title="Blueprints"
        className={`px-4 sm:px-6 py-2 rounded-lg flex items-center justify-center transition-all ${view === 'plans' ? 'bg-neutral-100 text-black shadow-lg scale-[1.02]' : 'hover:bg-neutral-800 text-neutral-400'}`}
      >
        <BookOpen size={22} />
      </button>
      <button 
        onClick={() => setView('history')}
        title="Archive"
        className={`px-4 sm:px-6 py-2 rounded-lg flex items-center justify-center transition-all ${view === 'history' ? 'bg-neutral-100 text-black shadow-lg scale-[1.02]' : 'hover:bg-neutral-800 text-neutral-400'}`}
      >
        <HistoryIcon size={22} />
      </button>
      <button 
        onClick={() => setView('discovery')}
        title="Discovery"
        className={`px-4 sm:px-6 py-2 rounded-lg flex items-center justify-center transition-all ${view === 'discovery' ? 'bg-neutral-100 text-black shadow-lg scale-[1.02]' : 'hover:bg-neutral-800 text-neutral-400'}`}
      >
        <BrainCircuit size={22} />
      </button>
    </>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-neutral-200 flex flex-col font-sans pb-20 sm:pb-0">
      {/* Header */}
      <header className="border-b border-neutral-800 p-4 sticky top-0 bg-[#0a0a0a]/80 backdrop-blur-md z-30">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4 sm:gap-0">
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
            <div className="flex items-center gap-3">
              <AxiomLogo className="w-9 h-9 sm:w-8 sm:h-8" />
              <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-2">
                <h1 className="text-xl sm:text-lg font-mono font-bold tracking-tight uppercase leading-none">Axiom v1.6</h1>
                <span className="text-[10px] text-neutral-500 font-mono hidden sm:inline uppercase">Personal Intelligence OS</span>
              </div>
            </div>

            {/* Branch Switcher Header Element */}
            <div className="relative">
              <button 
                onClick={() => setIsBranchMenuOpen(!isBranchMenuOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-neutral-900/50 border border-neutral-800 rounded-lg hover:border-neutral-700 transition-colors group"
              >
                <GitBranch size={14} className="text-violet-500" />
                <span className="text-[11px] font-mono text-neutral-300 uppercase tracking-tighter">
                  [ BR: <span className="text-white font-bold">{activeBranch}</span> ]
                </span>
                <ChevronDown size={12} className={`text-neutral-500 transition-transform ${isBranchMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isBranchMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsBranchMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-56 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl z-50 p-2 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-3 py-2 text-[10px] font-mono text-neutral-500 uppercase tracking-widest border-b border-neutral-800 mb-2">
                      Timeline Branches
                    </div>
                    <div className="max-h-64 overflow-y-auto space-y-1">
                      {branches.map(b => (
                        <button
                          key={b}
                          onClick={() => { setActiveBranch(b); setIsBranchMenuOpen(false); }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs font-mono transition-colors flex items-center justify-between
                            ${activeBranch === b ? 'bg-violet-600 text-white' : 'hover:bg-neutral-800 text-neutral-400'}
                          `}
                        >
                          <span>{b}</span>
                          {activeBranch === b && <Zap size={10} />}
                        </button>
                      ))}
                    </div>
                    <button 
                      onClick={createNewBranch}
                      className="w-full mt-2 flex items-center gap-2 px-3 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-[10px] font-mono uppercase font-bold transition-all"
                    >
                      <GitFork size={12} />
                      Initialize New Branch
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden sm:flex items-center gap-2 bg-neutral-900 p-1.5 rounded-xl border border-neutral-800">
            <NavItems />
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 space-y-8">
        {view === 'current' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-stretch">
              <div className="lg:col-span-3 h-full">
                <WeeklyGrid 
                  entries={filteredEntries} 
                  plans={plans}
                  onEntryClick={handleEditEntry} 
                  onCellClick={handleCellClick}
                  weekStart={dashboardWeekStart}
                />
              </div>
              
              <div className="hidden lg:block h-full">
                 <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 h-full flex flex-col">
                    <h3 className="text-xs font-mono text-neutral-500 uppercase tracking-widest mb-4">Identity Matrix</h3>
                    <div className="space-y-4 mb-6">
                      {Object.entries(IDENTITY_METADATA).map(([key, meta]) => (
                        <div key={key} className="flex gap-3">
                          <div className={`w-3 h-3 rounded-full mt-1 shrink-0 ${meta.color}`} />
                          <div>
                            <div className="text-sm font-bold">{meta.label}</div>
                            <div className="text-[10px] text-neutral-500 leading-tight">{meta.description}</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-auto">
                      {deferredPrompt && (
                        <div className="mb-6 pt-4 border-t border-neutral-800">
                          <h3 className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-3">System Access</h3>
                          <button 
                            onClick={handleInstallClick}
                            className="w-full flex items-center justify-center gap-2 py-2.5 bg-neutral-100 hover:bg-white text-black text-xs font-bold rounded-lg transition-all active:scale-95"
                          >
                            <Download size={14} />
                            Install Axiom
                          </button>
                        </div>
                      )}

                      <div className="pt-4 border-t border-neutral-800 mb-6">
                        <h3 className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-2">Timeline</h3>
                        <div className="text-[11px] font-mono text-neutral-400 bg-black/40 px-3 py-2 rounded border border-neutral-800 flex items-center gap-2">
                          <Calendar size={12} className="text-neutral-600" />
                          {format(dashboardWeekStart, 'MMM dd')} — {format(addDays(dashboardWeekStart, 7), 'MMM dd')}
                        </div>
                      </div>

                      <h3 className="text-xs font-mono text-neutral-500 uppercase tracking-widest mb-3">Temporal Navigation</h3>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setDashboardWeekOffset(prev => prev - 1)}
                          className="flex-1 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 p-2 rounded flex justify-center text-neutral-400 transition-colors"
                          title="Previous Week"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <button 
                          onClick={() => setDashboardWeekOffset(0)}
                          className="bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 p-2 rounded flex justify-center text-neutral-400 transition-colors"
                          title="Reset to Current"
                        >
                          <RotateCcw size={16} />
                        </button>
                        <button 
                          onClick={() => setDashboardWeekOffset(prev => prev + 1)}
                          className="flex-1 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 p-2 rounded flex justify-center text-neutral-400 transition-colors"
                          title="Next Week"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                 </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatusPanel entries={filteredEntries} onAction={() => setIsLogModalOpen(true)} />
              <PointsCard entries={filteredEntries} weekStart={dashboardWeekStart} />
              <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-mono text-neutral-500 uppercase tracking-widest mb-2">System Rules</h3>
                  <ul className="text-xs space-y-3 text-neutral-400">
                    <li className="flex gap-2">
                      <ShieldAlert size={14} className="text-rose-500 shrink-0" />
                      <span>Continuity locked to 1 entry per day to ensure high-fidelity mapping.</span>
                    </li>
                    <li className="flex gap-2">
                      <Zap size={14} className="text-violet-500 shrink-0" />
                      <span>Branch: <span className="text-violet-400 font-bold uppercase">{activeBranch}</span> is currently active.</span>
                    </li>
                  </ul>
                </div>
                <button 
                  onClick={() => todayHasEntry ? handleEditEntry(todayEntry!.id) : setIsLogModalOpen(true)}
                  className="mt-6 w-full py-3 bg-neutral-100 hover:bg-white text-black font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {todayHasEntry ? <Edit3 size={20} /> : <Plus size={20} />}
                  <span>{todayHasEntry ? 'Modify Today\'s Identity' : 'Log Training Session'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {view === 'plans' && (
          <PlanBuilder plans={plans} onUpdatePlans={handleUpdatePlans} />
        )}

        {view === 'history' && (
          <History entries={filteredEntries} plans={plans} onEditEntry={handleEditEntry} />
        )}

        {view === 'discovery' && (
          <DiscoveryPanel entries={filteredEntries} />
        )}
      </main>

      {/* Mobile Navigation Bar */}
      <nav 
        className={`sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-xl border-t border-neutral-800 px-6 py-4 flex justify-between items-center transition-transform duration-300 ease-in-out ${isNavVisible ? 'translate-y-0' : 'translate-y-full'}`}
      >
        <NavItems />
      </nav>

      {/* Modals */}
      {isLogModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
            onClick={handleCloseModal}
          />
          <div className="relative bg-[#0d0d0d] border border-neutral-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
            <LogAction 
              entries={filteredEntries} 
              plans={plans}
              onSave={addOrUpdateEntry} 
              onDelete={deleteEntry}
              onCancel={handleCloseModal} 
              initialDate={preselectedLogData?.date}
              initialIdentity={preselectedLogData?.identity}
              editingEntry={preselectedLogData?.editingEntry}
            />
          </div>
        </div>
      )}

      {/* Footer / Status Bar */}
      <footer className="hidden sm:flex border-t border-neutral-800 p-2 text-[10px] font-mono text-neutral-600 justify-between bg-black">
        <div className="flex gap-4">
          <span>&copy; 2024 Axiom Dashboard</span>
          <a 
            href="https://github.com/4kiu/axiom" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-neutral-400 hover:text-white transition-colors"
          >
            <Github size={12} />
            Source Access
          </a>
          <span className="text-violet-500 uppercase">Branch: {activeBranch}</span>
        </div>
        <div className="flex gap-4">
          <span>IDENTITY_STABLE: OK</span>
          <span>SYSTEM_VERSION: ALPHA_MIGRATED</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
