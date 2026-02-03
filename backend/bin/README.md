# Whisper.cpp Implementation (Hungarian + NVIDIA GPU)

### 📂 Project Structure
```text
.
├── bin/
│   └── whisper/
│       ├── main.exe            <-- Extract from Engine zip
│       ├── cublas64_12.dll     <-- Extract from Engine zip
│       └── models/
│           └── ggml-small.bin  <-- Download from Hugging Face
├── uploads/                    <-- Target for 16kHz WAV files
└── server.ts                   <-- Express backend




Use code with caution.
📥 1. Download Sources

    GPU Engine: Download whisper-cublas-12.4.0-bin-x64.zip from the Whisper.cpp GitHub.
        github.com/ggml-org/whisper.cpp/
        Extract all binaries and DLLs to ./bin/whisper/.
    Hungarian Model: Download ggml-small.bin from the Official Hugging Face Repository.
        https://huggingface.co/ggerganov/whisper.cpp/tree/main
        Place in ./bin/whisper/models/.
        Note: Avoid .en files; they do not support Hungarian.

🛠 2. Dependencies & Requirements

    NVIDIA Drivers: Update via NVIDIA Driver Support to enable CUDA.
    FFmpeg: Required for audio pre-processing.
        Convert to Whisper format:
        ffmpeg -i input.mp3 -ar 16000 -ac 1 -c:a pcm_s16le output.wav

🚀 3. Usage & Optimization
When calling the binary via Node.js exec, use these flags optimized for the GTX 1650 Ti and i7-10750:
Flag	Value	Description
-m	./bin/whisper/models/ggml-small.bin	Path to Hungarian model
-l	hu	Forces Hungarian language
-ngl	32	GPU Acceleration (Offloads to VRAM)
-t	6	Matches i7-10750 core count
-otxt	(Flag)	Saves output to text file
💻 4. Code Implementation (Snippet)
typescript

const command = `"./bin/whisper/main.exe" -m ./bin/whisper/models/ggml-small.bin -f ./uploads/audio.wav -l hu -ngl 32 -otxt`;

Use code with caution.