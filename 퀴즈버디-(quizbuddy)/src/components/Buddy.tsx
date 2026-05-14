/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from "motion/react";
import { Smile, Frown, Sparkles } from "lucide-react";

interface BuddyProps {
  mood: "happy" | "thinking" | "sad" | "cheering";
  disabled?: boolean;
}

export default function Buddy({ mood, disabled = false }: BuddyProps) {
  const getIcon = () => {
    switch (mood) {
      case "happy": return <Smile className="w-16 h-16 text-yellow-500" />;
      case "thinking": return <Smile className="w-16 h-16 text-blue-400 opacity-50" />;
      case "sad": return <Frown className="w-16 h-16 text-gray-400" />;
      case "cheering": return <Sparkles className="w-16 h-16 text-pink-500" />;
    }
  };

  const getAnimation = () => {
    if (disabled) return {};
    switch (mood) {
      case "happy": return { y: [0, -10, 0], transition: { repeat: Infinity, duration: 2 } };
      case "thinking": return { rotate: [0, 5, -5, 0], transition: { repeat: Infinity, duration: 3 } };
      case "sad": return { x: [0, -3, 3, 0], transition: { repeat: 5, duration: 0.2 } };
      case "cheering": return { scale: [1, 1.2, 1], transition: { repeat: Infinity, duration: 1 } };
    }
  };

  return (
    <motion.div
      animate={getAnimation()}
      className="flex flex-col items-center justify-center p-4 bg-white rounded-full shadow-lg border-4 border-pink-100"
      id="buddy-container"
    >
      {getIcon()}
      <p className="mt-2 text-xs font-bold text-pink-400 uppercase tracking-widest">QuizBuddy</p>
    </motion.div>
  );
}
