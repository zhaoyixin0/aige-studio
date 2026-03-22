import type { GameEngine, ModuleSchema } from '@/engine/core';
import { BaseModule } from '../base-module';

export interface QuizQuestion {
  text: string;
  options: string[];
  correctIndex: number;
}

export interface QuizScoring {
  correct: number;
  wrong: number;
  timeBonus: boolean;
}

export class QuizEngine extends BaseModule {
  readonly type = 'QuizEngine';

  private currentIndex = 0;
  private questionTimer = 0;
  private started = false;
  private finished = false;
  private totalScore = 0;

  getSchema(): ModuleSchema {
    return {
      questions: {
        type: 'object',
        label: '题目列表',
        default: [],
      },
      timePerQuestion: {
        type: 'range',
        label: '每题时间',
        min: 5,
        max: 60,
        default: 15,
        unit: '秒',
      },
      scoring: {
        type: 'object',
        label: '评分规则',
        default: { correct: 10, wrong: 0, timeBonus: true },
      },
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);
    this.currentIndex = 0;
  }

  start(): void {
    this.currentIndex = 0;
    this.questionTimer = 0;
    this.started = true;
    this.finished = false;
    this.totalScore = 0;

    this.emitCurrentQuestion();
  }

  answer(optionIndex: number): void {
    if (!this.started || this.finished) return;

    const questions: QuizQuestion[] = this.params.questions ?? [];
    if (this.currentIndex >= questions.length) return;

    const question = questions[this.currentIndex];
    const scoring: QuizScoring = this.params.scoring ?? { correct: 10, wrong: 0, timeBonus: true };

    if (optionIndex === question.correctIndex) {
      const score = scoring.correct;
      this.totalScore += score;

      this.emit('quiz:correct', {
        questionIndex: this.currentIndex,
        score,
      });

      if (score > 0) {
        this.emit('quiz:score', { delta: score, total: this.totalScore });
      }
    } else {
      this.emit('quiz:wrong', {
        questionIndex: this.currentIndex,
        correctIndex: question.correctIndex,
        selectedIndex: optionIndex,
      });

      if (scoring.wrong !== 0) {
        this.totalScore += scoring.wrong;
      }
    }

    this.advanceToNext();
  }

  update(dt: number): void {
    if (!this.started || this.finished) return;

    const timePerQuestion = (this.params.timePerQuestion ?? 15) * 1000; // ms
    this.questionTimer += dt;

    if (this.questionTimer >= timePerQuestion) {
      // Time ran out — auto-wrong
      const questions: QuizQuestion[] = this.params.questions ?? [];
      if (this.currentIndex < questions.length) {
        const question = questions[this.currentIndex];
        this.emit('quiz:wrong', {
          questionIndex: this.currentIndex,
          correctIndex: question.correctIndex,
          selectedIndex: -1, // timeout
        });
      }

      this.advanceToNext();
    }
  }

  private advanceToNext(): void {
    const questions: QuizQuestion[] = this.params.questions ?? [];
    this.currentIndex++;
    this.questionTimer = 0;

    if (this.currentIndex >= questions.length) {
      this.finished = true;
      this.emit('quiz:finished', {
        totalScore: this.totalScore,
        totalQuestions: questions.length,
      });
    } else {
      this.emitCurrentQuestion();
    }
  }

  private emitCurrentQuestion(): void {
    const questions: QuizQuestion[] = this.params.questions ?? [];
    if (this.currentIndex >= questions.length) return;

    const question = questions[this.currentIndex];
    this.emit('quiz:question', {
      text: question.text,
      options: question.options,
      index: this.currentIndex,
      total: questions.length,
    });
  }

  getCurrentQuestion(): QuizQuestion | null {
    const questions: QuizQuestion[] = this.params.questions ?? [];
    if (this.currentIndex >= questions.length) return null;
    return questions[this.currentIndex];
  }

  getProgress(): { current: number; total: number } {
    const questions: QuizQuestion[] = this.params.questions ?? [];
    return { current: this.currentIndex, total: questions.length };
  }

  isFinished(): boolean {
    return this.finished;
  }

  reset(): void {
    this.currentIndex = 0;
    this.questionTimer = 0;
    this.started = false;
    this.finished = false;
    this.totalScore = 0;
  }
}
