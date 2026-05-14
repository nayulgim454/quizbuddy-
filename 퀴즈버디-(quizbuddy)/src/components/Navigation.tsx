/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from "motion/react";
import { Home, BookOpen, ShoppingBag, User } from "lucide-react";

interface NavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function Navigation({ activeTab, onTabChange }: NavigationProps) {
  const tabs = [
    { id: "home", label: "홈", icon: Home },
    { id: "learn", label: "학습", icon: BookOpen },
    { id: "shop", label: "상점", icon: ShoppingBag },
    { id: "profile", label: "프로필", icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-pink-50 px-6 py-3 flex items-center justify-between z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] md:max-w-md md:mx-auto md:rounded-t-3xl" id="app-nav">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className="flex flex-col items-center gap-1 relative"
            id={`nav-tab-${tab.id}`}
          >
            <motion.div
              animate={isActive ? { scale: 1.2, y: -4 } : { scale: 1, y: 0 }}
              className={`p-2 rounded-2xl transition-colors ${isActive ? "bg-pink-500 text-white" : "text-gray-400"}`}
            >
              <Icon className="w-6 h-6" />
            </motion.div>
            <span className={`text-[10px] font-black uppercase tracking-tighter ${isActive ? "text-pink-500" : "text-gray-400"}`}>
              {tab.label}
            </span>
            {isActive && (
              <motion.div
                layoutId="active-dot"
                className="absolute -top-1 right-1 w-2 h-2 bg-pink-300 rounded-full"
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}
