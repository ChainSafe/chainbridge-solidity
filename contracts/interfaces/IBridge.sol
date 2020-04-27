pragma solidity 0.6.4;

interface IBridge {

    // Exposing getter for _ChainID only better than using call
    function _chainID() external returns (uint8);
}