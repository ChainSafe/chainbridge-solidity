pragma solidity 0.6.4;

contract TestContract {
    event WasCalled();

    function noArguments() public {
        emit WasCalled();
    }
}
