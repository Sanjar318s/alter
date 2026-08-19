export class MediaRecorderService {
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;

  async start(kind: "audio" | "video") {
    this.chunks = [];
    this.stream = await navigator.mediaDevices.getUserMedia(
      kind === "audio" ? { audio: true } : { audio: true, video: true }
    );
    const mime = kind === "audio" ? "audio/webm" : "video/webm";
    this.recorder = new MediaRecorder(this.stream, { mimeType: MediaRecorder.isTypeSupported(mime) ? mime : undefined });
    this.recorder.ondataavailable = (e) => {
      if (e.data.size) this.chunks.push(e.data);
    };
    this.recorder.start(100);
    return this.stream;
  }

  pause() {
    if (this.recorder?.state === "recording") this.recorder.pause();
  }

  resume() {
    if (this.recorder?.state === "paused") this.recorder.resume();
  }

  async stop() {
    const rec = this.recorder;
    const type = rec?.mimeType || "application/octet-stream";
    const blob = await new Promise<Blob>((resolve) => {
      if (!rec) return resolve(new Blob());
      rec.onstop = () => resolve(new Blob(this.chunks, { type }));
      rec.stop();
    });
    this.cleanup();
    return blob;
  }

  cancel() {
    try {
      this.recorder?.stop();
    } catch {
      /* ignore */
    }
    this.cleanup();
  }

  private cleanup() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.recorder = null;
    this.chunks = [];
  }
}
