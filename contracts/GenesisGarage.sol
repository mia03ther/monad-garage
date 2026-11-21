// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// Fixed track and ruleset for the GENESIS Garage prototype. Scores are simulated lap times.
contract GenesisGarage {
    struct Build {
        uint256 parent;
        address author;
        uint8 motor;
        uint8 tires;
        uint8 boost;
        uint32 timeMs;
        bool beatParent;
        bool promoted;
    }

    uint256 public nextVersion = 1;
    uint256 public championVersion;
    mapping(uint256 => Build) private builds;
    event BuildPublished(
        uint256 indexed version, uint256 indexed parent, address indexed author, bool beatParent, bool promoted
    );
    event ChampionChanged(uint256 indexed previousChampion, uint256 indexed newChampion);

    function read(uint256 version) external view returns (Build memory) {
        require(version < nextVersion, "missing version");
        if (version == 0) return Build(0, address(0), 0, 0, 1, lapTime(0, 0, 1), false, true);
        return builds[version];
    }

    function publish(uint256 parent, uint8 motor, uint8 tires, uint8 boost) external returns (uint256 version) {
        require(parent < nextVersion, "missing parent");
        uint32 timeMs = lapTime(motor, tires, boost);
        Build memory previous = builds[parent];
        uint8 previousBoost = parent == 0 ? 1 : previous.boost;
        require(motor != previous.motor || tires != previous.tires || boost != previousBoost, "unchanged run");
        uint32 parentTime = parent == 0 ? lapTime(0, 0, 1) : previous.timeMs;
        bool beatParent = timeMs < parentTime;
        bool promoted = parent == championVersion && beatParent;
        version = nextVersion++;
        builds[version] = Build(parent, msg.sender, motor, tires, boost, timeMs, beatParent, promoted);
        emit BuildPublished(version, parent, msg.sender, beatParent, promoted);
        if (promoted) {
            uint256 previousChampion = championVersion;
            championVersion = version;
            emit ChampionChanged(previousChampion, version);
        }
    }

    function lapTime(uint8 motor, uint8 tires, uint8 boost) public pure returns (uint32) {
        require(motor < 3 && tires < 3 && boost < 4, "invalid parts or boost");
        require(motor + tires + 2 <= 5, "over budget");
        // These per-sector integer adjustments are mirrored in frontend/garage/rules.js.
        int32[3] memory base = [int32(4200), 5100, 4600];
        int32[3][3] memory motors = [[int32(0), 0, 0], [int32(220), 90, -720], [int32(-750), 480, -280]];
        int32[3][3] memory wheels = [[int32(-150), 550, 180], [int32(100), -650, 220], [int32(360), -300, -390]];
        int32[3] memory boosts = [int32(-530), 420, -850];
        int32 total = 0;
        for (uint8 i; i < base.length; i++) {
            total += base[i] + motors[motor][i] + wheels[tires][i];
            if (boost == i + 1) total += boosts[i];
        }
        // All valid loadouts produce positive section times with this fixed ruleset.
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint32(total);
    }
}
