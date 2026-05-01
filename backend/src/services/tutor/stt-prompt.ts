const SCENE = process.env.TUTOR_STT_SCENE ?? 'Magyar állampolgársági interjú zajlik.';

export function buildSttPrompt(lastExaminerReply: string | undefined): string {
  if (!lastExaminerReply) return `${SCENE}\nJelölt:`;
  return `${SCENE}\nVizsgáztató: ${lastExaminerReply}\nJelölt:`;
}
