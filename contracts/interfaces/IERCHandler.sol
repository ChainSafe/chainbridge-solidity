pragma solidity 0.6.4;

interface IERCHandler {
    function setBurnable(address) external;
    function setResource(bytes32, address) external;
}