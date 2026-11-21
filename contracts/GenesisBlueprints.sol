// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// Content-addressed community blueprints; no token, payment or ownership rights.
contract GenesisBlueprints {
    mapping(bytes32 => bytes) private content;
    mapping(bytes32 => address) public publisher;
    event BlueprintPublished(address indexed author, bytes32 indexed digest, bytes blueprint);

    function publish(bytes32 digest, bytes calldata blueprint) external {
        require(blueprint.length > 0 && blueprint.length <= 8192, "size");
        require(sha256(blueprint) == digest, "digest");
        require(publisher[digest] == address(0), "exists");
        content[digest] = blueprint;
        publisher[digest] = msg.sender;
        emit BlueprintPublished(msg.sender, digest, blueprint);
    }

    function read(bytes32 digest) external view returns (bytes memory) {
        require(publisher[digest] != address(0), "missing");
        return content[digest];
    }
}
