/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { generateQuizzes } from "./services/geminiService";
import { QuizQuestion, UnderstandingLevel, UserProgress, QuestionType, UserProfile, UserStatus } from "./types";
import QuizCard from "./components/QuizCard";
import Buddy from "./components/Buddy";
import Navigation from "./components/Navigation";
import FriendsList from "./components/FriendsList";
import { Trophy, Flame, Coins, RefreshCw, BookOpen, Star, TrendingUp, Calendar, ArrowRight, User as UserIcon, ShoppingBag, Gift, Ticket, LogIn, LogOut, Camera, Save, X } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "./lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { loginWithGoogle, logout, updateUserStatus, updateUserProfile } from "./services/firebaseService";

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhoto, setEditPhoto] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [activeTab, setActiveTab] = useState("home");
  const [quizzes, setQuizzes] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isQuizActive, setIsQuizActive] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [progress, setProgress] = useState<UserProgress>({
    userId: "demo-user",
    topicMastery: {},
    totalCredits: 350, // Initial credits for demo
    dailyStreak: 3,
    lastActive: Date.now(),
    achievements: ["첫 걸음", "성실한 학습자"]
  });

  const [topic, setTopic] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<QuestionType[]>([
    QuestionType.MULTIPLE_CHOICE,
    QuestionType.SUBJECTIVE
  ]);

  useEffect(() => {
    const saved = localStorage.getItem("quizbuddy_v2_progress");
    if (saved) setProgress(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem("quizbuddy_v2_progress", JSON.stringify(progress));
  }, [progress]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Listen to profile updates
        const profileUnsub = onSnapshot(doc(db, "users", user.uid), (snap) => {
          if (snap.exists()) {
            setCurrentUser(snap.data() as UserProfile);
            // Update status to RESTING when they come online
            updateUserStatus(user.uid, UserStatus.RESTING);
          }
          setLoadingUser(false);
        });
        return () => profileUnsub();
      } else {
        setCurrentUser(null);
        setLoadingUser(false);
      }
    });
    return () => unsub();
  }, []);

  const startQuiz = async (selectedTopic: string) => {
    if (selectedTypes.length === 0) {
      alert("최소 한 개의 문제 유형을 선택해주세요!");
      return;
    }
    setLoading(true);
    if (currentUser) {
      updateUserStatus(currentUser.uid, UserStatus.LEARNING);
    }
    const newQuizzes = await generateQuizzes(selectedTopic || "상식", 5, selectedTypes);
    if (newQuizzes && newQuizzes.length > 0) {
      setQuizzes(newQuizzes);
      setCurrentIndex(0);
      setIsQuizActive(true);
    } else {
      alert("퀴즈를 생성하지 못했습니다. 다시 시도해 주세요.");
    }
    setLoading(false);
  };

  const handleQuizComplete = (level: UnderstandingLevel, isCorrect: boolean) => {
    const currentQuestion = quizzes[currentIndex];
    
    // Simple Reward System
    let multiplier = 5;
    if (isCorrect) {
      if (level === UnderstandingLevel.PERFECT) multiplier = 30;
      else if (level === UnderstandingLevel.NOT_SURE) multiplier = 20;
      else multiplier = 10;
    }

    const updatedMastery = { ...progress.topicMastery };
    updatedMastery[currentQuestion.topic] = {
      level,
      lastReviewed: Date.now(),
      points: (updatedMastery[currentQuestion.topic]?.points || 0) + multiplier
    };

    setProgress(prev => ({
      ...prev,
      totalCredits: prev.totalCredits + multiplier,
      topicMastery: updatedMastery
    }));

    if (currentIndex < quizzes.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setIsSummarizing(true);
      setIsQuizActive(false);
      if (currentUser) {
        updateUserStatus(currentUser.uid, UserStatus.RESTING);
      }
    }
  };

  if (loadingUser) {
    return (
      <div className="min-h-screen bg-[#FFF9F5] flex items-center justify-center">
        <RefreshCw className="w-10 h-10 text-pink-300 animate-spin" />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#FFF9F5] flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-10 rounded-[3rem] shadow-2xl border-b-8 border-pink-100 text-center space-y-8 max-w-sm"
        >
          <div className="w-24 h-24 bg-pink-500 rounded-3xl flex items-center justify-center shadow-xl mx-auto">
            <h1 className="text-4xl font-black text-white italic">Q</h1>
          </div>
          <div>
            <h1 className="text-3xl font-black text-gray-800">QuizBuddy</h1>
            <p className="text-gray-400 font-bold mt-2">친구와 함께하는 즐거운 학습 생활!</p>
          </div>
          <Buddy mood="cheering" disabled={true} />
          <button 
            onClick={loginWithGoogle}
            className="w-full py-5 bg-gray-900 text-white rounded-2xl font-black text-lg flex items-center justify-center gap-3 active:scale-95 transition-all shadow-xl"
          >
            <LogIn className="w-6 h-6" />
            구글로 시작하기
          </button>
        </motion.div>
      </div>
    );
  }

  const handleUpdateProfile = async () => {
    if (!currentUser) return;
    // Optimistic update for UI feel
    const oldName = currentUser.displayName;
    const oldPhoto = currentUser.photoURL;

    setIsEditingProfile(false);
    
    try {
      await updateUserProfile(currentUser.uid, {
        displayName: editName,
        photoURL: editPhoto
      });
    } catch (error) {
      alert("업데이트 중 오류가 발생했습니다.");
      // Rollback if needed (though onSnapshot will eventually sync the real state)
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 70000) {
      alert("파일 크기가 너무 큽니다. 70KB 이하의 이미지를 선택해주세요!");
      return;
    }

    setUploadingPhoto(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      setEditPhoto(reader.result as string);
      setUploadingPhoto(false);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="min-h-screen bg-[#FFF9F5] font-sans text-gray-900 pb-24 md:max-w-md md:mx-auto md:shadow-2xl md:min-h-[800px] relative overflow-hidden" id="app-root">
      {/* Header - App Style */}
      {!isQuizActive && (
        <header className="p-6 flex items-center justify-between sticky top-0 bg-[#FFF9F5]/80 backdrop-blur-md z-10">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-pink-500 rounded-2xl flex items-center justify-center shadow-lg shadow-pink-100 italic font-black text-white text-xl">Q</div>
            <h1 className="text-lg font-black text-gray-800">QuizBuddy</h1>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 px-3 py-1.5 bg-white rounded-full shadow-sm border border-pink-50">
              <Coins className="w-4 h-4 text-yellow-500" />
              <span className="text-xs font-black text-gray-700">{progress.totalCredits}</span>
            </div>
            <div className="w-10 h-10 bg-white border-2 border-pink-100 rounded-full flex items-center justify-center overflow-hidden">
               {currentUser.photoURL ? (
                 <img src={currentUser.photoURL} alt={currentUser.displayName} className="w-full h-full object-cover" />
               ) : (
                 <UserIcon className="w-6 h-6 text-pink-300" />
               )}
            </div>
          </div>
        </header>
      )}

      <main className="px-6 py-4">
        <AnimatePresence mode="wait">
          {/* QUIZ VIEW */}
          {isQuizActive && quizzes.length > 0 && (
            <motion.div
              key="quiz"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-6 pt-4"
            >
              <div className="flex items-center justify-between">
                <button onClick={() => setIsQuizActive(false)} className="p-2 bg-gray-100 rounded-full">
                   <RefreshCw className="w-4 h-4 text-gray-400" />
                </button>
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-1">Question</span>
                  <span className="text-sm font-black text-gray-800">{currentIndex + 1} / {quizzes.length}</span>
                </div>
                <div className="p-2 border-2 border-pink-100 rounded-2xl">
                  <Buddy mood="thinking" />
                </div>
              </div>

              <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${((currentIndex + 1) / quizzes.length) * 100}%` }}
                  className="h-full bg-pink-500"
                />
              </div>

              <div key={quizzes[currentIndex]?.id || 'loading'}>
                <QuizCard 
                  question={quizzes[currentIndex]}
                  onComplete={handleQuizComplete}
                />
              </div>
            </motion.div>
          )}

          {/* SUMMARY VIEW */}
          {isSummarizing && (
            <motion.div
              key="summary"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-10"
            >
              <Buddy mood="cheering" />
              <Trophy className="w-20 h-20 text-yellow-400 mx-auto mt-6 mb-4" />
              <h2 className="text-3xl font-black text-gray-800">멋진 도전이었어요!</h2>
              <p className="text-gray-500 font-bold mb-8">새로운 지식을 {quizzes.length}개나 얻었습니다.</p>

              <div className="bg-white rounded-3xl p-6 shadow-xl border-4 border-pink-50 mb-8 max-w-sm mx-auto">
                <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-100">
                  <span className="text-gray-400 font-black text-[10px] uppercase">Reward Received</span>
                  <div className="flex items-center gap-1">
                    <Coins className="w-5 h-5 text-yellow-500" />
                    <span className="text-xl font-black text-yellow-600">+120</span>
                  </div>
                </div>
                
                <div className="space-y-4">
                  {quizzes.slice(0, 3).map((q, i) => (
                    <div key={i} className="flex items-center gap-3 text-left">
                       <div className="w-2 h-2 bg-pink-300 rounded-full" />
                       <p className="text-xs font-bold text-gray-600 line-clamp-1">{q.question}</p>
                    </div>
                  ))}
                </div>
              </div>

              <button 
                onClick={() => { setIsSummarizing(false); setActiveTab("home"); }}
                className="w-full py-5 bg-gray-900 text-white rounded-2xl font-black text-xl shadow-xl active:scale-95 transition-all"
              >
                완료하고 돌아가기
              </button>
            </motion.div>
          )}

          {/* DASHBOARD (HOME) */}
          {!isQuizActive && !isSummarizing && activeTab === "home" && (
            <motion.div
              key="home"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8"
            >
              {/* Daily Streak Card */}
              <div className="bg-gradient-to-br from-pink-500 to-rose-400 rounded-3xl p-6 text-white shadow-xl shadow-pink-100 relative overflow-hidden">
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-1">
                    <Flame className="w-5 h-5 text-orange-200 fill-orange-200" />
                    <span className="text-xs font-black uppercase tracking-widest opacity-80">Daily Streak</span>
                  </div>
                  <h3 className="text-3xl font-black mb-4">{progress.dailyStreak}일째 열공 중!</h3>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5, 6, 7].map(day => (
                      <div key={day} className={`w-full aspect-square rounded-lg flex items-center justify-center font-black text-[10px] ${day <= progress.dailyStreak ? 'bg-white text-pink-500' : 'bg-white/20 text-white/50'}`}>
                        {day}
                      </div>
                    ))}
                  </div>
                </div>
                <Buddy mood="cheering" disabled={true} />
                <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white/10 rounded-full blur-xl" />
              </div>

              {/* Primary Call to Action */}
              <button 
                onClick={() => startQuiz("상식")}
                disabled={loading}
                className="w-full py-6 bg-white rounded-[2rem] shadow-xl shadow-pink-100 border-b-4 border-pink-200 flex items-center justify-between px-8 group active:translate-y-1 active:border-b-0 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-pink-500 rounded-2xl flex items-center justify-center shadow-lg group-hover:rotate-12 transition-transform">
                    <BookOpen className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-left">
                    <h4 className="text-xl font-black text-gray-800">오늘의 학습 시작!</h4>
                    <p className="text-xs font-bold text-pink-400">퀴즈를 풀고 포인트를 모아요</p>
                  </div>
                </div>
                <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center group-hover:translate-x-1 transition-transform">
                  <ArrowRight className="w-5 h-5 text-gray-400" />
                </div>
              </button>

              {/* Friends Feature */}
              <FriendsList currentUser={currentUser} />

              {/* Quick Action */}
              <div className="bg-white rounded-3xl p-6 shadow-sm border-2 border-pink-50">
                <h4 className="text-sm font-black text-gray-800 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-pink-400" /> 추천 학습 분야
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {["한국사", "수학 기초", "우주 과학", "생활 상식"].map(t => (
                    <button 
                      key={t}
                      onClick={() => { setTopic(t); startQuiz(t); }}
                      className="p-4 bg-pink-50 rounded-2xl text-left hover:bg-pink-100 transition-colors group"
                    >
                      <p className="text-xs font-black text-pink-500 uppercase tracking-tighter mb-1">Explore</p>
                      <p className="font-bold text-gray-800 text-sm">{t}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Progress Tracker */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                   <h4 className="text-sm font-black text-gray-400 uppercase tracking-widest">My Progress</h4>
                   <button className="text-[10px] font-black text-pink-500 uppercase">View All</button>
                </div>
                <div className="space-y-3">
                  {Object.entries(progress.topicMastery).length > 0 ? (
                    Object.entries(progress.topicMastery).map(([t, data]: [string, any]) => (
                      <div key={t} className="bg-white px-5 py-4 rounded-2xl flex items-center gap-4 shadow-sm border border-gray-50">
                        <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center">
                          <Star className={`w-5 h-5 ${data.level === 3 ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`} />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-gray-800">{t}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="h-1.5 flex-1 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-pink-400" style={{ width: `${Math.min(100, (data.points || 0) * 2)}%` }} />
                            </div>
                            <span className="text-[10px] font-black text-gray-300">{data.points || 0} pts</span>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-gray-200" />
                      </div>
                    ))
                  ) : (
                    <div className="py-10 text-center bg-white rounded-3xl border-2 border-dashed border-gray-100">
                       <p className="text-sm font-bold text-gray-300">아직 학습 기록이 없어요.</p>
                       <p className="text-[10px] font-black text-pink-400 uppercase mt-1">Start your first quiz!</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* LEARN SCREEN */}
          {!isQuizActive && !isSummarizing && activeTab === "learn" && (
            <motion.div
              key="learn"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <h2 className="text-2xl font-black text-gray-800">무엇이든 물어보세요!</h2>
              <p className="text-gray-500 font-medium text-sm">관심 있는 주제를 입력하면 AI가 맞춤형 퀴즈를 만들어줍니다.</p>
              
              <div className="space-y-4">
                <input 
                  type="text" 
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="예: 독도 이야기, 분수의 계산, 공룡"
                  className="w-full px-6 py-5 bg-white rounded-3xl shadow-sm border-2 border-pink-50 focus:border-pink-300 outline-none transition-all font-bold text-lg"
                />

                <div className="bg-white rounded-3xl p-6 border-2 border-pink-50">
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Quiz Settings (문제 유형)</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: QuestionType.MULTIPLE_CHOICE, label: "객관식", icon: "🔢" },
                      { id: QuestionType.SUBJECTIVE, label: "단답형", icon: "📝" },
                      { id: QuestionType.FILL_IN_THE_BLANKS, label: "빈칸 채우기", icon: "🕳️" },
                      { id: QuestionType.ESSAY, label: "에세이", icon: "✍️" },
                    ].map((type) => {
                      const isSelected = selectedTypes.includes(type.id);
                      return (
                        <button
                          key={type.id}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedTypes(prev => prev.filter(t => t !== type.id));
                            } else {
                              setSelectedTypes(prev => [...prev, type.id]);
                            }
                          }}
                          className={`flex items-center gap-2 p-3 rounded-2xl border-2 transition-all ${
                            isSelected ? 'bg-pink-50 border-pink-300' : 'bg-gray-50 border-gray-100'
                          }`}
                        >
                          <span className="text-lg">{type.icon}</span>
                          <span className={`text-[10px] font-black ${isSelected ? 'text-pink-600' : 'text-gray-400'}`}>
                            {type.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                
                <button 
                  onClick={() => startQuiz(topic)}
                  disabled={loading}
                  className="w-full py-5 bg-pink-500 text-white rounded-3xl font-black text-xl shadow-xl shadow-pink-100 flex items-center justify-center gap-3"
                >
                  {loading ? <RefreshCw className="w-6 h-6 animate-spin" /> : <BookOpen className="w-6 h-6" />}
                  {loading ? "퀴즈 제작 중..." : "퀴즈 만들기"}
                </button>
              </div>

              <div className="pt-8">
                 <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Popular Topics</h4>
                 <div className="flex flex-wrap gap-2">
                    {["환경 보호", "AI 기술", "세계 지리", "영단어"].map(t => (
                      <button 
                        key={t}
                        onClick={() => { setTopic(t); startQuiz(t); }}
                        className="px-4 py-2 bg-white rounded-full border border-pink-100 text-sm font-bold text-pink-500 shadow-sm"
                      >
                        # {t}
                      </button>
                    ))}
                 </div>
              </div>
            </motion.div>
          )}

          {/* SHOP SCREEN */}
          {!isQuizActive && !isSummarizing && activeTab === "shop" && (
             <motion.div
               key="shop"
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               className="space-y-6 text-center py-6"
             >
               <div className="w-16 h-16 bg-yellow-100 rounded-3xl flex items-center justify-center mx-auto mb-2 animate-bounce">
                  <ShoppingBag className="w-8 h-8 text-yellow-500" />
               </div>
               <h2 className="text-xl font-black text-gray-800">퀴즈버디 상점</h2>
               
               <div className="space-y-8 text-left">
                 {/* DIGITAL ITEMS */}
                 <section>
                   <h4 className="px-2 text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Digital Items</h4>
                   <div className="grid grid-cols-2 gap-3">
                      {[
                        { name: "황금 버디", cost: 1000, color: "bg-yellow-400" },
                        { name: "우주 배경", cost: 2500, color: "bg-indigo-900" },
                      ].map(item => (
                        <div key={item.name} className="bg-white p-4 rounded-3xl border-2 border-gray-50 flex flex-col items-center">
                           <div className={`w-12 h-12 ${item.color} rounded-2xl mb-2 shadow-md`} />
                           <p className="font-bold text-gray-800 text-xs mb-1">{item.name}</p>
                           <div className="flex items-center gap-1">
                              <Coins className="w-3 h-3 text-yellow-500" />
                              <span className="text-[10px] font-black text-gray-400">{item.cost}</span>
                           </div>
                           <button className="mt-2 w-full py-2 bg-gray-100 rounded-xl text-[10px] font-black text-gray-500 uppercase">Buy</button>
                        </div>
                      ))}
                   </div>
                 </section>

                 {/* GIFTICONS */}
                 <section>
                   <div className="flex items-center gap-2 px-2 mb-3">
                     <Gift className="w-4 h-4 text-pink-500" />
                     <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Real Rewards (Gifticons)</h4>
                   </div>
                   <div className="grid grid-cols-1 gap-3">
                      {[
                        { name: "CU 3,000원 모바일 금액권", cost: 3000, brand: "CU", img: "🏪" },
                        { name: "배스킨라빈스 싱글레귤러", cost: 3900, brand: "Baskin Robbins", img: "🍦" },
                        { name: "빙그레 바나나맛우유", cost: 1700, brand: "GS25", img: "🥛" },
                      ].map(item => (
                        <div key={item.name} className="bg-white p-4 rounded-3xl border-2 border-pink-50 flex items-center gap-4 shadow-sm">
                           <div className="w-14 h-14 bg-pink-50 rounded-2xl flex items-center justify-center text-2xl">
                             {item.img}
                           </div>
                           <div className="flex-1">
                              <p className="text-[10px] font-black text-pink-400 uppercase tracking-tighter">{item.brand}</p>
                              <p className="font-bold text-gray-800 text-sm">{item.name}</p>
                              <div className="flex items-center gap-1 mt-1">
                                 <Coins className="w-3 h-3 text-yellow-500" />
                                 <span className="text-xs font-black text-gray-400">{item.cost.toLocaleString()}</span>
                              </div>
                           </div>
                           <button className="px-4 py-2 bg-pink-500 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-pink-100">Exchange</button>
                        </div>
                      ))}
                   </div>
                 </section>
               </div>
             </motion.div>
          )}

          {/* PROFILE SCREEN */}
          {!isQuizActive && !isSummarizing && activeTab === "profile" && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <div className="text-center py-6">
                <div className="w-24 h-24 bg-white border-4 border-pink-100 rounded-full flex items-center justify-center mx-auto mb-4 relative overflow-hidden group">
                   {isEditingProfile ? (
                     <label className="w-full h-full relative cursor-pointer block">
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={handleFileChange}
                        />
                        <img src={editPhoto || currentUser.photoURL} alt="" className="w-full h-full object-cover opacity-50" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                          {uploadingPhoto ? (
                            <RefreshCw className="w-8 h-8 text-white animate-spin" />
                          ) : (
                            <Camera className="w-8 h-8 text-white drop-shadow-md" />
                          )}
                        </div>
                     </label>
                   ) : (
                     currentUser.photoURL ? (
                       <img src={currentUser.photoURL} alt={currentUser.displayName} className="w-full h-full object-cover" />
                     ) : (
                       <UserIcon className="w-12 h-12 text-pink-300" />
                     )
                   )}
                   <div className="absolute bottom-0 right-0 w-8 h-8 bg-pink-500 rounded-full border-4 border-[#FFF9F5] flex items-center justify-center">
                      <Flame className="w-4 h-4 text-white" />
                   </div>
                </div>

                {isEditingProfile ? (
                  <div className="space-y-4 max-w-xs mx-auto">
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase text-left block ml-2 mb-1">Nickname</label>
                      <input 
                        type="text" 
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-4 py-2 bg-white rounded-xl border-2 border-pink-100 focus:border-pink-500 outline-none font-bold"
                        placeholder="이름을 입력하세요"
                      />
                    </div>
                    <div className="flex gap-2">
                       <button 
                         onClick={handleUpdateProfile}
                         className="flex-1 py-3 bg-pink-500 text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-pink-100"
                       >
                         <Save className="w-4 h-4" />
                         저장하기
                       </button>
                       <button 
                         onClick={() => setIsEditingProfile(false)}
                         className="px-4 py-3 bg-gray-100 text-gray-400 rounded-xl font-black text-sm"
                       >
                         <X className="w-5 h-5" />
                       </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h2 className="text-2xl font-black text-gray-800">{currentUser.displayName}</h2>
                    <p className="text-sm font-bold text-gray-400">{currentUser.email}</p>
                    <div className="flex items-center justify-center gap-2 mt-4">
                      <button 
                        onClick={() => {
                          setEditName(currentUser.displayName);
                          setEditPhoto(currentUser.photoURL);
                          setIsEditingProfile(true);
                        }}
                        className="px-4 py-2 bg-pink-50 rounded-xl text-xs font-black text-pink-500 hover:bg-pink-100 transition-colors"
                      >
                        프로필 수정
                      </button>
                      <button 
                        onClick={logout}
                        className="px-4 py-2 bg-gray-100 rounded-xl text-xs font-black text-gray-400 flex items-center gap-2"
                      >
                        <LogOut className="w-3 h-3" />
                        로그아웃
                      </button>
                    </div>
                  </>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-50 text-center">
                    <p className="text-[10px] font-black text-gray-300 uppercase mb-1">Total Points</p>
                    <p className="text-2xl font-black text-gray-800">{progress.totalCredits}</p>
                 </div>
                 <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-50 text-center">
                    <p className="text-[10px] font-black text-gray-300 uppercase mb-1">Achievements</p>
                    <p className="text-2xl font-black text-gray-800">{progress.achievements.length}</p>
                 </div>
              </div>

              <div className="space-y-4">
                 <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                   <Ticket className="w-4 h-4" /> My Coupons
                 </h4>
                 <div className="bg-white p-4 rounded-3xl border-2 border-dashed border-gray-100 text-center py-8">
                    <p className="text-xs font-bold text-gray-300">보유 중인 기프티콘이 없습니다.</p>
                    <p className="text-[10px] font-black text-pink-400 uppercase mt-1">Visit shop to exchange points!</p>
                 </div>
              </div>

              <div className="space-y-4">
                 <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">My Achievements</h4>
                 <div className="flex flex-wrap gap-3">
                    {progress.achievements.map(a => (
                      <div key={a} className="flex flex-col items-center gap-2">
                        <div className="w-16 h-16 bg-pink-50 rounded-2xl flex items-center justify-center border-2 border-pink-100">
                           <Trophy className="w-8 h-8 text-pink-500" />
                        </div>
                        <span className="text-[10px] font-bold text-gray-500">{a}</span>
                      </div>
                    ))}
                    <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center border-2 border-dashed border-gray-200">
                       <span className="text-xl text-gray-200 font-black">?</span>
                    </div>
                 </div>
              </div>

              <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-50">
                 <div className="flex items-center justify-between mb-4">
                    <h4 className="text-xs font-black text-gray-400 uppercase">Weekly Activity</h4>
                    <Calendar className="w-4 h-4 text-gray-300" />
                 </div>
                 <div className="h-20 flex items-end justify-between gap-1">
                    {[3, 5, 2, 8, 4, 3, 6].map((h, i) => (
                      <div key={i} className="flex-1 bg-pink-100 rounded-t-lg relative group" style={{ height: `${h * 10}%` }}>
                         <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[8px] px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                            {h}q
                         </div>
                      </div>
                    ))}
                 </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {!isQuizActive && <Navigation activeTab={activeTab} onTabChange={setActiveTab} />}
      
      {/* Background elements */}
      <div className="fixed top-20 left-10 -z-10 opacity-10 pointer-events-none">
        <div className="w-64 h-64 border-8 border-pink-400 rounded-full" />
      </div>
      <div className="fixed bottom-20 right-10 -z-10 opacity-10 pointer-events-none">
        <div className="w-32 h-32 bg-yellow-400 rounded-3xl rotate-12" />
      </div>
    </div>
  );
}
