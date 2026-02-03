import { Request } from 'express';

export interface ChatRequest extends Request {
  file?: Express.Multer.File;
}

export interface TextChatRequest extends Request {
  body: {
    message: string;
  };
}
