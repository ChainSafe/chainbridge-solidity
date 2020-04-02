pragma solidity 0.6.4;
pragma experimental ABIEncoderV2;

import "../interfaces/IDepositHandler.sol";

contract CentrifugeAssetHandler is IDepositHandler {
    address public _bridgeAddress;

    struct DepositRecord {
        address originChainContractAddress;
        uint256 destinationChainID;
        address destinationChainHandlerAddress;
        address destinationRecipientAddress;
        address depositer;
        bytes32 metaDataHash;
    }

    // depositID => DepositRecord
    mapping(uint256 => DepositRecord) _depositRecords;
    // metaDataHash => AssetDepositStatus
    mapping(bytes32 => bool) _assetDepositStatuses;

    modifier _onlyBridge() {
        require(msg.sender == _bridgeAddress, "sender must be bridge contract");
        _;
    }

    constructor(address bridgeAddress) public {
        _bridgeAddress = bridgeAddress;
    }

    function getDepositRecord(uint256 depositID) public view returns (DepositRecord memory) {
        return _depositRecords[depositID];
    }

    function deposit(uint256 originChainID, uint256 depositNonce, address depositer, bytes memory data) public override _onlyBridge {
        address originChainContractAddress;
        address destinationChainHandlerAddress;
        address destinationRecipientAddress;
        bytes32 metaDataHash;

        assembly {
            originChainContractAddress     := mload(add(data,0x20))
            destinationChainHandlerAddress := mload(add(data,0x40))
            destinationRecipientAddress    := mload(add(data,0x60))
            metaDataHash                   := mload(add(data,0x80))
        }

        require(_assetDepositStatuses[metaDataHash] == false,
        "asset has already been deposited and cannot be changed");

        _depositRecords[depositNonce] = DepositRecord(
            originChainContractAddress,
            originChainID,
            destinationChainHandlerAddress,
            destinationRecipientAddress,
            depositer,
            metaDataHash
        );
    }

    function executeDeposit(bytes memory data) public override _onlyBridge {
        bytes32 metaDataHash;

        assembly {
            metaDataHash := mload(add(data, 0x20))
        }

        require(_assetDepositStatuses[metaDataHash] == false, "asset hasn't been deposited or has already been finalized");
        _assetDepositStatuses[metaDataHash] = true;
    }
    
    function getHash(bytes32 hash) public view returns (bool) {
        return _assetDepositStatuses[hash];
    }
}
