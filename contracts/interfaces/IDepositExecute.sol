pragma solidity 0.6.4;

/**
    @title Interface for Bridge contract.
    @author ChainSafe Systems.
 */
interface IDepositExecute {
    function deposit(uint8 destinationChainID, uint256 depositNonce, address depositer, bytes calldata data) external;
    function executeDeposit(bytes calldata data) external;
}