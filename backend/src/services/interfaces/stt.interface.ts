export interface ISTTService {
  transcribe(audioPath: string): Promise<string>;
}
