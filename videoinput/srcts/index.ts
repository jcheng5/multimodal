import { BindScope } from "rstudio-shiny/srcts/types/src/shiny/bind";

class VideoClipperElement extends HTMLElement {
  video: HTMLVideoElement;
  avSettingsMenu!: AVSettingsMenuElement;
  buttonRecord!: HTMLButtonElement;
  buttonStop!: HTMLButtonElement;
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
          display: grid;
          grid-template-rows: 1fr;
          grid-template-columns: 1fr;
          width: 100%;
          height: min-content;
        }
        video {
          grid-column: 1 / 2;
          grid-row: 1 / 2;
          width: 100%;
          object-fit: cover;
          background-color: #9a9;
        }
        video.mirrored {
          transform: scaleX(-1);
        }
        .panel-settings {
          grid-column: 1 / 2;
          grid-row: 1 / 2;
          justify-self: end;
          margin: 0.5em;
        }
        .panel-buttons {
          grid-column: 1 / 2;
          grid-row: 1 / 2;
          justify-self: end;
          align-self: end;
          margin: 0.5em;
        }
      </style>
      <video part="video" muted></video>
      <div class="panel-settings">
        <slot name="settings"></slot>
      </div>
      <div class="panel-buttons">
        <slot name="recording-controls"></slot>
      </div>
  `;
    this.video = this.shadowRoot!.querySelector("video")!;
  }
  connectedCallback() {
    (async () => {
      if (!this.initialized) {
        this.initialized = true;

        this.buttonRecord = await retry(
          () => this.querySelector(".record-button") as HTMLButtonElement
        );
        this.buttonStop = await retry(
          () => this.querySelector(".stop-button") as HTMLButtonElement
        );

        this.buttonRecord.addEventListener("click", () => {
          this.buttonRecord.disabled = true;
          this.buttonStop.disabled = false;
          this._beginRecord();
        });
        this.buttonStop.addEventListener("click", () => {
          this._endRecord();
          this.buttonStop.disabled = true;
          this.buttonRecord.disabled = false;
        });

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

    const isSelfieCam =
      this.cameraStream.getVideoTracks()[0].getSettings().facingMode === "user";
    this.video.classList.toggle("mirrored", isSelfieCam);

    /* Prevent the height from jumping around when switching cameras */
    const aspectRatio = this.cameraStream
      .getVideoTracks()[0]
      .getSettings().aspectRatio;
    if (aspectRatio) {
      this.video.style.aspectRatio = `${aspectRatio}`;
    } else {
      this.video.style.aspectRatio = "";
    }
    this.video.srcObject = this.cameraStream!;
    this.video.play();

    return {
      cameraId: this.cameraStream.getVideoTracks()[0].getSettings().deviceId!,
      micId: this.cameraStream.getAudioTracks()[0].getSettings().deviceId!,
    };
  }

  async initializeMediaInput() {
    this.avSettingsMenu = await retry(
      () => this.querySelector("av-settings-menu") as AVSettingsMenuElement
    );

    const savedCamera =
      window.localStorage.getItem("multimodal-camera") || undefined;
    const savedMic = window.localStorage.getItem("multimodal-mic") || undefined;
    const { cameraId, micId } = await this.setMediaDevices(
      savedCamera,
      savedMic
    );

    const devices = await navigator.mediaDevices.enumerateDevices();
    this.avSettingsMenu.setDevices(
      devices.filter((dev) => dev.kind === "videoinput"),
      devices.filter((dev) => dev.kind === "audioinput")
    );
    this.avSettingsMenu.setSelectedDevices(cameraId, micId);

    this.avSettingsMenu.addEventListener("camera-change", (e) => {
      if (!this.avSettingsMenu.cameraId) return;
      window.localStorage.setItem(
        "multimodal-camera",
        this.avSettingsMenu.cameraId
      );
      this.setMediaDevices(
        this.avSettingsMenu.cameraId,
        this.avSettingsMenu.micId
      );
    });

    this.avSettingsMenu.addEventListener("mic-change", (e) => {
      if (!this.avSettingsMenu.micId) return;
      window.localStorage.setItem("multimodal-mic", this.avSettingsMenu.micId);
      this.setMediaDevices(
        this.avSettingsMenu.cameraId,
        this.avSettingsMenu.micId
      );
    });
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

class DeviceChangeEvent extends CustomEvent<{ deviceId?: string }> {
  constructor(type: string, detail: { deviceId?: string }) {
    super(type, { detail });
  }
}

class AVSettingsMenuElement extends HTMLElement {
  constructor() {
    super();
    this.addEventListener("click", (e) => {
      if (e.target instanceof HTMLAnchorElement) {
        const a = e.target;
        if (a.classList.contains("camera-device-item")) {
          this.setSelectedDevices(a.dataset.deviceId!, undefined);
          this.dispatchEvent(
            new DeviceChangeEvent("camera-change", {
              deviceId: a.dataset.deviceId,
            })
          );
        } else if (a.classList.contains("mic-device-item")) {
          this.setSelectedDevices(undefined, a.dataset.deviceId!);
          this.dispatchEvent(
            new DeviceChangeEvent("mic-change", {
              deviceId: a.dataset.deviceId,
            })
          );
        }
      }
    });
  }

  setDevices(cameras: MediaDeviceInfo[], mics: MediaDeviceInfo[]) {
    const cameraEls = cameras.map((dev) => {
      const li = this.ownerDocument.createElement("li");
      const a = li.appendChild(this.ownerDocument.createElement("a"));
      a.onclick = (e) => e.preventDefault();
      a.href = "#";
      a.textContent = dev.label;
      a.dataset.deviceId = dev.deviceId!;
      a.className = "camera-device-item";
      return li;
    });
    const cameraHeader = this.querySelector(".camera-header")!;
    cameraHeader.after(...cameraEls);

    const micEls = mics.map((dev) => {
      const li = this.ownerDocument.createElement("li");
      const a = li.appendChild(this.ownerDocument.createElement("a"));
      a.onclick = (e) => e.preventDefault();
      a.href = "#";
      a.textContent = dev.label;
      a.dataset.deviceId = dev.deviceId!;
      a.className = "mic-device-item";
      return li;
    });
    const micHeader = this.querySelector(".mic-header")!;
    micHeader.after(...micEls);
  }

  setSelectedDevices(cameraId?: string, micId?: string) {
    if (cameraId) {
      this.querySelectorAll("a.camera-device-item.active").forEach((a) =>
        a.classList.remove("active")
      );
      this.querySelector(
        `a.camera-device-item[data-device-id="${cameraId}"]`
      )?.classList.add("active");
    }
    if (micId) {
      this.querySelectorAll("a.mic-device-item.active").forEach((a) =>
        a.classList.remove("active")
      );
      this.querySelector(
        `a.mic-device-item[data-device-id="${micId}"]`
      )?.classList.add("active");
    }
  }

  get cameraId() {
    return (
      this.querySelector("a.camera-device-item.active") as HTMLAnchorElement
    )?.dataset.deviceId;
  }
  get micId() {
    return (this.querySelector("a.mic-device-item.active") as HTMLAnchorElement)
      ?.dataset.deviceId;
  }
}
customElements.define("av-settings-menu", AVSettingsMenuElement);

class VideoClipperBinding extends Shiny.InputBinding {
  lastKnownValue = new WeakMap<HTMLElement, unknown>();

  find(scope: BindScope): JQuery<HTMLElement> {
    return $(scope).find("video-clipper");
  }

  getValue(el: HTMLElement): unknown {
    return this.lastKnownValue.get(el);
  }

  subscribe(el: HTMLElement, callback: (value: boolean) => void): void {
    el.addEventListener("data", async (ev: Event) => {
      const blob = (ev as BlobEvent).data;
      this.lastKnownValue.set(el, {
        type: blob.type,
        bytes: await base64(blob),
      });
      callback(true);
    });
  }
}

window.Shiny.inputBindings.register(new VideoClipperBinding(), "video-clipper");

/**
 * Encode a Blob as a base64 string
 * @param blob The Blob to encode
 * @returns A base64-encoded string
 */
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

/**
 * Retry the function until it returns a non-null, non-undefined value.
 * @param fn A function that returns a value or null/undefined
 * @param delayMillis Number of milliseconds to wait between retries
 * @returns The first non-null, non-undefined value returned by `fn`
 */
async function retry<T>(
  fn: () => T | null | undefined,
  delayMillis = 0
): Promise<T> {
  while (true) {
    const result = fn();
    if (result !== null && result !== undefined) {
      return result;
    }
    await new Promise((resolve) => setTimeout(resolve, delayMillis));
  }
}
