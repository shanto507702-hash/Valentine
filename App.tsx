import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, RotateCcw, Trophy, Star, RefreshCw, Flame, Lock, LogIn, LogOut, ChevronLeft, ChevronRight, User as UserIcon, Download, X } from 'lucide-react';
import { all30Days, motivations21 } from './data';
import { auth, db, googleProvider, signInWithPopup, signOut, doc, setDoc, onSnapshot, handleFirestoreError, OperationType } from './firebase';
import { User } from 'firebase/auth';
import { toPng } from 'html-to-image';

interface AppState {
  currentDay: number; // 1-indexed
  completedTasks: Record<number, boolean[]>; // day -> [task1Done, task2Done]
  startDate: string;
}

const DEFAULT_STATE: AppState = {
  currentDay: 1,
  completedTasks: {},
  startDate: new Date().toISOString(),
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<AppState>(DEFAULT_STATE);
  const [isFlipping, setIsFlipping] = useState(false);
  const [motivationIndex, setMotivationIndex] = useState(0);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const milestoneRef = useRef<HTMLDivElement>(null);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      setUser(u);
      if (!u) {
        setLoading(false);
        const saved = localStorage.getItem('thriving_challenge_state');
        if (saved) setState(JSON.parse(saved));
      }
    });
    return unsubscribe;
  }, []);

  // Firestore Sync
  useEffect(() => {
    if (!user) return;

    setLoading(true);
    const userDocRef = doc(db, 'users', user.uid);
    
    const unsubscribe = onSnapshot(userDocRef, (snapshot) => {
      if (snapshot.exists()) {
        setState(snapshot.data() as AppState);
      } else {
        setDoc(userDocRef, DEFAULT_STATE)
          .catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`));
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  // Local Storage Fallback for guests
  useEffect(() => {
    if (!user) {
      localStorage.setItem('thriving_challenge_state', JSON.stringify(state));
    }
  }, [state, user]);

  const saveStateToFirebase = useCallback(async (newState: AppState) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid), newState);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
    }
  }, [user]);

  const unlockedDay = useMemo(() => {
    const start = new Date(state.startDate);
    start.setHours(0, 0, 0, 0);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    const diffTime = Math.abs(now.getTime() - start.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays + 1;
  }, [state.startDate]);

  const currentTasksDone = state.completedTasks[state.currentDay] || [false, false];
  const allTasksDoneToday = currentTasksDone[0] && currentTasksDone[1];

  const totalTasks = 30 * 2;
  const completedTasksCount = (Object.values(state.completedTasks) as boolean[][]).reduce((acc, tasks) => {
    return acc + tasks.filter(Boolean).length;
  }, 0);

  const progressPercent = Math.round((completedTasksCount / totalTasks) * 100);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error("Login failed", err);
    }
  };

  const handleLogout = () => {
    signOut(auth);
    setIsProfileOpen(false);
  };

  const toggleTask = (taskIndex: number) => {
    const newTasks = [...currentTasksDone];
    newTasks[taskIndex] = !newTasks[taskIndex];

    const newState = {
      ...state,
      completedTasks: {
        ...state.completedTasks,
        [state.currentDay]: newTasks,
      }
    };

    setState(newState);
    saveStateToFirebase(newState);
  };

  const resetDailyProgress = () => {
    const newState = {
      ...state,
      completedTasks: {
        ...state.completedTasks,
        [state.currentDay]: [false, false]
      }
    };
    setState(newState);
    saveStateToFirebase(newState);
  };

  const resetAllProgress = () => {
    if (confirm("আপনি কি নিশ্চিত যে আপনি সকল প্রগ্রেস রিসেট করতে চান? এটি আপনাকে 1ম দিনে ফিরিয়ে নিয়ে যাবে।")) {
      const newState = {
        ...DEFAULT_STATE,
        startDate: new Date().toISOString()
      };
      setState(newState);
      saveStateToFirebase(newState);
    }
  };

  const nextMotivation = () => setMotivationIndex(prev => (prev + 1) % motivations21.length);
  const prevMotivation = () => setMotivationIndex(prev => (prev - 1 + motivations21.length) % motivations21.length);

  const downloadMilestone = async () => {
    if (milestoneRef.current === null) return;
    try {
      const dataUrl = await toPng(milestoneRef.current, { cacheBust: true });
      const link = document.createElement('a');
      link.download = `shoto-spondon-milestone-day-${state.currentDay}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Download failed', err);
    }
  };

  if (loading && user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0f4f8]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#f0f4f8] flex flex-col items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-10 rounded-[40px] shadow-2xl text-center max-w-md w-full"
        >
          <div className="w-20 h-20 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center mb-8 shadow-xl">
             <Star className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-black text-slate-800 mb-4">30 Days Challenge</h1>
          <p className="text-slate-500 mb-8 font-medium">আপনার ৩০ দিনের পরিবর্তনের যাত্রা শুরু করুন। লগইন করে প্রগ্রেস সেভ রাখুন।</p>
          <button 
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg active:scale-95"
          >
            <LogIn className="w-6 h-6" />
            Continue with Google
          </button>
        </motion.div>
      </div>
    );
  }

  const activeDayIndex = state.currentDay - 1;
  const currentDayData = all30Days[activeDayIndex] || all30Days[0];

  return (
    <div className="min-h-screen bg-[#f0f4f8] text-slate-900 font-sans flex flex-col items-center overflow-x-hidden">
      {/* Top Header */}
      <header className="w-full bg-white shadow-sm border-b border-slate-100 p-4 mb-4 md:mb-8 flex justify-center sticky top-0 z-40">
        <div className="w-full max-w-4xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-xl">30</span>
            </div>
            <h1 className="text-xl font-bold text-slate-800 hidden sm:block">Challenge Tracker</h1>
          </div>
          
          <div className="bg-blue-50 border border-blue-100 px-4 py-2 rounded-full flex items-center shadow-sm streak-glow">
            <Flame className="w-4 h-4 text-blue-600 mr-2" />
            <span className="text-blue-600 font-bold mr-2 text-sm">Streak:</span>
            <span className="text-blue-800 font-extrabold text-base">{unlockedDay} Days</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Day</p>
              <p className="text-sm font-black text-slate-600">{state.currentDay}</p>
            </div>
            <button 
              onClick={() => setIsProfileOpen(true)}
              className="w-10 h-10 rounded-full overflow-hidden border-2 border-blue-100 hover:border-blue-500 transition-all shadow-sm"
            >
              {user.photoURL ? (
                <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-400">
                  <UserIcon className="w-5 h-5" />
                </div>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full max-w-6xl px-4 flex flex-col lg:flex-row items-center lg:items-start justify-center gap-6 md:gap-10 pb-20">
        {/* Main Challenge Card */}
        <div className="w-full max-w-md perspective-2000 shrink-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={state.currentDay + (allTasksDoneToday ? "_done" : "_todo")}
              initial={{ rotateY: 70, opacity: 0 }}
              animate={{ rotateY: 0, opacity: 1 }}
              exit={{ rotateY: -70, opacity: 0 }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
              className={`relative w-full min-h-[520px] card-gradient rounded-[40px] shadow-2xl p-8 flex flex-col justify-between overflow-hidden transition-all duration-500`}
              style={{ transformStyle: 'preserve-3d' }}
            >
              {/* Decorative circle */}
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-white opacity-5 rounded-full pointer-events-none"></div>
              
              {!allTasksDoneToday ? (
                <>
                  <div className="z-10 text-center mb-6">
                    <div className="flex justify-center items-center gap-2 mb-2">
                      <Star className="w-4 h-4 text-blue-300" />
                      <span className="text-blue-300 uppercase tracking-[0.2em] font-bold text-xs">GOAL OF THE DAY</span>
                    </div>
                    <h2 className="text-white text-5xl font-black">DAY {state.currentDay}</h2>
                  </div>

                  <div className="space-y-6 z-10 flex-grow py-4">
                    {currentDayData.tasks.map((task, idx) => (
                      <button
                        key={task.id}
                        onClick={() => toggleTask(idx)}
                        className={`w-full group relative flex flex-col items-start gap-2 p-6 rounded-3xl transition-all duration-300 text-left border-2 ${
                          currentTasksDone[idx] 
                            ? 'bg-blue-500/40 border-blue-300 text-white shadow-lg' 
                            : 'glass-effect border-transparent text-white/90 hover:bg-white/10 hover:border-white/20'
                        }`}
                      >
                        <div className={`w-6 h-6 border-2 rounded-lg mb-2 flex items-center justify-center transition-all ${
                          currentTasksDone[idx] 
                            ? 'bg-white border-white' 
                            : 'border-white/30 bg-white/5'
                        }`}>
                          {currentTasksDone[idx] && <CheckCircle2 className="w-4 h-4 text-blue-500" />}
                        </div>
                        <p className="text-lg font-medium leading-relaxed">
                          {task.text}
                        </p>
                      </button>
                    ))}
                  </div>

                  <div className="z-10 flex flex-col items-center gap-4 mt-6">
                    <div className="bg-white/10 px-6 py-2 rounded-full border border-white/20">
                      <span className="text-white/40 text-[10px] uppercase font-black tracking-widest flex items-center gap-2">
                         <Lock className="w-3 h-3" /> Day {state.currentDay} In Progress
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center z-10 space-y-8">
                  <motion.div
                    initial={{ scale: 0, rotate: -45 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", damping: 12, delay: 0.2 }}
                    className="w-28 h-28 bg-white/10 rounded-full flex items-center justify-center border-4 border-blue-400 shadow-2xl"
                  >
                    <CheckCircle2 className="w-14 h-14 text-blue-400" />
                  </motion.div>
                  
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                  >
                    <h3 className="text-white text-3xl font-black mb-4">অভিনন্দন!</h3>
                    <p className="text-blue-100 text-xl font-medium leading-loose">
                      আজকের জন্য এইটুকুই,<br/>আগামী কাল আবার এসো।
                    </p>
                  </motion.div>

                  {state.currentDay < unlockedDay && (
                    <motion.button
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.6 }}
                      onClick={() => {
                        setIsFlipping(true);
                        setTimeout(() => {
                           setState(s => {
                             const ns = { ...s, currentDay: s.currentDay + 1 };
                             saveStateToFirebase(ns);
                             return ns;
                           });
                           setIsFlipping(false);
                        }, 600);
                      }}
                      className="bg-white text-blue-900 px-10 py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-blue-50 transition-all shadow-xl active:scale-95"
                    >
                      Next Day
                    </motion.button>
                  )}
                  
                  <div className="bg-white/10 px-6 py-2 rounded-full border border-white/20">
                    <span className="text-white/60 text-[10px] uppercase font-black tracking-widest">
                       Stay Disciplined, Keep Growing
                    </span>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex-1 w-full max-w-xl space-y-6 md:space-y-8">
          {/* Motivation Slider */}
          <div className="bg-white p-6 md:p-10 rounded-[32px] md:rounded-[40px] shadow-sm border border-slate-100 relative overflow-hidden h-[340px] md:h-[400px] flex flex-col justify-between group">
            <div className="absolute top-0 right-0 p-4">
              <Star className="w-8 h-8 text-blue-50 transition-transform group-hover:rotate-12" />
            </div>
            
            <div className="flex-1 relative mt-4">
              <AnimatePresence mode="wait">
                <motion.div
                  key={motivationIndex}
                  initial={{ opacity: 0, x: 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -40 }}
                  transition={{ type: "spring", damping: 20, stiffness: 100 }}
                  className="flex flex-col h-full"
                >
                  <p className="text-slate-400 text-[10px] uppercase font-black tracking-[0.3em] mb-6 flex items-center gap-2">
                    <span className="w-10 h-[2px] bg-blue-100"></span>
                    Wisdom {motivationIndex + 1}
                  </p>
                  <p className="text-slate-800 text-xl md:text-3xl leading-snug font-medium italic mb-10 overflow-auto">
                    "{motivations21[motivationIndex]}"
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-50">
              <p className="text-blue-600 font-black text-xs uppercase tracking-widest">
                Mindset Matters
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={prevMotivation}
                  className="w-10 h-10 rounded-full hover:bg-blue-50 transition-all text-slate-300 hover:text-blue-600 flex items-center justify-center border border-transparent hover:border-blue-100"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button 
                  onClick={nextMotivation}
                  className="w-10 h-10 rounded-full hover:bg-blue-50 transition-all text-slate-300 hover:text-blue-600 flex items-center justify-center border border-transparent hover:border-blue-100"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Progress Section */}
          <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-50 space-y-6">
            <div className="flex justify-between items-end">
              <div>
                <h3 className="font-black text-slate-800 text-lg">Overall Progress</h3>
                <p className="text-slate-400 text-sm font-medium tracking-tight">Your 30-day transformation</p>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-4xl font-black text-blue-600 tabular-nums leading-none">{progressPercent}%</span>
                <span className="text-[10px] font-bold text-slate-300 uppercase mt-1">Completed</span>
              </div>
            </div>
            
            <div className="w-full h-5 bg-slate-100 rounded-full overflow-hidden p-1 shadow-inner">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                className="h-full bg-blue-600 rounded-full shadow-lg"
              />
            </div>
            <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <span>Day 1</span>
              <span>{completedTasksCount} / {totalTasks} Tasks</span>
              <span>Day 30</span>
            </div>
          </div>

          {/* Reset Controls - Moved smaller and styled cleaner */}
          <div className="flex flex-row gap-4">
            <button 
              onClick={resetDailyProgress}
              className="flex-1 bg-white border border-slate-100 text-slate-400 font-bold py-4 rounded-3xl hover:bg-white hover:text-blue-500 hover:shadow-md transition-all flex items-center justify-center gap-2 text-sm"
            >
              <RotateCcw className="w-4 h-4" />
              Reset Today
            </button>
            <button 
              onClick={resetAllProgress}
              className="flex-1 bg-slate-100 text-slate-400 font-bold py-4 rounded-3xl hover:bg-red-50 hover:text-red-400 transition-all flex items-center justify-center gap-2 text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Reset All
            </button>
          </div>
        </div>
      </main>

      {/* Profile Sidebar/Modal */}
      <AnimatePresence>
        {isProfileOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsProfileOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative bg-white w-full max-w-lg rounded-t-[40px] sm:rounded-[40px] shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-2xl font-black text-slate-800">Your Profile</h3>
                  <button onClick={() => setIsProfileOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                    <X className="w-6 h-6 text-slate-400" />
                  </button>
                </div>

                <div className="flex items-center gap-6 mb-10 pb-10 border-b border-slate-50">
                  <div className="w-20 h-20 rounded-3xl overflow-hidden border-4 border-blue-50 shadow-lg">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                        <UserIcon className="w-8 h-8 text-slate-300" />
                      </div>
                    )}
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-slate-800">{user.displayName || "Warrior"}</h4>
                    <p className="text-slate-400 font-medium">{user.email}</p>
                    <div className="flex items-center gap-2 mt-2">
                       <span className="bg-blue-600 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter shadow-md">
                         Elite Member
                       </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <h5 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Milestone Access</h5>
                    <button 
                      onClick={downloadMilestone}
                      className="w-full bg-blue-600 text-white py-5 rounded-[24px] font-black flex items-center justify-center gap-3 shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all active:scale-[0.98]"
                    >
                      <Download className="w-5 h-5" />
                      Download Milestone Card
                    </button>
                    <p className="text-center text-slate-400 text-xs mt-3">Generate a card for your Day {state.currentDay} progress</p>
                  </div>

                  <button 
                    onClick={handleLogout}
                    className="w-full bg-slate-50 text-slate-500 py-5 rounded-[24px] font-bold flex items-center justify-center gap-3 hover:bg-red-50 hover:text-red-500 transition-all"
                  >
                    <LogOut className="w-5 h-5" />
                    Logout Account
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hidden Milestone Card Template for Download */}
      <div className="fixed -left-[2000px] top-0 pointer-events-none">
        <div 
          ref={milestoneRef}
          className="w-[800px] h-[1000px] card-gradient p-16 flex flex-col justify-between items-center text-center text-white"
        >
          <div className="space-y-4">
             <div className="w-32 h-32 bg-white/10 rounded-3xl mx-auto flex items-center justify-center border-4 border-blue-400">
               <span className="text-white font-black text-6xl italic">30</span>
             </div>
             <p className="text-blue-200 text-xl font-black uppercase tracking-[0.4em]">30 Days Challenge</p>
          </div>

          <div className="space-y-8">
            <h1 className="text-8xl font-black leading-none">DAY {state.currentDay}</h1>
            <div className="h-2 w-40 bg-blue-400 mx-auto rounded-full"></div>
            <p className="text-4xl font-medium italic text-blue-100 max-w-2xl">
              "আমি পারছি এবং আমি শেষ পর্যন্ত করবো।"
            </p>
          </div>

          <div className="w-full space-y-10">
            <div className="flex flex-col items-center gap-4">
              <div className="w-full h-6 bg-white/10 rounded-full overflow-hidden p-1 border-2 border-white/20">
                <div 
                  className="h-full bg-white rounded-full" 
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
              <p className="text-2xl font-black uppercase tracking-widest text-blue-200">
                Overall Progress: {progressPercent}%
              </p>
            </div>
            
            <div className="flex justify-between items-center pt-10 border-t border-white/10">
              <div className="text-left">
                <p className="text-blue-300 font-bold uppercase tracking-widest">User</p>
                <p className="text-2xl font-black uppercase">{user.displayName || "Challenge Warrior"}</p>
              </div>
              <div className="text-right">
                <p className="text-blue-300 font-bold uppercase tracking-widest">Status</p>
                <p className="text-2xl font-black uppercase">Consistently Rising</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="w-full bg-slate-900 py-12 px-4 text-center mt-auto">
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4 text-white" />
          </div>
          <p className="text-white font-black tracking-widest text-lg uppercase">30 Days Challenge</p>
        </div>
        <p className="text-slate-500 text-sm font-medium">
          © 2024 Productivity Hub • Stay Consistent, Stay Humble
        </p>
      </footer>
    </div>
  );
}
