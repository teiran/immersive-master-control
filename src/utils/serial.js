// ─── WEB SERIAL MANAGER ──────────────────────────────────────
// Handles connection to Arduino via Web Serial API (Chrome/Edge)

export class SerialManager {
  constructor(baudRate = 9600) {
    this.baudRate = baudRate;
    this.port = null;
    this.writer = null;
    this.reader = null;
    this.connected = false;
    this.onData = null;       // callback for incoming data
    this.onConnect = null;
    this.onDisconnect = null;
    this.onError = null;
    this._readLoop = false;
  }

  isSupported() {
    return 'serial' in navigator;
  }

  async connect() {
    if (!this.isSupported()) {
      throw new Error('Web Serial API not supported. Use Chrome or Edge.');
    }

    try {
      this.port = await navigator.serial.requestPort();
      await this.port.open({ baudRate: this.baudRate });

      this.writer = this.port.writable.getWriter();
      this.connected = true;

      // Start read loop
      this._startReadLoop();

      this.onConnect?.();
      return true;
    } catch (err) {
      this.connected = false;
      this.onError?.(err);
      throw err;
    }
  }

  async disconnect() {
    this._readLoop = false;
    try {
      if (this.reader) {
        await this.reader.cancel();
        this.reader.releaseLock();
        this.reader = null;
      }
      if (this.writer) {
        this.writer.releaseLock();
        this.writer = null;
      }
      if (this.port) {
        await this.port.close();
        this.port = null;
      }
    } catch (err) {
      // Ignore close errors
    }
    this.connected = false;
    this.onDisconnect?.();
  }

  async send(command) {
    if (!this.writer) {
      console.warn('[Serial] Not connected, mock sending:', command);
      return false;
    }

    try {
      const encoder = new TextEncoder();
      await this.writer.write(encoder.encode(command + '\n'));
      return true;
    } catch (err) {
      this.onError?.(err);
      return false;
    }
  }

  async _startReadLoop() {
    if (!this.port?.readable) return;

    this._readLoop = true;
    this.reader = this.port.readable.getReader();
    const decoder = new TextDecoder();

    try {
      while (this._readLoop) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value) {
          const text = decoder.decode(value);
          this.onData?.(text);
        }
      }
    } catch (err) {
      if (this._readLoop) {
        this.onError?.(err);
      }
    } finally {
      this.reader?.releaseLock();
      this.reader = null;
    }
  }
}

export default SerialManager;
