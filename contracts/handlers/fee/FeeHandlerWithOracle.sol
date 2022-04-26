// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.11;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import "../../interfaces/IFeeHandler.sol";
import "../../interfaces/IERCHandler.sol";
import "../../interfaces/IBridge.sol";
import "../../ERC20Safe.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
    @title Handles deposit fees based on Effective rates provided by Fee oracle.
    @author ChainSafe Systems.
    @notice This contract is intended to be used with the Bridge contract.
 */
contract FeeHandlerWithOracle is IFeeHandler, AccessControl, ERC20Safe {
    address public immutable _bridgeAddress;

    address public _oracleAddress;

    uint32 public _gasUsed;
    uint16 public _feePercent; // multiplied by 100 to avoid precision loss

    struct OracleMessageType {
        // Base Effective Rate - effective rate between base currencies of source and dest networks (eg. MATIC/ETH)
        uint256 ber; 
        // Token Effective Rate - rate between base currency of destination network and token that is being trasferred (eg. MATIC/USDT)
        uint256 ter;
        uint256 dstGasPrice;
        uint256 expiresAt;
        uint8 fromDomainID;
        uint8 toDomainID;
        bytes32 resourceID;
    }

    struct FeeDataType {
        bytes message;
        bytes sig;
        uint256 amount;
    }

    /**
        @param bridgeAddress Contract address of previously deployed Bridge.
     */
    constructor(address bridgeAddress) public {
        _bridgeAddress = bridgeAddress;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // Admin functions

    /**
        @notice Sets the fee oracle address for signature verification.
        @param oracleAddress Fee oracle address.
     */
    function setFeeOracle(address oracleAddress) external onlyAdmin {
        _oracleAddress = oracleAddress;
    }

    /**
        @notice Sets the fee properties.
        @param gasUsed Gas used for transfer.
        @param feePercent Added to fee amount. total fee = fee + fee * feePercent
     */
    function setFeeProperties(uint32 gasUsed, uint16 feePercent) external onlyAdmin {
        _gasUsed = gasUsed;
        _feePercent = feePercent;
    }

    /**
        @notice Collects fee for deposit.
        @param sender Sender of the deposit.
        @param fromDomainID ID of the source chain.
        @param destinationDomainID ID of chain deposit will be bridged to.
        @param resourceID ResourceID to be used when making deposits.
        @param depositData Additional data to be passed to specified handler.
        @param feeData Additional data to be passed to the fee handler.
     */
    function collectFee(address sender, uint8 fromDomainID, uint8 destinationDomainID, bytes32 resourceID, bytes calldata depositData, bytes calldata feeData) payable external onlyBridge {
        require(msg.value == 0, "collectFee: msg.value != 0");
        (uint256 fee, address tokenAddress) = _calculateFee(sender, fromDomainID, destinationDomainID, resourceID, depositData, feeData);
        lockERC20(tokenAddress, sender, address(this), fee);
    }

     /**
        @notice Calculates fee for deposit.
        @param sender Sender of the deposit.
        @param fromDomainID ID of the source chain.
        @param destinationDomainID ID of chain deposit will be bridged to.
        @param resourceID ResourceID to be used when making deposits.
        @param depositData Additional data to be passed to specified handler.
        @param feeData Additional data to be passed to the fee handler.
        @return fee Returns the fee amount.
        @return tokenAddress Returns the address of the token to be used for fee.
     */
    function calculateFee(address sender, uint8 fromDomainID, uint8 destinationDomainID, bytes32 resourceID, bytes calldata depositData, bytes calldata feeData) external view returns(uint256 fee, address tokenAddress) {
        return _calculateFee(sender, fromDomainID, destinationDomainID, resourceID, depositData, feeData);
    }

    function _calculateFee(address sender, uint8 fromDomainID, uint8 destinationDomainID, bytes32 resourceID, bytes calldata depositData, bytes calldata feeData) internal view returns(uint256 fee, address tokenAddress) {
        /** 
            Message:
            ber * 10^18:  uint256
            ter * 10^18:  uint256
            dstGasPrice:  uint256
            expiresAt:    uint256
            fromDomainID: uint8 encoded as uint256
            toDomainID:   uint8 encoded as uint256
            resourceID:   bytes32
            sig:          bytes(65 bytes)

            total in bytes:
            message:
            32 * 7  = 224
            message + sig:
            224 + 65 = 289

            amount: uint256
            total: 321
        */  

        require(feeData.length == 321, "Incorrect feeData length");

        FeeDataType memory feeDataDecoded;

        feeDataDecoded.message = bytes(feeData[: 224]);
        feeDataDecoded.sig = bytes(feeData[224: 289]);
        feeDataDecoded.amount = abi.decode(feeData[289:], (uint256));

        OracleMessageType memory oracleMessage = abi.decode(feeDataDecoded.message, (OracleMessageType));
        require(block.timestamp <= oracleMessage.expiresAt, "Obsolete oracle data");
        require((oracleMessage.fromDomainID == fromDomainID) 
            && (oracleMessage.toDomainID == destinationDomainID) 
            && (oracleMessage.resourceID == resourceID), 
            "Incorrect deposit params"
        );

        bytes32 messageHash = keccak256(feeDataDecoded.message);

        verifySig(messageHash, feeDataDecoded.sig, _oracleAddress);

        address tokenHandler = IBridge(_bridgeAddress)._resourceIDToHandlerAddress(resourceID);
        address tokenAddress = IERCHandler(tokenHandler)._resourceIDToTokenContractAddress(resourceID);
        
        // txCost = dstGasPrice * _gasUsed * Token Effective Rate (rate of dest base currency to token)
        uint256 txCost = oracleMessage.dstGasPrice * _gasUsed * oracleMessage.ter / 1e18;

        fee = feeDataDecoded.amount * _feePercent / 1e4; // 100 for percent and 100 to avoid precision loss
        
        if (fee < txCost) {
            fee = txCost;
        }
        return (fee, tokenAddress);
    }

    /**
        @notice Transfers tokens from the contract to the specified addresses. The parameters addrs and amounts are mapped 1-1.
        This means that the address at index 0 for addrs will receive the amount of tokens from amounts at index 0.
        @param resourceID ResourceID of the token.
        @param addrs Array of addresses to transfer {amounts} to.
        @param amounts Array of amounts to transfer to {addrs}.
     */
    function transferFee(bytes32 resourceID, address[] calldata addrs, uint[] calldata amounts) external onlyAdmin {
        require(addrs.length == amounts.length, "addrs[], amounts[]: diff length");
        address tokenHandler = IBridge(_bridgeAddress)._resourceIDToHandlerAddress(resourceID);
        address tokenAddress = IERCHandler(tokenHandler)._resourceIDToTokenContractAddress(resourceID);
        for (uint256 i = 0; i < addrs.length; i++) {
            releaseERC20(tokenAddress, addrs[i], amounts[i]);
        }
    }

    function verifySig(bytes32 message, bytes memory signature, address signerAddress) internal view {
        address signerAddressRecovered = ECDSA.recover(message, signature);
        require(signerAddressRecovered == signerAddress, 'Invalid signature');
    }

    modifier onlyAdmin() {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "sender doesn't have admin role");
        _;
    }

    modifier onlyBridge() {
        _onlyBridge();
        _;
    }

    function _onlyBridge() private view {
        require(msg.sender == _bridgeAddress, "sender must be bridge contract");
    }
}
