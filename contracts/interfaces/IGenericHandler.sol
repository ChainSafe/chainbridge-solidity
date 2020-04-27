pragma solidity 0.6.4;

interface IGenericHandler {
    function setResource(bytes32, address, bytes4 , bytes4) external;
}