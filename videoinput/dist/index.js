"use strict";

// srcts/videoClipper.ts
var VideoClipperElement = class extends HTMLElement {
  constructor() {
    super();
    this.chunks = [];
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
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
            background-color: var(--video-clip-bg, black);
            aspect-ratio: 16 / 9;
            border-radius: var(--video-clip-border-radius, var(--bs-border-radius-lg));
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
    this.video = this.shadowRoot.querySelector("video");
  }
  connectedCallback() {
    (async () => {
      const slotSettings = this.shadowRoot.querySelector(
        "slot[name=settings]"
      );
      slotSettings.addEventListener("slotchange", async () => {
        this.avSettingsMenu = slotSettings.assignedElements()[0];
        await this.#initializeMediaInput();
        if (this.buttonRecord) {
          this.buttonRecord.disabled = false;
        }
      });
      const slotControls = this.shadowRoot.querySelector(
        "slot[name=recording-controls]"
      );
      slotControls.addEventListener("slotchange", () => {
        const findButton = (selector) => {
          for (const el of slotControls.assignedElements()) {
            if (el.matches(selector)) {
              return el;
            }
            const sub = el.querySelector(selector);
            if (sub) {
              return sub;
            }
          }
          return null;
        };
        this.buttonRecord = findButton(".record-button");
        this.buttonStop = findButton(".stop-button");
        this.buttonRecord.disabled = true;
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
      });
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
    const isSelfieCam = true;
    this.video.classList.toggle("mirrored", isSelfieCam);
    const aspectRatio = this.cameraStream.getVideoTracks()[0].getSettings().aspectRatio;
    if (aspectRatio) {
      this.video.style.aspectRatio = `${aspectRatio}`;
    } else {
      this.video.style.aspectRatio = "";
    }
    this.video.srcObject = this.cameraStream;
    this.video.play();
    return {
      cameraId: this.cameraStream.getVideoTracks()[0].getSettings().deviceId,
      micId: this.cameraStream.getAudioTracks()[0].getSettings().deviceId
    };
  }
  async #initializeMediaInput() {
    const savedCamera = window.localStorage.getItem("multimodal-camera");
    const savedMic = window.localStorage.getItem("multimodal-mic");
    const { cameraId, micId } = await this.setMediaDevices(
      savedCamera,
      savedMic
    );
    const devices = await navigator.mediaDevices.enumerateDevices();
    this.avSettingsMenu.setCameras(
      devices.filter((dev) => dev.kind === "videoinput")
    );
    this.avSettingsMenu.setMics(
      devices.filter((dev) => dev.kind === "audioinput")
    );
    this.avSettingsMenu.cameraId = cameraId;
    this.avSettingsMenu.micId = micId;
    const handleDeviceChange = async (deviceType, deviceId) => {
      if (!deviceId) return;
      window.localStorage.setItem(`multimodal-${deviceType}`, deviceId);
      await this.setMediaDevices(
        this.avSettingsMenu.cameraId,
        this.avSettingsMenu.micId
      );
    };
    this.avSettingsMenu.addEventListener("camera-change", (e) => {
      handleDeviceChange("camera", this.avSettingsMenu.cameraId);
    });
    this.avSettingsMenu.addEventListener("mic-change", (e) => {
      handleDeviceChange("mic", this.avSettingsMenu.micId);
    });
  }
  _beginRecord() {
    this.recorder = new MediaRecorder(this.cameraStream, {});
    this.recorder.addEventListener("error", (e) => {
      console.error("MediaRecorder error:", e.error);
    });
    this.recorder.addEventListener("dataavailable", (e) => {
      this.chunks.push(e.data);
    });
    this.recorder.addEventListener("start", () => {
    });
    this.recorder.start();
  }
  _endRecord(emit = true) {
    this.recorder.stop();
    if (!emit) {
      this.chunks = [];
    } else {
      setTimeout(() => {
        const blob = new Blob(this.chunks, { type: this.chunks[0].type });
        const event = new BlobEvent("data", {
          data: blob
        });
        try {
          this.dispatchEvent(event);
        } finally {
          this.chunks = [];
        }
      }, 0);
    }
  }
};
customElements.define("video-clipper", VideoClipperElement);

// srcts/avSettingsMenu.ts
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
          this.cameraId = a.dataset.deviceId;
        } else if (a.classList.contains("mic-device-item")) {
          this.micId = a.dataset.deviceId;
        }
      }
    });
  }
  #setDevices(deviceType, devices) {
    const deviceEls = devices.map(
      (dev) => this.#createDeviceElement(dev, `${deviceType}-device-item`)
    );
    const header = this.querySelector(`.${deviceType}-header`);
    header.after(...deviceEls);
  }
  setCameras(cameras) {
    this.#setDevices("camera", cameras);
  }
  setMics(mics) {
    this.#setDevices("mic", mics);
  }
  get cameraId() {
    return this.#getSelectedDevice("camera");
  }
  set cameraId(id) {
    this.#setSelectedDevice("camera", id);
  }
  get micId() {
    return this.#getSelectedDevice("mic");
  }
  set micId(id) {
    this.#setSelectedDevice("mic", id);
  }
  #createDeviceElement(dev, className) {
    const li = this.ownerDocument.createElement("li");
    const a = li.appendChild(this.ownerDocument.createElement("a"));
    a.onclick = (e) => e.preventDefault();
    a.href = "#";
    a.textContent = dev.label;
    a.dataset.deviceId = dev.deviceId;
    a.className = className;
    return li;
  }
  #getSelectedDevice(device) {
    return this.querySelector(
      `a.${device}-device-item.active`
    )?.dataset.deviceId ?? null;
  }
  #setSelectedDevice(device, id) {
    this.querySelectorAll(`a.${device}-device-item.active`).forEach(
      (a) => a.classList.remove("active")
    );
    if (id) {
      this.querySelector(
        `a.${device}-device-item[data-device-id="${id}"]`
      ).classList.add("active");
    }
    this.dispatchEvent(
      new DeviceChangeEvent(`${device}-change`, {
        deviceId: id
      })
    );
  }
};
customElements.define("av-settings-menu", AVSettingsMenuElement);

// srcts/index.ts
var VideoClipperBinding = class extends Shiny.InputBinding {
  #lastKnownValue = /* @__PURE__ */ new WeakMap();
  #handlers = /* @__PURE__ */ new WeakMap();
  find(scope) {
    return $(scope).find("video-clipper");
  }
  getValue(el) {
    return this.#lastKnownValue.get(el);
  }
  subscribe(el, callback) {
    const handler = async (ev) => {
      const blob = ev.data;
      this.#lastKnownValue.set(el, {
        type: blob.type,
        bytes: await base64(blob)
      });
      callback(true);
    };
    el.addEventListener("data", handler);
    this.#handlers.set(el, handler);
  }
  unsubscribe(el) {
    const handler = this.#handlers.get(el);
    el.removeEventListener("data", handler);
    this.#handlers.delete(el);
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
