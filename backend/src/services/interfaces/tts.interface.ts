export interface ITTSService {
  synthesize(text: string): Promise<Buffer>;
}
