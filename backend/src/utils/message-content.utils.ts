import type { MessageContentComplex } from '@langchain/core/messages';

/**
 * Flatten a LangChain message `content` (string, or a block list mixing text with
 * tool_use / server-tool result blocks) down to its plain text. Non-text blocks are
 * dropped. Shared by the streaming tutor agent and the dynamic-answer resolver.
 */
export function extractTextContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    let out = '';
    for (const block of content) {
      if (typeof block === 'string') {
        out += block;
      } else if (block && typeof block === 'object') {
        const b = block as MessageContentComplex;
        if (b.type === 'text' && typeof b.text === 'string') out += b.text;
      }
    }
    return out;
  }
  return '';
}
