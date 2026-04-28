import { QuizEvaluateResponse } from '../types/quiz.types';

interface QuizReviewCardProps {
  result: QuizEvaluateResponse;
  questionText: string;
  englishTranslation: string;
  category: string;
  correctAnswer: string;
}

export function QuizReviewCard({
  result,
  questionText,
  englishTranslation,
  category,
  correctAnswer,
}: QuizReviewCardProps) {
  return (
    <div className={`${result.correct ? 'bg-green-600/20 border-green-600' : 'bg-red-600/20 border-red-600'} border rounded-xl px-5 py-3 flex flex-col gap-2`}>
      <div className={`font-bold text-lg text-center ${result.correct ? 'text-green-400' : 'text-red-400'}`}>
        {result.correct ? 'Correct!' : 'Incorrect'}
      </div>
      {questionText && (
        <div>
          <div className="text-gray-500 text-[10px] uppercase mb-0.5">Question</div>
          <div className="text-gray-300 text-sm">{questionText}</div>
        </div>
      )}
      {category && (
        <div>
          <div className="text-gray-500 text-[10px] uppercase mb-0.5">Category</div>
          <div className="text-blue-400 text-sm">{category}</div>
        </div>
      )}
      {result.userTranscript && (
        <div>
          <div className="text-gray-500 text-[10px] uppercase mb-0.5">You Said</div>
          <div className="text-gray-400 text-sm">&quot;{result.userTranscript}&quot;</div>
        </div>
      )}
      {correctAnswer && (
        <div>
          <div className="text-gray-500 text-[10px] uppercase mb-0.5">Correct Answer</div>
          <div className="text-gray-300 text-sm">{correctAnswer}</div>
        </div>
      )}
      <div>
        <div className="text-gray-500 text-[10px] uppercase mb-0.5">Evaluation</div>
        <div className="text-gray-300 text-sm">{result.explanation}</div>
      </div>
      {englishTranslation && (
        <div>
          <div className="text-gray-500 text-[10px] uppercase mb-0.5">Translation</div>
          <div className="text-gray-400 text-sm italic">{englishTranslation}</div>
        </div>
      )}
    </div>
  );
}
