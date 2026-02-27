import { WorkflowContext } from '../../utils/file.utils.js';

export interface ITTSService {
  synthesize(text: string): Promise<Buffer>;
  saveToFile(audioBuffer: Buffer, ctx?: WorkflowContext): Promise<string>;
}
