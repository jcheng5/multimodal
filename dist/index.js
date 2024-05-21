"use strict";

// srcts/index.ts
var DEBUG = false;
var LABEL_RECORD = "Record";
var LABEL_STOP = "Stop";
var VideoClipperElement = class extends HTMLElement {
  constructor() {
    super();
    this.initialized = false;
    this.chunks = [];
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          position: relative;
          width: 100%;
          height: 100%;
        }
        video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          background-color: #9a9;
        }
        .panel-controls {
          text-align: center;
          margin-bottom: 1em;
        }
      </style>
      <video part="video" muted></video>
      <slot name="settings"></slot>
      <div class="panel-controls">
        <button type="button" class="record" disabled>${LABEL_RECORD}</button>
        <a class="download" style="display: none;">Download</button>
      </div>
    `;
    this.video = this.shadowRoot.querySelector("video");
    this.buttonRecord = this.shadowRoot.querySelector(".record");
    this.buttonRecord.addEventListener("click", () => {
      this.toggleRecord();
    });
    this.linkDownload = this.shadowRoot.querySelector(".download");
  }
  connectedCallback() {
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
  disconnectedCallback() {
  }
  async setMediaDevices(cameraId, micId) {
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach((track) => track.stop());
    }
    this.cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: cameraId || void 0,
        facingMode: "user",
        aspectRatio: 16 / 9
      },
      audio: {
        deviceId: micId || void 0
      }
    });
    this.video.srcObject = this.cameraStream;
    this.video.play();
    return {
      cameraId: this.cameraStream.getVideoTracks()[0].getSettings().deviceId,
      micId: this.cameraStream.getAudioTracks()[0].getSettings().deviceId
    };
  }
  async initializeMediaInput() {
    while (!this.avSettingsMenu) {
      const el = this.querySelector("av-settings-menu") ?? void 0;
      if (el) {
        this.avSettingsMenu = el;
      } else {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
    const savedCamera = window.localStorage.getItem("multimodal-camera") || void 0;
    const savedMic = window.localStorage.getItem("multimodal-mic") || void 0;
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
    const options = {};
    this.recorder = new MediaRecorder(this.cameraStream, options);
    this.recorder.addEventListener("error", (e) => {
      console.error("MediaRecorder error:", e.error);
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
  _endRecord(emit = true) {
    this.recorder.stop();
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
        const event = new BlobEvent("data", {
          data: blob
        });
        this.dispatchEvent(event);
        this.chunks = [];
      }, 0);
    }
  }
};
customElements.define("video-clipper", VideoClipperElement);
var DeviceChangeEvent = class extends CustomEvent {
  constructor(type, detail) {
    super(type, { detail });
  }
};
var AVSettingsMenuElement = class extends HTMLElement {
  constructor() {
    super();
    this.addEventListener("click", (e) => {
      if (e.target instanceof HTMLAnchorElement) {
        const a = e.target;
        if (a.classList.contains("camera-device-item")) {
          this.setSelectedDevices(a.dataset.deviceId, void 0);
          this.dispatchEvent(
            new DeviceChangeEvent("camera-change", {
              deviceId: a.dataset.deviceId
            })
          );
        } else if (a.classList.contains("mic-device-item")) {
          this.setSelectedDevices(void 0, a.dataset.deviceId);
          this.dispatchEvent(
            new DeviceChangeEvent("mic-change", {
              deviceId: a.dataset.deviceId
            })
          );
        }
      }
    });
  }
  setDevices(cameras, mics) {
    const cameraEls = cameras.map((dev) => {
      const li = this.ownerDocument.createElement("li");
      const a = li.appendChild(this.ownerDocument.createElement("a"));
      a.onclick = (e) => e.preventDefault();
      a.href = "#";
      a.textContent = dev.label;
      a.dataset.deviceId = dev.deviceId;
      a.className = "camera-device-item";
      return li;
    });
    const cameraHeader = this.querySelector(".camera-header");
    cameraHeader.after(...cameraEls);
    const micEls = mics.map((dev) => {
      const li = this.ownerDocument.createElement("li");
      const a = li.appendChild(this.ownerDocument.createElement("a"));
      a.onclick = (e) => e.preventDefault();
      a.href = "#";
      a.textContent = dev.label;
      a.dataset.deviceId = dev.deviceId;
      a.className = "mic-device-item";
      return li;
    });
    const micHeader = this.querySelector(".mic-header");
    micHeader.after(...micEls);
  }
  setSelectedDevices(cameraId, micId) {
    if (cameraId) {
      this.querySelectorAll("a.camera-device-item.active").forEach(
        (a) => a.classList.remove("active")
      );
      this.querySelector(
        `a.camera-device-item[data-device-id="${cameraId}"]`
      )?.classList.add("active");
    }
    if (micId) {
      this.querySelectorAll("a.mic-device-item.active").forEach(
        (a) => a.classList.remove("active")
      );
      this.querySelector(
        `a.mic-device-item[data-device-id="${micId}"]`
      )?.classList.add("active");
    }
  }
  get cameraId() {
    return this.querySelector("a.camera-device-item.active")?.dataset.deviceId;
  }
  get micId() {
    return this.querySelector("a.mic-device-item.active")?.dataset.deviceId;
  }
};
customElements.define("av-settings-menu", AVSettingsMenuElement);
var lastKnownValue = /* @__PURE__ */ new WeakMap();
var VideoClipperBinding = class extends Shiny.InputBinding {
  find(scope) {
    return $(scope).find("video-clipper");
  }
  getValue(el) {
    return lastKnownValue.get(el);
  }
  subscribe(el, callback) {
    el.addEventListener("data", async (ev) => {
      const blob = ev.data;
      lastKnownValue.set(el, {
        type: blob.type,
        bytes: await base64(blob)
      });
      callback(true);
    });
  }
};
window.Shiny.inputBindings.register(new VideoClipperBinding(), "video-clipper");
async function base64(blob) {
  const buf = await blob.arrayBuffer();
  const results = [];
  const CHUNKSIZE = 1024;
  for (let i = 0; i < buf.byteLength; i += CHUNKSIZE) {
    const chunk = buf.slice(i, i + CHUNKSIZE);
    results.push(String.fromCharCode(...new Uint8Array(chunk)));
  }
  return btoa(results.join(""));
}
