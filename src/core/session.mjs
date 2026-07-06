/**
 * Prepare quiz state before replacing an answer.
 *
 * Core questions always remain in the queue. Changing a core answer invalidates
 * adaptive calibration questions, but it must never remove the unvisited core
 * questions that follow it.
 */
export function prepareAnswerUpdate({
  queue,
  answers,
  index,
  questionId,
  coreQuestionIds,
}) {
  const coreIds = new Set(coreQuestionIds);
  const answeringCoreQuestion = coreIds.has(questionId);

  if (answeringCoreQuestion) {
    const calibrationIds = new Set(queue.filter((id) => !coreIds.has(id)));
    return {
      queue: [...coreQuestionIds],
      answers: answers.filter(
        (answer) =>
          answer.questionId !== questionId &&
          !calibrationIds.has(answer.questionId),
      ),
    };
  }

  const invalidatedIds = new Set(queue.slice(index));
  return {
    queue: queue.slice(0, index + 1),
    answers: answers.filter(
      (answer) => !invalidatedIds.has(answer.questionId),
    ),
  };
}
