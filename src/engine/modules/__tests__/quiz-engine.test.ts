import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { QuizEngine } from '../mechanic/quiz-engine';

describe('QuizEngine', () => {
  const sampleQuestions = [
    { text: 'What is 1+1?', options: ['1', '2', '3', '4'], correctIndex: 1 },
    { text: 'What is 2+2?', options: ['3', '4', '5', '6'], correctIndex: 1 },
    { text: 'What is 3+3?', options: ['5', '6', '7', '8'], correctIndex: 1 },
  ];

  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const quiz = new QuizEngine('quiz-1', {
      questions: sampleQuestions,
      timePerQuestion: 15,
      scoring: { correct: 10, wrong: 0, timeBonus: true },
      ...params,
    });
    engine.addModule(quiz);
    return { engine, quiz };
  }

  it('should emit quiz:question on start', () => {
    const { engine, quiz } = setup();
    const handler = vi.fn();
    engine.eventBus.on('quiz:question', handler);

    quiz.start();

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'What is 1+1?',
        options: ['1', '2', '3', '4'],
        index: 0,
      }),
    );
  });

  it('should emit quiz:correct for right answer', () => {
    const { engine, quiz } = setup();
    const correctHandler = vi.fn();
    engine.eventBus.on('quiz:correct', correctHandler);

    quiz.start();
    quiz.answer(1); // correct answer

    expect(correctHandler).toHaveBeenCalledOnce();
    expect(correctHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        questionIndex: 0,
        score: 10,
      }),
    );
  });

  it('should emit quiz:wrong for wrong answer and advance to next question', () => {
    const { engine, quiz } = setup();
    const wrongHandler = vi.fn();
    const questionHandler = vi.fn();
    engine.eventBus.on('quiz:wrong', wrongHandler);
    engine.eventBus.on('quiz:question', questionHandler);

    quiz.start();
    expect(questionHandler).toHaveBeenCalledTimes(1);

    quiz.answer(0); // wrong answer (correct is 1)

    expect(wrongHandler).toHaveBeenCalledOnce();
    expect(wrongHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        questionIndex: 0,
        correctIndex: 1,
      }),
    );

    // Should have advanced to next question
    expect(questionHandler).toHaveBeenCalledTimes(2);
    expect(questionHandler).toHaveBeenLastCalledWith(
      expect.objectContaining({
        text: 'What is 2+2?',
        index: 1,
      }),
    );
  });

  it('should ignore negative optionIndex', () => {
    const { engine, quiz } = setup();
    const wrongHandler = vi.fn();
    const correctHandler = vi.fn();
    engine.eventBus.on('quiz:wrong', wrongHandler);
    engine.eventBus.on('quiz:correct', correctHandler);

    quiz.start();
    quiz.answer(-1);

    // Should not emit any answer event
    expect(wrongHandler).not.toHaveBeenCalled();
    expect(correctHandler).not.toHaveBeenCalled();
  });

  it('should auto-start when gameflow resumes (gameflowPaused becomes false)', () => {
    const { engine, quiz } = setup();

    // Before resume, quiz should not be started
    expect(quiz.getCurrentQuestion()).toBeNull();

    // Simulate gameflow:resume
    engine.eventBus.emit('gameflow:resume');

    // Quiz should now be started with a current question
    expect(quiz.getCurrentQuestion()).not.toBeNull();
    expect(quiz.getCurrentQuestion()?.text).toBe('What is 1+1?');
  });

  it('should handle quiz:answer event from HUD clicks', () => {
    const { engine, quiz } = setup();

    engine.eventBus.emit('gameflow:resume');
    expect(quiz.getCurrentQuestion()?.text).toBe('What is 1+1?');

    // Simulate clicking answer via event
    engine.eventBus.emit('quiz:answer', { index: 1 });

    // Should advance to next question
    expect(quiz.getCurrentQuestion()?.text).toBe('What is 2+2?');
  });

  it('should finish after all questions answered via quiz:answer events', () => {
    const { engine, quiz } = setup();
    const finishedHandler = vi.fn();
    engine.eventBus.on('quiz:finished', finishedHandler);

    engine.eventBus.emit('gameflow:resume');

    engine.eventBus.emit('quiz:answer', { index: 1 }); // Q1 correct
    engine.eventBus.emit('quiz:answer', { index: 1 }); // Q2 correct
    engine.eventBus.emit('quiz:answer', { index: 1 }); // Q3 correct

    expect(quiz.isFinished()).toBe(true);
    expect(finishedHandler).toHaveBeenCalledOnce();
  });
});
