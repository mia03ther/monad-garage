// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// One shared construction board. Demo allowances are not tokens or money.
/// Newly authored for GENESIS; no third-party game contract is incorporated.
contract GenesisCommunity {
    uint8[81] public kinds;
    uint8[81] public rotations;
    address[81] public builders;
    mapping(address => bool) public joined;
    mapping(address => uint256) public allowance;
    uint256 public revision;
    uint256 public participants;
    uint256 public roundEndsAt;
    bool public roundWon;
    event Joined(address indexed player);
    event Built(address indexed player, uint8 indexed cell, uint8 kind, uint8 rotation, uint256 revision);
    event Dismantled(address indexed player, uint8 indexed cell, uint256 revision);
    event IslandRestored(uint256 revision);

    modifier playable() {
        require(roundWon || roundEndsAt == 0 || block.timestamp < roundEndsAt, "round ended");
        _;
    }

    constructor() { kinds[40] = 8; }

    function cost(uint8 kind) public pure returns (uint256) {
        require(kind >= 1 && kind <= 7, "kind");
        if (kind == 1) return 1;
        if (kind == 2) return 5;
        if (kind == 7) return 6;
        return 3;
    }

    function valid(uint8 cell) public pure returns (bool) {
        if (cell >= 81) return false;
        int256 x = int256(uint256(cell % 9)) - 4;
        int256 z = int256(uint256(cell / 9)) - 4;
        return x*x + z*z <= 21;
    }

    function adjacent(uint8 cell) internal view returns (bool) {
        return (cell % 9 > 0 && kinds[cell-1] != 0)
            || (cell % 9 < 8 && kinds[cell+1] != 0)
            || (cell >= 9 && kinds[cell-9] != 0)
            || (cell < 72 && kinds[cell+9] != 0);
    }

    function build(uint8 cell, uint8 kind, uint8 rotation) external playable {
        uint256 price = cost(kind);
        require(valid(cell) && rotation < 4, "placement");
        require(kinds[cell] == 0, "occupied");
        require(adjacent(cell), "isolated");
        if (!joined[msg.sender]) {
            joined[msg.sender] = true;
            allowance[msg.sender] = 12;
            participants++;
            emit Joined(msg.sender);
        }
        require(allowance[msg.sender] >= price, "allowance");
        allowance[msg.sender] -= price;
        if (roundEndsAt == 0) roundEndsAt = block.timestamp + 90;
        kinds[cell] = kind;
        rotations[cell] = rotation;
        builders[cell] = msg.sender;
        emit Built(msg.sender, cell, kind, rotation, ++revision);
        checkWin();
    }

    function checkWin() internal {
        if (!roundWon) {
            (,,,,,,bool restored) = status();
            if (restored) { roundWon = true; emit IslandRestored(revision); }
        }
    }

    function dismantle(uint8 cell) external playable {
        require(valid(cell) && cell != 40, "placement");
        require(builders[cell] == msg.sender && kinds[cell] != 0, "builder");
        allowance[msg.sender] += cost(kinds[cell]);
        delete kinds[cell]; delete rotations[cell]; delete builders[cell];
        emit Dismantled(msg.sender, cell, ++revision);
        checkWin();
    }

    function board() external view returns (uint8[81] memory, uint8[81] memory, address[81] memory) {
        return (kinds, rotations, builders);
    }

    /// Bounded traversal; disconnected modules neither generate nor consume power.
    function status() public view returns (bool[81] memory active, uint256 supply, uint256 used, uint256 homes, uint256 gardens, uint256 beacons, bool restored) {
        bool[81] memory connected;
        uint8[81] memory queue;
        uint256 head; uint256 tail = 1;
        queue[0] = 40; connected[40] = true; supply = 1;
        while (head < tail) {
            uint8 cell = queue[head++];
            if (kinds[cell] == 2) supply += 6;
            uint8[4] memory neighbors = [cell % 9 > 0 ? cell-1 : 255, cell % 9 < 8 ? cell+1 : 255, cell >= 9 ? cell-9 : 255, cell < 72 ? cell+9 : 255];
            for (uint256 j; j < 4; j++) {
                uint8 n = neighbors[j];
                if (n < 81 && !connected[n] && kinds[n] != 0) {
                    connected[n] = true; queue[tail++] = n;
                }
            }
        }
        // Cell-index order is the public, deterministic priority under brownout.
        for (uint256 i; i < 81; i++) {
            uint8 k = kinds[i];
            if (!connected[i] || k == 0) continue;
            uint256 need = k == 7 ? 2 : (k >= 3 && k <= 6 ? 1 : 0);
            if (used + need > supply) continue;
            used += need; active[i] = true;
            if (k == 3) homes++; if (k == 4) gardens++; if (k == 7) beacons++;
        }
        restored = participants >= 3 && homes >= 2 && gardens >= 1 && beacons >= 1;
    }

    /// 0 waiting, 1 running, 2 completed/free-build, 3 timed out/read-only.
    function roundState() external view returns (uint256 phase, uint256 endsAt, uint256 chainTime) {
        phase = roundWon ? 2 : roundEndsAt == 0 ? 0 : block.timestamp < roundEndsAt ? 1 : 3;
        return (phase, roundEndsAt, block.timestamp);
    }
}
