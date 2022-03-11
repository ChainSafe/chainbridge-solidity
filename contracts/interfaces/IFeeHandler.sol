// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.11;

/**
    @title Interface to be used with fee handlers.
    @author ChainSafe Systems.
 */
interface IFeeHandler {
    /**
        @notice Collects fee for deposit.
        @param destinationDomainID ID of chain deposit will be bridged to.
        @param resourceID ResourceID to be used when making deposits.
        @param depositData Additional data to be passed to specified handler.
        @param feeData Additional data to be passed to the fee handler.
        @return Returns the bool result.
     */
    function collectFee(address sender, uint8 destinationDomainID, bytes32 resourceID, bytes calldata depositData, bytes calldata feeData) payable external returns(bool);
}
