"""Walletless Monad Testnet event relay for GENESIS GARAGE.

The relay sponsors one tightly-scoped ``publish`` call. It never accepts raw
calldata, arbitrary RPC methods, destinations, values, or account material from
the browser. Use a low-balance, Testnet-only Foundry keystore.
"""
from __future__ import annotations

import argparse
from collections import deque
import getpass
from http.cookies import SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from os import PathLike
from pathlib import Path
import secrets
import shutil
import socket
import subprocess
import tempfile
import threading
import time
from typing import Any, cast
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from genesis.harness.chain import HARNESS_USER_AGENT

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CONTRACT = "0xe1e1E8498ff909Bf1d2B8fD95ff849ec9C932c10"
DEFAULT_RPC = "https://testnet-rpc.monad.xyz"
CHAIN_ID = "0x279f"


class EventGarage:
    def __init__(
        self,
        contract: str = DEFAULT_CONTRACT,
        *,
        rpc_url: str = DEFAULT_RPC,
        account: str = "monad-deployer",
        password: str = "",
        cast_executable: str = "cast",
    ) -> None:
        if not contract.startswith("0x") or len(contract) != 42:
            raise ValueError("invalid Garage contract")
        self.contract = contract
        self.rpc_url = rpc_url
        self.account = account
        self.password = password
        self.cast = cast_executable
        self.relayer_address = ""
        self.instance = secrets.token_hex(8)
        self.lock = threading.Lock()
        self.sessions: set[str] = set()
        self.results: dict[tuple[str, str], tuple[str, str]] = {}
        self.rates: dict[str, deque[float]] = {}

    def rpc(self, method: str, params: list[Any]) -> Any:
        payload = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode()
        request = Request(
            self.rpc_url,
            data=payload,
            headers={"Content-Type": "application/json", "User-Agent": HARNESS_USER_AGENT},
        )
        try:
            with urlopen(request, timeout=12) as response:
                body = json.load(response)
        except HTTPError as error:
            raise ValueError(f"Monad RPC rejected {method}: HTTP {error.code}") from error
        if "error" in body:
            raise ValueError(str(body["error"].get("message", "Monad rejected request")))
        return body["result"]

    def start(self) -> None:
        found = shutil.which(self.cast)
        if found is None:
            raise RuntimeError("Foundry cast is required on PATH")
        self.cast = found
        if self.rpc("eth_chainId", []) != CHAIN_ID:
            raise RuntimeError("RPC is not Monad Testnet")
        code = self.rpc("eth_getCode", [self.contract, "latest"])
        if not isinstance(code, str) or len(code) < 4:
            raise RuntimeError("Garage contract is not deployed")
        completed = self._cast("wallet", "address", "--account", self.account)
        address = completed.stdout.strip().lower()
        if not address.startswith("0x") or len(address) != 42:
            raise RuntimeError("could not derive relay account")
        self.relayer_address = address

    def _cast(self, *arguments: str, timeout: int = 120) -> subprocess.CompletedProcess[str]:
        with tempfile.TemporaryDirectory(prefix="genesis-garage-") as directory:
            password_file = Path(directory) / "keystore-password"
            password_file.write_text(self.password, encoding="utf-8")
            try:
                completed = subprocess.run(
                    [self.cast, *arguments, "--password-file", str(password_file)],
                    capture_output=True, text=True, timeout=timeout,
                    creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
                )
            finally:
                if password_file.exists():
                    password_file.write_text("\0" * len(self.password), encoding="utf-8")
        if completed.returncode:
            detail = (completed.stderr or completed.stdout or "cast failed").strip()
            raise ValueError(detail[:240])
        return completed

    def join(self, token: str | None) -> str:
        with self.lock:
            if token and token in self.sessions:
                return token
            if len(self.sessions) >= 500:
                raise ValueError("event session limit reached")
            token = secrets.token_urlsafe(32)
            self.sessions.add(token)
            return token

    def champion(self) -> int:
        artifact = json.loads((ROOT / "frontend/garage/build.json").read_text(encoding="utf-8"))
        selector = artifact["methods"]["championVersion()"]
        value = self.rpc("eth_call", [{"to": self.contract, "data": "0x" + selector}, "latest"])
        return int(value, 16)

    @staticmethod
    def validate(body: dict[str, Any]) -> tuple[int, int, int, int]:
        values = tuple(body.get(name) for name in ("parent", "motor", "tires", "boost"))
        if any(type(value) is not int for value in values):
            raise ValueError("challenge fields must be integers")
        parent, motor, tires, boost = (cast(int, value) for value in values)
        if not 0 <= parent < 2**256 or not 0 <= motor < 3 or not 0 <= tires < 3 or not 0 <= boost < 4:
            raise ValueError("invalid challenge")
        if motor + tires + 2 > 5:
            raise ValueError("car exceeds parts budget")
        return parent, motor, tires, boost

    def broadcast(self, parent: int, motor: int, tires: int, boost: int) -> str:
        completed = self._cast(
            "send", self.contract, "publish(uint256,uint8,uint8,uint8)",
            str(parent), str(motor), str(tires), str(boost),
            "--rpc-url", self.rpc_url, "--account", self.account, "--json",
        )
        try:
            output = json.loads(completed.stdout)
            transaction = output["transactionHash"]
        except (json.JSONDecodeError, KeyError, TypeError) as error:
            raise ValueError("cast did not return a transaction hash") from error
        if not isinstance(transaction, str) or len(transaction) != 66 or not transaction.startswith("0x"):
            raise ValueError("cast returned an invalid transaction hash")
        return transaction

    def challenge(self, token: str, request_id: Any, body: dict[str, Any]) -> str:
        if token not in self.sessions:
            raise ValueError("join the event before challenging")
        if not isinstance(request_id, str) or not 8 <= len(request_id) <= 100:
            raise ValueError("missing idempotency key")
        parent, motor, tires, boost = self.validate(body)
        canonical = json.dumps({"parent": parent, "motor": motor, "tires": tires, "boost": boost}, sort_keys=True)
        with self.lock:
            previous = self.results.get((token, request_id))
            if previous:
                if previous[0] != canonical:
                    raise ValueError("idempotency key already used for another challenge")
                return previous[1]
            if len(self.results) >= 4096:
                raise ValueError("event transaction limit reached")
            if parent != self.champion():
                raise ValueError("champion changed; reload before challenging")
            transaction = self.broadcast(parent, motor, tires, boost)
            self.results[(token, request_id)] = (canonical, transaction)
            return transaction


