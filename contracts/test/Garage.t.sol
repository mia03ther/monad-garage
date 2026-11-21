// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../GenesisGarage.sol";

contract GarageTest {
    function testOnlyFasterChildOfCurrentChampionTakesTheCrown() public {
        GenesisGarage garage = new GenesisGarage();
        require(garage.championVersion() == 0);

        uint256 first = garage.publish(0, 0, 1, 1);
        GenesisGarage.Build memory firstCar = garage.read(first);
        require(firstCar.beatParent && firstCar.promoted);
        require(garage.championVersion() == first);

        uint256 second = garage.publish(first, 1, 1, 3);
        GenesisGarage.Build memory secondCar = garage.read(second);
        require(secondCar.beatParent && secondCar.promoted);
        require(garage.championVersion() == second);

        uint256 losing = garage.publish(second, 1, 1, 2);
        GenesisGarage.Build memory losingCar = garage.read(losing);
        require(!losingCar.beatParent && !losingCar.promoted);
        require(garage.championVersion() == second);

        uint256 staleFork = garage.publish(0, 2, 0, 1);
        GenesisGarage.Build memory forkCar = garage.read(staleFork);
        require(forkCar.beatParent && !forkCar.promoted);
        require(garage.championVersion() == second);
    }

    function testRejectsMissingUnchangedAndOverBudgetCars() public {
        GenesisGarage garage = new GenesisGarage();
        (bool missing,) = address(garage).call(abi.encodeCall(garage.publish, (7, 0, 1, 1)));
        (bool unchanged,) = address(garage).call(abi.encodeCall(garage.publish, (0, 0, 0, 1)));
        (bool overBudget,) = address(garage).call(abi.encodeCall(garage.publish, (0, 2, 2, 1)));
        require(!missing && !unchanged && !overBudget);
        require(garage.nextVersion() == 1 && garage.championVersion() == 0);
    }
}
