pragma solidity 0.6.12;

import "./utils/SafeCast.sol";

contract NoArgument {
    event NoArgumentCalled();

    function noArgument() external {
        emit NoArgumentCalled();
    }
}

contract OneArgument {
    event OneArgumentCalled(uint256 indexed argumentOne);

    function oneArgument(uint256 argumentOne) external {
        emit OneArgumentCalled(argumentOne);
    }
}

contract TwoArguments {
    event TwoArgumentsCalled(address[] argumentOne, bytes4 argumentTwo);

    function twoArguments(address[] calldata argumentOne, bytes4 argumentTwo) external {
        emit TwoArgumentsCalled(argumentOne, argumentTwo);
    }
}

contract ThreeArguments {
    event ThreeArgumentsCalled(string argumentOne, int8 argumentTwo, bool argumentThree);

    function threeArguments(string calldata argumentOne, int8 argumentTwo, bool argumentThree) external {
        emit ThreeArgumentsCalled(argumentOne, argumentTwo, argumentThree);
    }
}

contract WithDepositer {
    event WithDepositerCalled(address argumentOne, uint256 argumentTwo);

    function withDepositer(address argumentOne, uint256 argumentTwo) external {
        emit WithDepositerCalled(argumentOne, argumentTwo);
    }
}

contract SafeCaster {
    using SafeCast for *;

    function toUint200(uint input) external pure returns(uint200) {
        return input.toUint200();
    }
}
