pragma solidity 0.6.4;

interface IBridge {
    function _chainID() external returns (uint8);
    function owner() external returns (address);
}