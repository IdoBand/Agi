import { WorkflowContext } from '../../utils/file.utils.js';

export interface ISTTService {
  transcribe(audioPath: string, ctx?: WorkflowContext, prompt?: string): Promise<string>;
}
