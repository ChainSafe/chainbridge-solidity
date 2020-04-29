pragma solidity 0.6.4;

/**
    @title Interface for handler contracts that support deposits and deposit executions.
    @author ChainSafe Systems.
 */
interface IDepositExecute {
    /**
        @notice It is intended that deposit are made using the Bridge contract.
        @param destinationChainID Chain ID deposit is expected to be bridged to.
        @param depositNonce This value is generated as an ID by the Bridge contract.
        @param depositer Address of account making the deposit in the Bridge contract.
        @param data Consists of additional data needed for a specific deposit.
     */
    function deposit(uint8 destinationChainID, uint256 depositNonce, address depositer, bytes calldata data) external;

    /**
        @notice It is intended that proposals are executed by the Bridge contract.
        @param data Consists of additional data needed for a specific deposit execution.
     */
    function executeDeposit(bytes calldata data) external;
}
