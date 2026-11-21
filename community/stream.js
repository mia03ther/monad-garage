const COMMIT_STATES = new Set(["proposed", "voted", "finalized", "verified"]);

export class MonadRoomStream {
  constructor(url, contract, onChange, options = {}) {
    if (!/^wss?:\/\//i.test(url)) throw Error("Invalid WebSocket URL");
    if (!/^0x[0-9a-f]{40}$/i.test(contract)) throw Error("Invalid room address");
    if (typeof onChange !== "function") throw Error("Missing stream callback");
    this.url = url;
    this.contract = contract.toLowerCase();
    this.onChange = onChange;
    this.WebSocketClass = options.WebSocketClass ?? globalThis.WebSocket;
    this.reconnectBaseMs = options.reconnectBaseMs ?? 500;
    this.reconnectMaxMs = options.reconnectMaxMs ?? 10000;
    this.connectTimeoutMs = options.connectTimeoutMs ?? 10000;
    this.socket = null;
    this.subscription = null;
    this.connectTimer = null;
    this.reconnectTimer = null;
    this.reconnectAttempt = 0;
    this.connectedOnce = false;
    this.stopped = true;
    this.seenTransactions = new Set();
  }

  start() {
    if (!this.stopped) return;
    if (typeof this.WebSocketClass !== "function") return;
    this.stopped = false;
    this.connect();
  }

  stop() {
    this.stopped = true;
    this.clearConnectTimer();
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    const socket = this.socket;
    this.socket = null;
    this.subscription = null;
    if (socket) {
      try {
        socket.close();
      } catch {
        /* the polling fallback remains active */
      }
    }
  }

  notify(change) {
    queueMicrotask(() => {
      if (this.stopped) return;
      Promise.resolve(this.onChange(change)).catch(() => {});
    });
  }

  clearConnectTimer() {
    if (this.connectTimer === null) return;
    clearTimeout(this.connectTimer);
    this.connectTimer = null;
  }

  remember(transactionHash, commitState) {
    const key = `${transactionHash.toLowerCase()}:${commitState}`;
    if (this.seenTransactions.has(key)) return false;
    this.seenTransactions.add(key);
    if (this.seenTransactions.size > 256)
      this.seenTransactions.delete(this.seenTransactions.values().next().value);
    return true;
  }

  message(socket, event) {
    let message;
    try {
      message = JSON.parse(String(event.data));
    } catch {
      return;
    }
    if (!message || typeof message !== "object") return;
    if (message.id === 1) {
      if (message.error || typeof message.result !== "string" || !message.result) {
        socket.close();
        return;
      }
      this.subscription = message.result;
      this.clearConnectTimer();
      const reconnected = this.connectedOnce;
      this.connectedOnce = true;
      this.reconnectAttempt = 0;
      this.notify({ type: "connected", reconnected });
      return;
    }
    if (
      message.method !== "eth_subscription" ||
      message.params?.subscription !== this.subscription
    )
      return;
    const result = message.params?.result,
      log = result?.log ?? result,
      commitState = String(
        result?.commitState ?? log?.commitState ?? "",
      ).toLowerCase(),
      transactionHash = log?.transactionHash;
    if (
      !log ||
      log.removed ||
      typeof log.address !== "string" ||
      log.address.toLowerCase() !== this.contract ||
      !COMMIT_STATES.has(commitState) ||
      typeof transactionHash !== "string" ||
      !/^0x[0-9a-f]{64}$/i.test(transactionHash) ||
      !this.remember(transactionHash, commitState)
    )
      return;
    this.notify({
      type: "log",
      commitState,
      transactionHash,
      blockId: result?.blockId ?? log.blockId ?? null,
      blockHash: log.blockHash ?? null,
    });
  }

  scheduleReconnect() {
    if (this.stopped || this.reconnectTimer !== null) return;
    const delay = Math.min(
      this.reconnectMaxMs,
      this.reconnectBaseMs * 2 ** this.reconnectAttempt,
    );
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  connect() {
    if (this.stopped || this.socket) return;
    let socket;
    try {
      socket = new this.WebSocketClass(this.url);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;
    this.connectTimer = setTimeout(() => {
      if (socket === this.socket && !this.subscription) socket.close();
    }, this.connectTimeoutMs);
    socket.addEventListener("open", () => {
      if (this.stopped || socket !== this.socket) return;
      try {
        socket.send(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "eth_subscribe",
            params: ["monadLogs", { address: this.contract }],
          }),
        );
      } catch {
        socket.close();
      }
    });
    socket.addEventListener("message", (event) => {
      if (!this.stopped && socket === this.socket) this.message(socket, event);
    });
    socket.addEventListener("error", () => {
      if (socket === this.socket) socket.close();
    });
    socket.addEventListener("close", () => {
      if (socket !== this.socket) return;
      this.clearConnectTimer();
      this.socket = null;
      this.subscription = null;
      this.scheduleReconnect();
    });
  }
}
