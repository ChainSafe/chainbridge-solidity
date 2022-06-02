// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.11;

import "./handlers/HandlerHelpers.sol";

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


contract ReturnData {
    function returnData(string memory argument) external pure returns(bytes32 response) {
        assembly {
            response := mload(add(argument, 32))
        }
    }
}

contract HandlerRevert is HandlerHelpers {
    uint private _totalAmount;

    constructor(
        address          bridgeAddress
    ) public HandlerHelpers(bridgeAddress) {
    }

    function executeProposal(bytes32, bytes calldata) external view {
        if (_totalAmount == 0) {
            revert('Something bad happened');
        }
        return;
    }

    function virtualIncreaseBalance(uint amount) external {
        _totalAmount = amount;
    }
}

contract TestForwarder {
    function execute(bytes memory data, address to, address sender) external {
        bytes memory callData = abi.encodePacked(data, sender);
        (bool success, ) = to.call(callData);
        require(success, "Relay call failed");
    }
}

contract TestTarget {
    uint public calls = 0;
    uint public gasLeft;
    bytes public data;
    bool public burnAllGas;
    fallback() external payable {
        gasLeft = gasleft();
        calls++;
        data = msg.data;
        if (burnAllGas) {
            assert(false);
        }
    }

    function setBurnAllGas() public {
        burnAllGas = true;
    }
}