class GarageServer(ThreadingHTTPServer):
    def __init__(self, address: tuple[str, int], garage: EventGarage, share_url: str | None):
        self.garage = garage
        self.share_url = share_url
        super().__init__(address, GarageHandler)


class GarageHandler(SimpleHTTPRequestHandler):
    server: GarageServer

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

    def reply(self, status: int, body: Any, token: str | None = None) -> None:
        data = json.dumps(body, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        if token:
            self.send_header("Set-Cookie", f"genesis_garage={token}; HttpOnly; SameSite=Strict; Path=/api/garage")
        self.end_headers()
        self.wfile.write(data)

    def token(self) -> str | None:
        cookie = SimpleCookie()
        try:
            cookie.load(self.headers.get("Cookie", ""))
        except Exception:
            return None
        return cookie["genesis_garage"].value if "genesis_garage" in cookie else None

    def do_GET(self) -> None:
        if self.path == "/api/garage/info":
            garage = self.server.garage
            self.reply(200, {
                "mode": "monad-event-relay", "chainId": CHAIN_ID, "contract": garage.contract,
                "relayer": garage.relayer_address, "instance": garage.instance, "shareUrl": self.server.share_url,
            })
        else:
            super().do_GET()

    def do_POST(self) -> None:
        try:
            host = self.headers.get("Host", "")
            if self.headers.get("Origin") not in {"http://" + host, "https://" + host}:
                self.reply(403, {"error": "cross-origin request rejected"})
                return
            if self.headers.get("Content-Type", "").split(";")[0] != "application/json":
                raise ValueError("JSON required")
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 2048:
                raise ValueError("request too large")
            body = json.loads(self.rfile.read(length))
            if not isinstance(body, dict):
                raise ValueError("object required")
            garage = self.server.garage
            now = time.monotonic()
            with garage.lock:
                rate = garage.rates.setdefault(self.client_address[0], deque())
                while rate and rate[0] < now - 60:
                    rate.popleft()
                if len(rate) >= 30:
                    self.reply(429, {"error": "too many requests"})
                    return
                rate.append(now)
            if self.path == "/api/garage/join":
                token = garage.join(self.token())
                self.reply(200, {"joined": True, "instance": garage.instance}, token)
            elif self.path == "/api/garage/challenge":
                if self.headers.get("X-Garage-Instance") != garage.instance:
                    self.reply(409, {"error": "event changed; reload"})
                    return
                transaction = garage.challenge(self.token() or "", self.headers.get("Idempotency-Key"), body)
                self.reply(200, {"tx": transaction, "from": garage.relayer_address})
            else:
                self.reply(404, {"error": "not found"})
        except (ValueError, TypeError, KeyError, OSError, subprocess.SubprocessError) as error:
            self.reply(400, {"error": str(error)[:240]})


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8040)
    parser.add_argument("--advertise-host", help="LAN IPv4 address used by the event QR")
    parser.add_argument("--contract", default=DEFAULT_CONTRACT)
    parser.add_argument("--rpc-url", default=DEFAULT_RPC)
    parser.add_argument("--account", default="monad-deployer")
    args = parser.parse_args()
    password = getpass.getpass(f"Password for Testnet keystore {args.account}: ")
    garage = EventGarage(args.contract, rpc_url=args.rpc_url, account=args.account, password=password)
    garage.start()
    advertise = args.advertise_host
    if not advertise and args.host == "0.0.0.0":
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as route:
                route.connect(("192.0.2.1", 80))
                advertise = route.getsockname()[0]
        except OSError:
            advertise = None
    share_url = f"http://{advertise}:{args.port}/garage.html" if advertise else None
    server = GarageServer((args.host, args.port), garage, share_url)
    player_url = share_url or f"http://127.0.0.1:{server.server_port}/garage.html"
    print(json.dumps({
        "ready": True,
        "playerUrl": player_url,
        "wallUrl": f"http://127.0.0.1:{server.server_port}/garage.html?wall=1",
        "contract": garage.contract,
    }), flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
