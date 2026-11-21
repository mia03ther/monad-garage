"""Bounded local-Anvil playtest server. Never connects to a public signing RPC."""
from __future__ import annotations

import argparse
from collections import deque
from http.cookies import SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from os import PathLike
from pathlib import Path
import secrets
import shutil
import socket
import subprocess
import sys
import threading
import time
from typing import Any
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent.parent
def word(n: int) -> str:
    return format(n, "064x")


class LocalRoom:
    def __init__(self) -> None:
        self.process: subprocess.Popen[bytes] | None = None
        self.lock = threading.Lock()
        self.sessions: dict[str, dict[str, Any]] = {}
        self.results: dict[tuple[str, str], tuple[str, str]] = {}
        self.rates: dict[str, deque[float]] = {}
        self.rpc_url = ""
        self.contract = ""
        self.accounts: list[str] = []
        self.instance = secrets.token_hex(8)
        self.bytecode = ""

    def rpc(self, method: str, params: list[Any]) -> Any:
        data = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode()
        with urlopen(Request(self.rpc_url, data=data, headers={"Content-Type": "application/json"}), timeout=10) as r:
            body = json.load(r)
        if "error" in body:
            raise ValueError(str(body["error"].get("message", "local chain rejected action")))
        return body["result"]

    def start(self) -> None:
        anvil, forge = shutil.which("anvil"), shutil.which("forge")
        if not anvil or not forge:
            raise RuntimeError("Foundry required: put anvil and forge on PATH")
        build = subprocess.run([forge, "build", "--root", str(ROOT / "contracts"), "--use", "0.8.29"], capture_output=True, timeout=120)
        if build.returncode:
            raise RuntimeError(build.stderr.decode(errors="replace"))
        artifact = json.loads((ROOT / "contracts/out/GenesisCommunity.sol/GenesisCommunity.json").read_text())
        self.bytecode = artifact["bytecode"]["object"]
        with socket.socket() as s:
            s.bind(("127.0.0.1", 0))
            port = s.getsockname()[1]
        self.rpc_url = f"http://127.0.0.1:{port}"
        self.process = subprocess.Popen([anvil, "--host", "127.0.0.1", "--port", str(port), "--chain-id", "31337", "--block-time", "1", "--silent"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        for _ in range(100):
            if self.process.poll() is not None:
                raise RuntimeError("Anvil stopped before startup")
            try:
                if self.rpc("eth_chainId", []) == "0x7a69":
                    break
            except OSError:
                time.sleep(.1)
        else:
            raise RuntimeError("Anvil startup timed out")
        self.accounts = self.rpc("eth_accounts", [])[:9]
        self.deploy()

    def deploy(self) -> None:
        tx = self.rpc("eth_sendTransaction", [{"from": self.accounts[0], "data": self.bytecode, "gas": "0x600000"}])
        receipt = None
        for _ in range(100):
            receipt = self.rpc("eth_getTransactionReceipt", [tx])
            if receipt:
                break
            time.sleep(.1)
        if not receipt or receipt["status"] != "0x1":
            raise RuntimeError("local contract deployment failed")
        self.contract = receipt["contractAddress"]
        self.instance = secrets.token_hex(8)
        self.results.clear()

    def restart(self, token: str) -> dict[str, str]:
        with self.lock:
            if self.sessions.get(token, {}).get("address") != self.accounts[0]:
                raise ValueError("只有首位加入的演练主持人可以新开一局")
            self.deploy()
            return {"contract": self.contract, "instance": self.instance}

    def stop(self) -> None:
        if self.process:
            self.process.terminate()
            try:
                self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.process.kill()

    def join(self, token: str | None, name: Any) -> tuple[str, dict[str, Any]]:
        if not isinstance(name, str) or not name.strip() or len(name) > 20:
            raise ValueError("昵称需要 1–20 个字符")
        with self.lock:
            if token in self.sessions:
                return str(token), self.sessions[str(token)]
            if len(self.sessions) >= len(self.accounts):
                raise ValueError("本地演练最多 9 位建造者，其余人可观看大屏")
            token = secrets.token_urlsafe(32)
            session = {"address": self.accounts[len(self.sessions)], "name": name.strip()}
            self.sessions[token] = session
            return token, session

    def action(self, token: str, request_id: Any, body: dict[str, Any], instance: str | None = None) -> str:
        if not isinstance(request_id, str) or not 8 <= len(request_id) <= 100:
            raise ValueError("缺少有效的操作编号")
        cell, kind, rotation = body.get("cell"), body.get("kind"), body.get("rotation", 0)
        if type(cell) is not int or not 0 <= cell < 81:
            raise ValueError("无效地块")
        if body.get("type") == "build":
            if type(kind) is not int or not 1 <= kind <= 7 or type(rotation) is not int or not 0 <= rotation < 4:
                raise ValueError("无效模块或方向")
            data = "0x50548d40" + word(cell) + word(kind) + word(rotation)
        elif body.get("type") == "remove":
            data = "0xf06730e0" + word(cell)
        else:
            raise ValueError("未知操作")
        canonical = json.dumps(body, sort_keys=True)
        with self.lock:
            if instance is not None and instance != self.instance:
                raise ValueError("房间已更新，请刷新后再操作")
            if token not in self.sessions:
                raise ValueError("请先加入房间")
            previous = self.results.get((token, request_id))
            if previous:
                if previous[0] != canonical:
                    raise ValueError("操作编号已用于不同操作")
                return previous[1]
            if len(self.results) >= 4096:
                raise ValueError("本地演练已达操作上限，请主持人导出后重启")
            tx_body = {"from": self.sessions[token]["address"], "to": self.contract, "data": data}
            self.rpc("eth_estimateGas", [tx_body])
            tx = str(self.rpc("eth_sendTransaction", [tx_body]))
            self.results[(token, request_id)] = (canonical, tx)
            return tx


class RoomServer(ThreadingHTTPServer):
    def __init__(self, address: tuple[str, int], room: LocalRoom, advertise_host: str | None = None):
        self.room = room
        super().__init__(address, Handler)
        self.share_url = f"http://{advertise_host}:{self.server_port}/play.html?local=1" if advertise_host else None


class Handler(SimpleHTTPRequestHandler):
    server: RoomServer

    def __init__(self, *args: Any, **kwargs: Any):
        super().__init__(*args, directory=str(ROOT / "frontend"), **kwargs)

    def log_message(self, format: str, *args: Any) -> None:
        pass

    def list_directory(self, path: str | PathLike[str]) -> Any:
        self.send_error(404)
        return None

    def end_headers(self) -> None:
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "same-origin")
        super().end_headers()

    def reply(self, status: int, body: Any, cookie: str | None = None) -> None:
        data = json.dumps(body, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        if cookie:
            self.send_header("Set-Cookie", f"genesis_room={cookie}; HttpOnly; SameSite=Strict; Path=/api")
        self.end_headers()
        self.wfile.write(data)

    def token(self) -> str | None:
        cookie = SimpleCookie()
        try:
            cookie.load(self.headers.get("Cookie", ""))
        except Exception:
            return None
        return cookie["genesis_room"].value if "genesis_room" in cookie else None

    def do_GET(self) -> None:
        if self.path == "/api/info":
            self.reply(200, {"mode": "anvil-local", "chainId": "0x7a69", "contract": self.server.room.contract, "instance": self.server.room.instance, "hostAddress": self.server.room.accounts[0], "session": self.server.room.sessions.get(self.token() or ""), "maxPlayers": 9, "shareUrl": self.server.share_url})
        else:
            super().do_GET()

    def do_POST(self) -> None:
        try:
            if self.headers.get("Origin") != "http://" + self.headers.get("Host", ""):
                self.reply(403, {"error": "cross-origin request rejected"})
                return
            if self.headers.get("Content-Type", "").split(";")[0] != "application/json":
                raise ValueError("JSON required")
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 4096:
                raise ValueError("request too large")
            now = time.monotonic()
            with self.server.room.lock:
                rate = self.server.room.rates.setdefault(self.client_address[0], deque())
                while rate and rate[0] < now - 60:
                    rate.popleft()
                if len(rate) >= 2400:
                    self.reply(429, {"error": "请稍后重试"})
                    return
                rate.append(now)
            body = json.loads(self.rfile.read(length))
            if not isinstance(body, dict):
                raise ValueError("object required")
            room = self.server.room
            if self.path == "/api/join":
                token, session = room.join(self.token(), body.get("name"))
                self.reply(200, session, token)
            elif self.path == "/api/action":
                if self.headers.get("X-Room-Instance") != room.instance:
                    self.reply(409, {"error": "房间已更新，请刷新后再操作"})
                    return
                tx = room.action(self.token() or "", self.headers.get("Idempotency-Key"), body, self.headers.get("X-Room-Instance"))
                self.reply(200, {"tx": tx})
            elif self.path == "/api/restart":
                self.reply(200, room.restart(self.token() or ""))
            elif self.path == "/api/rpc":
                method, params = body.get("method"), body.get("params")
                if not isinstance(params, list):
                    raise ValueError("params required")
                if method in {"eth_blockNumber", "eth_chainId"} and params == []:
                    pass
                elif method == "eth_getCode" and params == [room.contract, "latest"]:
                    pass
                elif method == "eth_getLogs" and len(params) == 1 and isinstance(params[0], dict):
                    query = params[0]
                    if set(query) != {"address", "fromBlock", "toBlock"} or not isinstance(query["address"], str) or query["address"].lower() != room.contract.lower():
                        raise ValueError("log query rejected")
                    start, end = int(query["fromBlock"], 16), int(query["toBlock"], 16)
                    if start < 0 or end < start or end-start > 2000:
                        raise ValueError("log range rejected")
                elif method == "eth_getTransactionReceipt" and len(params) == 1 and isinstance(params[0], str) and len(params[0]) == 66 and params[0].startswith("0x"):
                    int(params[0][2:], 16)
                elif method == "eth_call" and len(params) == 2 and isinstance(params[0], dict):
                    call = params[0]
                    selector = call.get("data", "")
                    if not isinstance(call.get("to"), str) or call["to"].lower() != room.contract.lower() or set(call) != {"to", "data"} or not isinstance(selector, str):
                        raise ValueError("read target rejected")
                    if selector not in {"0x7cd3229a", "0x7cc96380", "0x6c4470fb", "0x200d2ed2", "0xe0ba8cea"} and not (isinstance(selector, str) and selector.startswith("0x3e5beab9") and len(selector) == 74):
                        raise ValueError("read selector rejected")
                    if params[1] != "latest":
                        int(params[1], 16)
                else:
                    raise ValueError("RPC method not allowed")
                self.reply(200, {"result": room.rpc(method, params)})
            else:
                self.reply(404, {"error": "not found"})
        except (ValueError, TypeError, KeyError, OSError) as e:
            self.reply(400, {"error": str(e)[:240]})


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8030)
    parser.add_argument("--advertise-host", help="LAN address to encode in invitation QR codes")
    parser.add_argument("--control-stdin", action="store_true", help=argparse.SUPPRESS)
    args = parser.parse_args()
    room = LocalRoom()
    try:
        room.start()
        advertise = args.advertise_host
        if not advertise and args.host == "0.0.0.0":
            try:
                with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as route:
                    route.connect(("192.0.2.1", 80))
                    advertise = route.getsockname()[0]
            except OSError:
                advertise = None
        server = RoomServer((args.host, args.port), room, advertise)
        if args.control_stdin:
            def watch_input() -> None:
                sys.stdin.buffer.read(1)
                server.shutdown()
            threading.Thread(target=watch_input, daemon=True).start()
        print(json.dumps({"ready": True, "port": server.server_port, "mode": "anvil-local", "contract": room.contract, "instance": room.instance}), flush=True)
        server.serve_forever()
        server.server_close()
    except KeyboardInterrupt:
        pass
    finally:
        room.stop()


if __name__ == "__main__":
    main()
