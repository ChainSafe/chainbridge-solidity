// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.6.4;

/**
    @title Interface to be used with ERC20SXHandler
 */
interface ISXVault {
    /**
      @notice Sends the specified {recipient} native SX specified by {amount}.
      @notice Unlocks specified amount of SX to the specified recipient. Called by executeProposal() of ERC20SXHandler.
    */
    function bridgeExit(address recipient, uint256 amount) external;
}
