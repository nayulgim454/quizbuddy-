import React, { useState, useEffect } from 'react';
import { UserProfile, UserStatus } from '../types';
import { searchUserByEmail, addFriend, subscribeToFriends } from '../services/firebaseService';
import { UserPlus, Search, User as UserIcon, Loader2, Circle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface FriendsListProps {
  currentUser: UserProfile;
}

export default function FriendsList({ currentUser }: FriendsListProps) {
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [searchEmail, setSearchEmail] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<UserProfile | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToFriends(currentUser.uid, (updatedFriends) => {
      setFriends(updatedFriends);
    });
    return () => unsubscribe && typeof unsubscribe === 'function' ? unsubscribe() : undefined;
  }, [currentUser.uid]);

  const handleSearch = async () => {
    if (!searchEmail) return;
    setSearching(true);
    const result = await searchUserByEmail(searchEmail);
    setSearchResult(result);
    setSearching(false);
  };

  const handleAddFriend = async (friendUid: string) => {
    await addFriend(currentUser.uid, friendUid);
    setSearchResult(null);
    setSearchEmail('');
  };

  const statusColor = (status: UserStatus) => {
    switch (status) {
      case UserStatus.LEARNING: return 'text-green-500 fill-green-500';
      case UserStatus.RESTING: return 'text-yellow-500 fill-yellow-500';
      default: return 'text-gray-300 fill-gray-300';
    }
  };

  const statusLabel = (status: UserStatus) => {
    switch (status) {
      case UserStatus.LEARNING: return '공부 중';
      case UserStatus.RESTING: return '휴식 중';
      default: return '접속 안 함';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-black text-gray-400 uppercase tracking-widest">내 친구들 ({friends.length})</h4>
      </div>

      {/* Friend Search */}
      <div className="relative">
        <input 
          type="email" 
          value={searchEmail}
          onChange={(e) => setSearchEmail(e.target.value)}
          placeholder="친구 이메일로 검색..."
          className="w-full px-5 py-3 bg-white rounded-2xl border-2 border-pink-50 focus:border-pink-300 outline-none text-sm font-bold"
        />
        <button 
          onClick={handleSearch}
          disabled={searching}
          className="absolute right-2 top-2 p-1.5 bg-pink-500 rounded-xl text-white hover:bg-pink-600 transition-colors"
        >
          {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </button>
      </div>

      <AnimatePresence>
        {searchResult && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-white p-4 rounded-2xl border-2 border-pink-100 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden">
                {searchResult.photoURL ? <img src={searchResult.photoURL} alt="" /> : <UserIcon className="w-6 h-6 text-gray-300" />}
              </div>
              <div>
                <p className="text-sm font-black text-gray-800">{searchResult.displayName}</p>
                <p className="text-[10px] font-bold text-gray-400">{searchResult.email}</p>
              </div>
            </div>
            <button 
              onClick={() => handleAddFriend(searchResult.uid)}
              className="p-2 bg-pink-50 rounded-xl text-pink-500 hover:bg-pink-100"
            >
              <UserPlus className="w-5 h-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        {friends.length > 0 ? (
          friends.map((friend) => (
            <div key={friend.uid} className="flex items-center justify-between p-2 bg-white/50 rounded-2xl border border-transparent hover:border-pink-100 hover:bg-white transition-all">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white border-2 border-pink-50 rounded-2xl flex items-center justify-center overflow-hidden relative">
                  {friend.photoURL ? <img src={friend.photoURL} alt="" /> : <UserIcon className="w-7 h-7 text-pink-100" />}
                  <div className="absolute -bottom-1 -right-1">
                    <Circle className={`w-4 h-4 ${statusColor(friend.status)} border-2 border-white rounded-full`} />
                  </div>
                </div>
                <div>
                  <h5 className="text-sm font-black text-gray-800">{friend.displayName}</h5>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">
                      {statusLabel(friend.status)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="px-3 py-1 bg-gray-50 rounded-full">
                <span className="text-[8px] font-black text-gray-300 uppercase">Lv. 5</span>
              </div>
            </div>
          ))
        ) : (
          <div className="py-10 text-center bg-white rounded-3xl border-2 border-dashed border-gray-100">
             <p className="text-sm font-bold text-gray-300">친구가 아직 없어요.</p>
             <p className="text-[10px] font-black text-pink-400 uppercase mt-1">Search friends by email!</p>
          </div>
        )}
      </div>
    </div>
  );
}
