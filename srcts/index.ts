import { BindScope } from "rstudio-shiny/srcts/types/src/shiny/bind";

const DEBUG = false;
const LABEL_RECORD = "Record";
const LABEL_STOP = "Stop";

class VideoClipperElement extends HTMLElement {
  video: HTMLVideoElement;
  selectCamera: HTMLSelectElement;
  selectMic: HTMLSelectElement;
  buttonRecord: HTMLButtonElement;
  linkDownload: HTMLAnchorElement;
  initialized: boolean = false;

  cameraStream?: MediaStream;
  micStream?: MediaStream;

  recorder?: MediaRecorder;
  chunks: Blob[] = [];

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot!.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
          height: 100%;
        }
        video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          background-color: #9a9;
        }
        .panel-choosers, .panel-controls {
          text-align: center;
          margin-bottom: 1em;
        }
      </style>
      <video muted></video>
      <div class="panel-choosers">
        <select class="camera-select">
          <option value="" disabled selected>Loading...</option>
        </select>
        <select class="mic-select">
          <option value="" disabled selected>Loading...</option>
        </select>
      </div>
      <div class="panel-controls">
        <button type="button" class="record" disabled>${LABEL_RECORD}</button>
        <a class="download" style="display: none;">Download</button>
      </div>
    `;
    this.video = this.shadowRoot!.querySelector("video")!;
    this.selectCamera = this.shadowRoot!.querySelector(".camera-select")!;
    this.selectMic = this.shadowRoot!.querySelector(".mic-select")!;
    this.buttonRecord = this.shadowRoot!.querySelector(".record")!;
    this.buttonRecord.addEventListener("click", () => {
      this.toggleRecord();
    });
    this.linkDownload = this.shadowRoot!.querySelector(".download")!;
  }
  connectedCallback() {
    // Trigger camera/mic permissions
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        stream.getTracks().forEach((track) => track.stop());
      });

    this.video.src = this.getAttribute("src")!;

    (async () => {
      if (!this.initialized) {
        this.initialized = true;
        await this.initializeMediaInput();
        this.buttonRecord.disabled = false;
      }
    })().catch((err) => {
      console.error(err);
    });
  }

  disconnectedCallback() {}

  async setMediaDevices(
    cameraId?: string,
    micId?: string
  ): Promise<{ cameraId: string; micId: string }> {
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach((track) => track.stop());
    }

    this.cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: cameraId || undefined,
        facingMode: "user",
        aspectRatio: 16 / 9,
      },
      audio: {
        deviceId: micId || undefined,
      },
    });

    this.video.srcObject = this.cameraStream!;
    this.video.play();

    return {
      cameraId: this.cameraStream.getVideoTracks()[0].getSettings().deviceId!,
      micId: this.cameraStream.getAudioTracks()[0].getSettings().deviceId!,
    };
  }

  async initializeMediaInput() {
    const savedCamera =
      window.localStorage.getItem("multimodal-camera") || undefined;
    const savedMic = window.localStorage.getItem("multimodal-mic") || undefined;
    const { cameraId, micId } = await this.setMediaDevices(
      savedCamera,
      savedMic
    );

    const devices = await navigator.mediaDevices.enumerateDevices();
    populateDeviceSelector(this.selectCamera, devices, "videoinput", cameraId);
    populateDeviceSelector(this.selectMic, devices, "audioinput", micId);

    this.selectCamera.addEventListener("change", (e) => {
      if (!this.selectCamera.value) return; // No devices available
      window.localStorage.setItem("multimodal-camera", this.selectCamera.value);
      this.setMediaDevices(this.selectCamera.value, this.selectMic.value);
    });
    this.selectMic.addEventListener("change", (e) => {
      if (!this.selectMic.value) return; // No devices available
      window.localStorage.setItem("multimodal-mic", this.selectMic.value);
      this.setMediaDevices(this.selectCamera.value, this.selectMic.value);
    });
  }

  toggleRecord() {
    if (this.buttonRecord.textContent === LABEL_RECORD) {
      this._beginRecord();
      this.buttonRecord.textContent = LABEL_STOP;
    } else {
      this.buttonRecord.textContent = LABEL_RECORD;
      this._endRecord(true);
    }
  }

  _beginRecord() {
    // Create a MediaRecorder object
    const options = {};

    this.recorder = new MediaRecorder(this.cameraStream!, options);

    this.recorder.addEventListener("error", (e) => {
      console.error("MediaRecorder error:", (e as ErrorEvent).error);
    });
    this.recorder.addEventListener("dataavailable", (e) => {
      console.log("chunk: ", e.data.size, e.data.type);
      this.chunks.push(e.data);
    });
    this.recorder.addEventListener("start", () => {
      console.log("Recording started");
    });
    this.recorder.start();
  }

  _endRecord(emit: boolean = true) {
    this.recorder!.stop();
    if (!emit) {
      this.chunks = [];
    } else {
      setTimeout(() => {
        console.log("chunks: ", this.chunks.length);
        const blob = new Blob(this.chunks, { type: this.chunks[0].type });

        if (DEBUG) {
          this.linkDownload.style.display = "block";
          this.linkDownload.href = URL.createObjectURL(blob);
          this.linkDownload.download = "clip.mkv";
        }

        // emit blobevent
        const event = new BlobEvent("data", {
          data: blob,
        });
        this.dispatchEvent(event);

        this.chunks = [];
      }, 0);
    }
  }
}
customElements.define("video-clipper", VideoClipperElement);

async function populateDeviceSelector(
  selectEl: HTMLSelectElement,
  devices: MediaDeviceInfo[],
  kind: MediaDeviceKind,
  currentDeviceId?: string
) {
  selectEl.innerHTML = "";
  for (const dev of devices) {
    if (dev.kind === kind) {
      const option = selectEl.ownerDocument.createElement("option");
      option.value = dev.deviceId!;
      option.text = dev.label!;
      if (currentDeviceId && dev.deviceId === currentDeviceId) {
        option.selected = true;
      }
      selectEl.appendChild(option);
    }
  }
  if (selectEl.childElementCount === 0) {
    const option = selectEl.ownerDocument.createElement("option");
    option.text = "No devices found";
    option.disabled = true;
    option.value = "";
    option.selected = true;
    selectEl.appendChild(option);
  }
}

const lastKnownValue = new WeakMap<HTMLElement, unknown>();

class VideoClipperBinding extends Shiny.InputBinding {
  find(scope: BindScope): JQuery<HTMLElement> {
    return $(scope).find("video-clipper");
  }
  getValue(el: HTMLElement): unknown {
    return lastKnownValue.get(el);
  }
  subscribe(el: HTMLElement, callback: (value: boolean) => void): void {
    el.addEventListener("data", async (ev: Event) => {
      const blob = (ev as BlobEvent).data;
      lastKnownValue.set(el, {
        type: blob.type,
        bytes: await base64(blob),
      });
      callback(true);
    });
  }
}

window.Shiny.inputBindings.register(new VideoClipperBinding(), "video-clipper");

async function base64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const results = [];
  const CHUNKSIZE = 1024;
  for (let i = 0; i < buf.byteLength; i += CHUNKSIZE) {
    const chunk = buf.slice(i, i + CHUNKSIZE);
    results.push(String.fromCharCode(...new Uint8Array(chunk)));
  }
  return btoa(results.join(""));
}
