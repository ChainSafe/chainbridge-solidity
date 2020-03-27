pragma solidity 0.6.4;
pragma experimental ABIEncoderV2;

import "../interfaces/IDepositHandler.sol";

contract CentrifugeAssetHandler is IDepositHandler {
    address public _bridgeAddress;

    enum AssetDepositStatus { Uninitialized, Active, Confirmed }

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
    mapping(bytes32 => AssetDepositStatus) _assetDepositStatuses;

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

    function deposit(uint256 depositID, address depositer, bytes memory data) public override _onlyBridge {
        address originChainContractAddress;
        uint256 destinationChainID;
        address destinationChainHandlerAddress;
        address destinationRecipientAddress;
        bytes32 metaDataHash;

        assembly {
            originChainContractAddress     := mload(add(data,0x20))
            destinationChainID             := mload(add(data,0x40))
            destinationChainHandlerAddress := mload(add(data,0x60))
            destinationRecipientAddress    := mload(add(data,0x80))
            metaDataHash                   := mload(add(data,0xA0))
        }

        require(_assetDepositStatuses[metaDataHash] == AssetDepositStatus.Uninitialized,
        "asset has already been deposited and cannot be changed");
        _assetDepositStatuses[metaDataHash] = AssetDepositStatus.Active;

        _depositRecords[depositID] = DepositRecord(
            originChainContractAddress,
            destinationChainID,
            destinationChainHandlerAddress,
            destinationRecipientAddress,
            depositer,
            metaDataHash
        );
    }

    function executeDeposit(bytes memory data) public override {
        bytes32 metaDataHash;

        assembly {
            metaDataHash := mload(add(data, 0x20))
        }

        require(_assetDepositStatuses[metaDataHash] == AssetDepositStatus.Active, "asset hasn't been deposited or has already been finalized");
        _assetDepositStatuses[metaDataHash] = AssetDepositStatus.Confirmed;
    }
}
