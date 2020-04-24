pragma solidity 0.6.4;

interface IGenericHandler {
    // Resource ID, target address, deposit sig, execute sig
    function setResource(bytes32, address, bytes4 , bytes4) external;
}