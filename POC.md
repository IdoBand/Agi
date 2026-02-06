Record audio from user | 3D avatar facing user, capture audio from user | 
STT                    | Audio processing a | ffmpeg converts audio.wbem to audio.wav
STT                    | Audio processing b | Whisper converts audio.wav to text
AI chat responds user  | construct prompt from text | interact with local Ollama to get text
TTS                    | get audio based on text | send text to 11labs and get an audio file
lip sync               | produce lipsync data based on audio | feed rhubarb with audio response from 11Labs
Respond to user        | audio + lipsync played to user   | React.js + three.js