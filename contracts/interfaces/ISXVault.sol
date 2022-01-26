pragma solidity 0.6.4;

/**
    @title Interface to be used with ERC20SXHandler
 */
interface ISXVault {
    /**
      @notice Unlocks specified amount of SX to the specified recipient. Called by executeProposal() of ERC20SXHandler.
    */
    function execute(address recipient, uint256 amount) external;
}
