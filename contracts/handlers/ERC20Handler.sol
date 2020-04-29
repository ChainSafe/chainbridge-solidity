pragma solidity 0.6.4;
pragma experimental ABIEncoderV2;

import "../interfaces/IDepositExecute.sol";
import "./HandlerHelpers.sol";
import "../ERC20Safe.sol";
import "@openzeppelin/contracts/presets/ERC20PresetMinterPauser.sol";

contract ERC20Handler is IDepositExecute, HandlerHelpers, ERC20Safe {
    bool    public _useContractWhitelist;

    struct DepositRecord {
        address _tokenAddress;
        uint8   _destinationChainID;
        bytes32 _resourceID;
        uint    _lenDestinationRecipientAddress;
        bytes   _destinationRecipientAddress;
        address _depositer;
        uint    _amount;
    }

    // depositNonce => Deposit Record
    mapping (uint8 => mapping(uint256 => DepositRecord)) public _depositRecords;

    constructor(
        address          bridgeAddress,
        bytes32[] memory initialResourceIDs,
        address[] memory initialContractAddresses,
        address[] memory burnableContractAddresses
    ) public {
        require(initialResourceIDs.length == initialContractAddresses.length,
            "mismatch length between initialResourceIDs and initialContractAddresses");

        _bridgeAddress = bridgeAddress;

        for (uint256 i = 0; i < initialResourceIDs.length; i++) {
            _setResource(initialResourceIDs[i], initialContractAddresses[i]);
        }

        for (uint256 i = 0; i < burnableContractAddresses.length; i++) {
            _setBurnable(burnableContractAddresses[i]);
        }
    }

    function getDepositRecord(uint256 depositID, uint8 destId) public view returns (DepositRecord memory) {
        return _depositRecords[destId][depositID];
    }

    // Initiate a transfer by completing a deposit (transferFrom).
    // Data passed into the function should be constructed as follows:
    //
    // resourceID                             bytes32     bytes   0 - 32
    // amount                                 uint256     bytes  32 - 64
    // recipientAddress length     uint256     bytes  64 - 96
    // recipientAddress            bytes       bytes  96 - END
    function deposit(
        uint8 destinationChainID,
        uint256 depositNonce,
        address depositer,
        bytes memory data
    ) public override _onlyBridge {
        bytes32        resourceID;
        bytes   memory recipientAddress;
        uint256        amount;
        uint256        lenRecipientAddress;

        assembly {

            resourceID := mload(add(data, 0x20))
            amount := mload(add(data, 0x40))

            recipientAddress := mload(0x40)
            lenRecipientAddress := mload(add(0x60, data))
            mstore(0x40, add(0x20, add(recipientAddress, lenRecipientAddress)))

            calldatacopy(
                recipientAddress, // copy to destinationRecipientAddress
                0xE4, // copy from calldata @ 0x104
                sub(calldatasize(), 0xE4) // copy size (calldatasize - 0x104)
            )
        }

        address tokenAddress = _resourceIDToTokenContractAddress[resourceID];
        require(_contractWhitelist[tokenAddress], "provided tokenAddress is not whitelisted");

        if (_burnList[tokenAddress]) {
            burnERC20(tokenAddress, depositer, amount);
        } else {
            lockERC20(tokenAddress, depositer, address(this), amount);
        }

        _depositRecords[destinationChainID][depositNonce] = DepositRecord(
            tokenAddress,
            destinationChainID,
            resourceID,
            lenRecipientAddress,
            recipientAddress,
            depositer,
            amount
        );
    }

    // execute a deposit
    // bytes memory data passed into the function should be constructed as follows:

    // resourceID                             bytes32     bytes  0 - 32
    // amount                                 uint256     bytes   32 - 64
    // --------------------------------------------------------------------
    // destinationRecipientAddress length     uint256     bytes  64 - 96
    // destinationRecipientAddress            bytes       bytes  96 - END
    function executeDeposit(bytes memory data) public override _onlyBridge {
        uint256       amount;
        bytes32       resourceID;
        bytes  memory destinationRecipientAddress;


        assembly {
            resourceID := mload(add(data, 0x20))
            amount := mload(add(data, 0x40))

            destinationRecipientAddress := mload(0x40)
            let lenDestinationRecipientAddress := mload(add(0x60, data))
            mstore(0x40, add(0x20, add(destinationRecipientAddress, lenDestinationRecipientAddress)))
            
            // in the calldata the destinationRecipientAddress is stored at 0xC4 after accounting for the function signature and length declaration
            calldatacopy(
                destinationRecipientAddress, // copy to destinationRecipientAddress
                0x84, // copy from calldata @ 0x84
                sub(calldatasize(), 0x84) // copy size to the end of calldata
            )
        }

        bytes20 recipientAddress;
        address tokenAddress = _resourceIDToTokenContractAddress[resourceID];

        assembly {
            recipientAddress := mload(add(destinationRecipientAddress, 0x20))
        }

        require(_contractWhitelist[tokenAddress], "provided tokenAddress is not whitelisted");

        if (_burnList[tokenAddress]) {
            mintERC20(tokenAddress, address(recipientAddress), amount);
        } else {
            releaseERC20(tokenAddress, address(recipientAddress), amount);
        }
    }

    /**
        @notice Used to manually release ERC20 tokens from ERC20Safe.
        @param tokenAddress Address of token contract to release.
        @param recipient Address to release tokens to.
        @param amount The amount of ERC20 tokens to release.
     */
    function withdraw(address tokenAddress, address recipient, uint amount) public override _onlyBridge {
        releaseERC20(tokenAddress, recipient, amount);
    }
}
