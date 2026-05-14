/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { QuizQuestion, UnderstandingLevel, QuestionType, Difficulty } from "../types";
import { CheckCircle2, XCircle, ChevronRight, HelpCircle, Send, Sparkles } from "lucide-react";
import { evaluateSubjectiveAnswer } from "../services/geminiService";

interface QuizCardProps {
  question: QuizQuestion;
  onComplete: (level: UnderstandingLevel, isCorrect: boolean) => void;
}

export default function QuizCard({ question, onComplete }: QuizCardProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [subjectiveInput, setSubjectiveInput] = useState("");
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<{ isCorrect: boolean; feedback: string; score: number } | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [showSelfAssess, setShowSelfAssess] = useState(false);

  const handleOptionClick = (option: string) => {
    if (showExplanation) return;
    setSelectedOption(option);
    setShowExplanation(true);
  };

  const handleSubmitSubjective = async () => {
    if (!subjectiveInput.trim() || isEvaluating) return;
    setIsEvaluating(true);
    const result = await evaluateSubjectiveAnswer(question.question, question.correctAnswer, subjectiveInput);
    setEvaluation(result);
    setIsEvaluating(false);
    setShowExplanation(true);
  };

  const isCorrect = question.type === QuestionType.MULTIPLE_CHOICE 
    ? selectedOption === question.correctAnswer 
    : evaluation?.isCorrect || false;

  const difficultyColors = {
    [Difficulty.EASY]: "bg-green-100 text-green-600",
    [Difficulty.MEDIUM]: "bg-blue-100 text-blue-600",
    [Difficulty.HARD]: "bg-purple-100 text-purple-600"
  };

  return (
    <div className="w-full max-w-lg mx-auto bg-white rounded-3xl shadow-xl overflow-hidden border-4 border-pink-50" id="quiz-card">
      <div className="p-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-2">
            <span className="px-3 py-1 bg-pink-100 text-pink-500 rounded-full text-[10px] font-black uppercase">
              {question.topic}
            </span>
            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${difficultyColors[question.difficulty]}`}>
              {question.difficulty}
            </span>
          </div>
          {question.type === QuestionType.SUBJECTIVE && (
            <span className="flex items-center gap-1 text-[10px] font-black text-amber-500 uppercase">
              <Sparkles className="w-3 h-3" /> 서술형
            </span>
          )}
        </div>

        <h2 className="text-2xl font-bold text-gray-800 leading-tight mb-8">
          {question.question}
        </h2>

      {question.type === QuestionType.MULTIPLE_CHOICE ? (
          <div className="space-y-3">
            {question.options?.map((option, idx) => {
              const isSelected = selectedOption === option;
              const isCorrectOption = option === question.correctAnswer;
              
              let bgClass = "bg-gray-50 hover:bg-pink-50 border-gray-100";
              let textClass = "text-gray-700";
              let icon = null;

              if (showExplanation) {
                if (isCorrectOption) {
                  bgClass = "bg-green-100 border-green-200";
                  textClass = "text-green-700";
                  icon = <CheckCircle2 className="w-5 h-5 text-green-500" />;
                } else if (isSelected) {
                  bgClass = "bg-red-100 border-red-200";
                  textClass = "text-red-700";
                  icon = <XCircle className="w-5 h-5 text-red-500" />;
                } else {
                  bgClass = "bg-gray-50 border-gray-100 opacity-50";
                }
              } else if (isSelected) {
                bgClass = "bg-pink-100 border-pink-200";
              }

              return (
                <motion.button
                  key={idx}
                  whileHover={!showExplanation ? { scale: 1.01 } : {}}
                  whileTap={!showExplanation ? { scale: 0.98 } : {}}
                  onClick={() => handleOptionClick(option)}
                  disabled={showExplanation}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all text-left ${bgClass} ${textClass}`}
                >
                  <span className="font-bold">{option}</span>
                  {icon}
                </motion.button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
               <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  {question.type === QuestionType.FILL_IN_THE_BLANKS ? "빈칸을 채우세요" : 
                   question.type === QuestionType.ESSAY ? "심화 서술형 (에세이)" : "단답형 서술형"}
               </span>
               {question.type === QuestionType.ESSAY && <Sparkles className="w-4 h-4 text-pink-400 animate-pulse" />}
            </div>
            <textarea
              value={subjectiveInput}
              onChange={(e) => setSubjectiveInput(e.target.value)}
              disabled={showExplanation}
              placeholder={question.type === QuestionType.FILL_IN_THE_BLANKS ? "빈칸에 들어갈 말을 적어보세요..." : "생각을 자유롭게 적어보세요..."}
              className={`w-full ${question.type === QuestionType.ESSAY ? 'h-48' : 'h-32'} p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl outline-none focus:border-pink-300 font-medium resize-none transition-all`}
            />
            {!showExplanation && (
              <button
                onClick={handleSubmitSubjective}
                disabled={!subjectiveInput.trim() || isEvaluating}
                className="w-full py-4 bg-pink-500 text-white rounded-2xl font-black shadow-lg shadow-pink-100 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isEvaluating ? <HelpCircle className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                답안 제출하기
              </button>
            )}
          </div>
        )}

        <AnimatePresence>
          {showExplanation && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8 pt-6 border-t border-dashed border-gray-200"
            >
              {evaluation && (
                <div className={`p-4 rounded-2xl mb-4 flex gap-3 ${evaluation.isCorrect ? 'bg-green-50 border border-green-100' : 'bg-orange-50 border border-orange-100'}`}>
                  <div className="mt-1">
                    {evaluation.isCorrect ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <HelpCircle className="w-5 h-5 text-orange-500" />}
                  </div>
                  <div>
                    <p className={`font-bold text-sm ${evaluation.isCorrect ? 'text-green-800' : 'text-orange-800'}`}>
                      {evaluation.feedback}
                    </p>
                    <p className="text-[10px] font-black uppercase text-gray-400 mt-1">Score: {evaluation.score}%</p>
                  </div>
                </div>
              )}

              <div className="bg-gray-50 p-4 rounded-2xl mb-6">
                <p className="text-[10px] font-black text-gray-400 uppercase mb-2">Detailed Solution</p>
                <p className="text-sm text-gray-700 font-medium leading-relaxed">
                  {question.explanation}
                </p>
              </div>

              {!showSelfAssess ? (
                <button
                  onClick={() => setShowSelfAssess(true)}
                  className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black shadow-lg hover:bg-black transition-colors flex items-center justify-center gap-2"
                >
                  다음으로 <ChevronRight className="w-5 h-5" />
                </button>
              ) : (
                <div className="space-y-4">
                  <p className="text-center text-gray-400 font-black text-[10px] uppercase tracking-widest">How was it?</p>
                  <div className="grid grid-cols-1 gap-2">
                    <button 
                      onClick={() => onComplete(UnderstandingLevel.GUESSED, isCorrect)}
                      className="p-3 bg-white border-2 border-gray-100 hover:border-gray-200 rounded-xl text-gray-700 text-xs font-black transition-colors flex items-center justify-center gap-2"
                    >
                      🤔 찍거나 몰랐어요
                    </button>
                    <button 
                      onClick={() => onComplete(UnderstandingLevel.NOT_SURE, isCorrect)}
                      className="p-3 bg-white border-2 border-blue-100 hover:bg-blue-50 rounded-xl text-blue-700 text-xs font-black transition-colors flex items-center justify-center gap-2"
                    >
                      🙂 조금 헷갈렸어요
                    </button>
                    <button 
                      onClick={() => onComplete(UnderstandingLevel.PERFECT, isCorrect)}
                      className="p-3 bg-white border-2 border-green-100 hover:bg-green-50 rounded-xl text-green-700 text-xs font-black transition-colors flex items-center justify-center gap-2"
                    >
                      😎 완벽히 알아요!
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
