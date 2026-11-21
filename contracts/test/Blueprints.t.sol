// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "../GenesisBlueprints.sol";
contract BlueprintsTest {
    function testPublishReadAndRejectTamper() public {
        GenesisBlueprints registry = new GenesisBlueprints();
        bytes memory blueprint = bytes('{"format":"genesis.island","version":1,"actions":[]}');
        bytes32 hash = sha256(blueprint);
        registry.publish(hash, blueprint);
        require(keccak256(registry.read(hash)) == keccak256(blueprint));
        require(registry.publisher(hash) == address(this));
        (bool duplicate,) = address(registry).call(abi.encodeCall(registry.publish,(hash,blueprint)));
        require(!duplicate);
        (bool tampered,) = address(registry).call(abi.encodeCall(registry.publish,(hash,bytes("bad"))));
        require(!tampered);
    }
    function testMissingAndOversize() public {
        GenesisBlueprints registry = new GenesisBlueprints();
        (bool missing,) = address(registry).staticcall(abi.encodeCall(registry.read,(bytes32(0))));
        require(!missing);
        bytes memory large = new bytes(8193);
        (bool oversized,) = address(registry).call(abi.encodeCall(registry.publish,(sha256(large),large)));
        require(!oversized);
    }
}
