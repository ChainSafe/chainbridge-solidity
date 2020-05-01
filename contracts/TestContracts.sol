pragma solidity 0.6.4;

contract NoArgument {
    event NoArgumentCalled();

    function noArgument() public {
        emit NoArgumentCalled();
    }
}

contract OneArgument {
    event OneArgumentCalled(uint256 num);

    function oneArgument(uint256 num) public {
        emit OneArgumentCalled(num);
    }
}

contract TwoArguments {
    event TwoArgumentsCalled(address[] addresses, bytes4 randBytes4);

    function twoArguments(address[] memory addresses, bytes4 randBytes4) public {
        emit TwoArgumentsCalled(addresses, randBytes4);
    }
}

contract ThreeArguments {
    event ThreeArgumentsCalled(string randString, int256 randInt, bool randBool);

    function threeArguments(string memory randString, int256 randInt, bool randBool) public {
        emit ThreeArgumentsCalled(randString, randInt, randBool);
    }
}
