/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";
import { QuizQuestion, QuestionType, Difficulty } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function generateQuizzes(topic: string, count: number = 5, types: QuestionType[] = [QuestionType.MULTIPLE_CHOICE, QuestionType.SUBJECTIVE]): Promise<QuizQuestion[]> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate ${count} educational quiz questions for a student (elementary to middle school level) about the topic: "${topic}". 
      You MUST use ONLY these question types: ${types.join(", ")}.
      
      Instructions for types:
      - multiple_choice: Standard 4 alternatives.
      - subjective: Short answer questions.
      - fill_in_the_blanks: The question should have a blank represented by "___".
      - essay: In-depth questions requiring a long (2-3 sentence) explanation.
      
      Include at least one "HARD" difficulty question that requires deep thinking.
      Return a JSON array.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              topic: { type: Type.STRING },
              question: { type: Type.STRING },
              options: { 
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Required for multiple_choice"
              },
              correctAnswer: { type: Type.STRING },
              explanation: { type: Type.STRING },
              type: { 
                type: Type.STRING, 
                enum: ["multiple_choice", "subjective", "fill_in_the_blanks", "essay"] 
              },
              difficulty: { 
                type: Type.STRING,
                enum: ["easy", "medium", "hard"]
              }
            },
            required: ["id", "topic", "question", "correctAnswer", "explanation", "type", "difficulty"]
          }
        }
      }
    });

    const text = response.text || "[]";
    const cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleanText);
  } catch (error) {
    console.error("Error generating quizzes:", error);
    return [];
  }
}

export async function evaluateSubjectiveAnswer(question: string, correctAnswer: string, userAnswer: string): Promise<{ isCorrect: boolean; feedback: string; score: number }> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Evaluate the student's answer for the following question:
      Question: "${question}"
      Ideal Answer: "${correctAnswer}"
      Student's Answer: "${userAnswer}"
      
      Judge if it's correct (or substantially correct).
      Give a score from 0 to 100.
      Give a very friendly, encouraging feedback in Korean (1-2 sentences).
      Return as JSON.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isCorrect: { type: Type.BOOLEAN },
            feedback: { type: Type.STRING },
            score: { type: Type.NUMBER }
          },
          required: ["isCorrect", "feedback", "score"]
        }
      }
    });

    const text = response.text || "{}";
    const cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleanText);
  } catch (error) {
    return { isCorrect: false, feedback: "평가 중에 오류가 발생했어요. 다시 시도해볼까요?", score: 0 };
  }
}
