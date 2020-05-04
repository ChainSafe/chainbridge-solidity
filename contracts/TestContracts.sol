pragma solidity 0.6.4;

contract NoArgument {
    event NoArgumentCalled();

    function noArgument() public {
        emit NoArgumentCalled();
    }
}

contract OneArgument {
    event OneArgumentCalled(uint256 indexed argumentOne);

    function oneArgument(uint256 argumentOne) public {
        emit OneArgumentCalled(argumentOne);
    }
}

contract TwoArguments {
    event TwoArgumentsCalled(address[] argumentOne, bytes4 argumentTwo);

    function twoArguments(address[] memory argumentOne, bytes4 argumentTwo) public {
        emit TwoArgumentsCalled(argumentOne, argumentTwo);
    }
}

contract ThreeArguments {
    event ThreeArgumentsCalled(string argumentOne, int8 argumentTwo, bool argumentThree);

    function threeArguments(string memory argumentOne, int8 argumentTwo, bool argumentThree) public {
        emit ThreeArgumentsCalled(argumentOne, argumentTwo, argumentThree);
    }
}
