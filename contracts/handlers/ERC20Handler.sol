pragma solidity 0.6.4;
pragma experimental ABIEncoderV2;

import "../ERC20Safe.sol";
import "@openzeppelin/contracts/presets/ERC20PresetMinterPauser.sol";
import "../interfaces/IDepositExecute.sol";
import "../interfaces/IERCHandler.sol";

contract ERC20Handler is IDepositExecute, IERCHandler, ERC20Safe {
    address public _bridgeAddress;
    bool    public _useContractWhitelist;

    struct DepositRecord {
        address _originChainTokenAddress;
        uint8   _destinationChainID;
        bytes32 _resourceID;
        uint    _lenDestinationRecipientAddress;
        bytes   _destinationRecipientAddress;
        address _depositer;
        uint    _amount;
    }

    // resourceID => token contract address
    mapping (bytes32 => address) public _resourceIDToTokenContractAddress;

    // token contract address => resourceID
    mapping (address => bytes32) public _tokenContractAddressToResourceID;

    // token contract address => is whitelisted
    mapping (address => bool) public _contractWhitelist;

    // token contract address => is burnable
    mapping (address => bool) public _burnList;

    // depositNonce => Deposit Record
    mapping (uint256 => DepositRecord) public _depositRecords;

    modifier _onlyBridge() {
        require(msg.sender == _bridgeAddress, "sender must be bridge contract");
        _;
    }

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

    function getDepositRecord(uint256 depositID) public view returns (DepositRecord memory) {
        return _depositRecords[depositID];
    }

    function isWhitelisted(address contractAddress) public view returns (bool) {
        return _contractWhitelist[contractAddress];
    }

    function setBurnable(address contractAddress) public override _onlyBridge {
        _setBurnable(contractAddress);
    }

    function _setBurnable(address contractAddress) internal {
        require(isWhitelisted(contractAddress), "provided contract is not whitelisted");
        _burnList[contractAddress] = true;
    }

    function _setResource(bytes32 resourceID, address contractAddress) internal {
        _resourceIDToTokenContractAddress[resourceID] = contractAddress;
        _tokenContractAddressToResourceID[contractAddress] = resourceID;

        _contractWhitelist[contractAddress] = true;
    }

    function setResource(bytes32 resourceID, address contractAddress) public override _onlyBridge {
        require(_resourceIDToTokenContractAddress[resourceID] == address(0), "resourceID already has a corresponding contract address");

        bytes32 currentResourceID = _tokenContractAddressToResourceID[contractAddress];
        bytes32 emptyBytes;
        require(keccak256(abi.encodePacked((currentResourceID))) == keccak256(abi.encodePacked((emptyBytes))),
            "contract address already has corresponding resourceID");

        _setResource(resourceID, contractAddress);
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

        address originTokenAddress = _resourceIDToTokenContractAddress[resourceID];
        require(isWhitelisted(originTokenAddress), "provided originTokenAddress is not whitelisted");

        if (_burnList[originTokenAddress]) {
            burnERC20(originTokenAddress, depositer, amount);
        } else {
            lockERC20(originTokenAddress, depositer, address(this), amount);
        }

        _depositRecords[depositNonce] = DepositRecord(
            originTokenAddress,
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

        require(isWhitelisted(tokenAddress), "provided tokenAddress is not whitelisted");

        if (_burnList[tokenAddress]) {
            mintERC20(tokenAddress, address(recipientAddress), amount);
        } else {
            releaseERC20(tokenAddress, address(recipientAddress), amount);
        }
    }

    function withdraw(address tokenAddress, address recipient, uint amount) public _onlyBridge {
        releaseERC20(tokenAddress, recipient, amount);
    }
}
