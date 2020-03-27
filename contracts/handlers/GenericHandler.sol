pragma solidity 0.6.4;
pragma experimental ABIEncoderV2;

import "../ERC20Safe.sol";
import "../interfaces/IDepositHandler.sol";

contract GenericHandler is IDepositHandler, ERC20Safe {
    address public _bridgeAddress;

    struct DepositRecord {
        uint256 _destinationChainID;
        address _destinationRecipientAddress;
        address _depositer;
        bytes   _metaData;
    }

    // DepositID => Deposit Record
    mapping (uint256 => DepositRecord) public _depositRecords;

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
        uint256       destinationChainID;
        address       destinationRecipientAddress;
        bytes memory  metaData;

        assembly {
            // These are all fixed 32 bytes
            // first 32 bytes of bytes is the length
            destinationChainID             := mload(add(data, 0x20))
            destinationRecipientAddress    := mload(add(data, 0x40))

            // metadata has variable length
            // load free memory pointer to store metadata
            metaData := mload(0x40)
            // first 32 bytes of variable length in storage refer to length
            let lenMeta := mload(add(0x60, data))
            mstore(0x40, add(0x40, add(metaData, lenMeta)))

            // in the calldata, metadata is stored @0x64 after accounting for function signature and the depositID
            calldatacopy(
                metaData,                     // copy to metaData
                0x84,                        // copy from calldata after data length declaration at 0x64
                sub(calldatasize(), 0x84)   // copy size (calldatasize - 0x84)
            )
        }

        _depositRecords[depositID] = DepositRecord(
            destinationChainID,
            destinationRecipientAddress,
            depositer,
            metaData
        );
    }

    // Todo: Implement example of generic deposit
    function executeDeposit(bytes memory data) public override {}
}
