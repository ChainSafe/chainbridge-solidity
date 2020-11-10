pragma solidity 0.6.4;

contract NoArgument {
    event NoArgumentCalled();
    event DepositArg(address depositer);

    function noArgument(address depositer) external {
        emit NoArgumentCalled();
        emit DepositArg(depositer);
    }
}

contract OneArgument {
    event OneArgumentCalled(uint256 indexed argumentOne);
    event DepositArg(address depositer);

    function oneArgument(address depositer, bytes calldata metadata) external {
        (uint256 argumentOne) = abi.decode(metadata, (uint256));
        emit OneArgumentCalled(argumentOne);
        emit DepositArg(depositer);
    }
}

contract TwoArguments {
    event TwoArgumentsCalled(address[] argumentOne, bytes4 argumentTwo);
    event DepositArg(address depositer);

    function twoArguments(address depositer, bytes calldata metadata) external {
        (address[] memory argumentOne, bytes4 argumentTwo) = abi.decode(metadata, (address[], bytes4));
        emit TwoArgumentsCalled(argumentOne, argumentTwo);
        emit DepositArg(depositer);
    }
}

contract ThreeArguments {
    event ThreeArgumentsCalled(string argumentOne, int8 argumentTwo, bool argumentThree);
    event DepositArg(address depositer);

    function threeArguments(address depositer, bytes calldata metadata) external {
        (string memory argumentOne, int8 argumentTwo, bool argumentThree) = abi.decode(metadata, (string, int8, bool));
        emit ThreeArgumentsCalled(argumentOne, argumentTwo, argumentThree);
        emit DepositArg(depositer);
    }
}
