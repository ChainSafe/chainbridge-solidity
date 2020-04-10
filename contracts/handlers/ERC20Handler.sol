pragma solidity 0.6.4;
pragma experimental ABIEncoderV2;

import "../ERC20Safe.sol";
import "../erc/ERC20/ERC20Mintable.sol";
import "../interfaces/IDepositHandler.sol";
import "../interfaces/IBridge.sol";

contract ERC20Handler is IDepositHandler, ERC20Safe {
    address public _bridgeAddress;

    struct DepositRecord {
        address _originChainTokenAddress;
        uint    _destinationChainID;
        bytes32 _tokenID;
        uint    _lenDestinationRecipientAddress;
        bytes   _destinationRecipientAddress;
        address _depositer;
        uint    _amount;
    }

    // tokenID => token contract address
    mapping (bytes32 => address) public _tokenIDToTokenContractAddress;

    // token contract address => tokenID
    mapping (address => bytes32) public _tokenContractAddressToTokenID;

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


    // Make a deposit
    // bytes memory data is laid out as following:
    // originChainTokenAddress     address   - @0x20
    // amount                      uint256   - @0x40
    // destinationRecipientAddress           - @0x60 - END
    function deposit(
        uint256 destinationChainID,
        uint256 depositNonce,
        address depositer,
        bytes memory data
    ) public override _onlyBridge {
        address      originChainTokenAddress;
        bytes memory destinationRecipientAddress;
        uint256      amount;
        uint256      lenDestinationRecipientAddress;

        assembly {
            originChainTokenAddress        := mload(add(data, 0x20))
            amount                         := mload(add(data, 0x40))
            destinationRecipientAddress     := mload(0x40)
            lenDestinationRecipientAddress  := mload(add(0x60, data))
            mstore(0x40, add(0x20, add(destinationRecipientAddress, lenDestinationRecipientAddress)))

            calldatacopy(
                destinationRecipientAddress, // copy to destinationRecipientAddress
                0xE4,                        // copy from calldata @ 0x104
                sub(calldatasize(), 0xE4)    // copy size (calldatasize - 0x104)
            )
        }


        bytes32      tokenID = _tokenContractAddressToTokenID[originChainTokenAddress];
        bytes memory emptyBytes;

        if (keccak256(abi.encodePacked((tokenID))) == keccak256(abi.encodePacked((emptyBytes)))) {
            // The case where we have never seen this token address before

            // If we have never seen this token and someone was able to perform a deposit,
            // it follows that the token is native to the current chain.

            IBridge bridge = IBridge(_bridgeAddress);
            uint8 chainID = uint8(bridge._chainID());

            tokenID = createTokenID(originChainTokenAddress,chainID);

             _tokenContractAddressToTokenID[originChainTokenAddress] = tokenID;
             _tokenIDToTokenContractAddress[tokenID] = originChainTokenAddress;

        }

        lockERC20(originChainTokenAddress, depositer, address(this), amount);

        _depositRecords[depositNonce] = DepositRecord(
            originChainTokenAddress,
            destinationChainID,
            tokenID,
            lenDestinationRecipientAddress,
            destinationRecipientAddress,
            depositer,
            amount
        );
    }

    function createTokenID(address originChainTokenAddress, uint8 chainID) internal pure returns (bytes32) {
        bytes memory encodedTokenID = abi.encode(abi.encodePacked(originChainTokenAddress, chainID));
        bytes32 tokenID;

        assembly {
            tokenID := mload(add(encodedTokenID, 0x20))
        }

        return tokenID;
    }

    function executeDeposit(bytes memory data) public override _onlyBridge {
        uint256       amount;
        bytes32       tokenID;
        bytes  memory destinationRecipientAddress;


        assembly {
            amount                      := mload(add(data, 0x20))
            tokenID                     := mload(add(data, 0x40))

            destinationRecipientAddress         := mload(0x40)
            let lenDestinationRecipientAddress  := mload(add(0x60, data))
            mstore(0x40, add(0x20, add(destinationRecipientAddress, lenDestinationRecipientAddress)))
            
            // in the calldata the destinationRecipientAddress is stored at 0xC4 after accounting for the function signature and length declaration
            calldatacopy(
                destinationRecipientAddress,        // copy to destinationRecipientAddress
                0x84,                               // copy from calldata @ 0x84
                sub(calldatasize(), 0x84)           // copy size to the end of calldata
            )

        }

        bytes20 recipientAddress;
        bytes20 tokenAddress;
        assembly {
            recipientAddress := mload(add(destinationRecipientAddress, 0x20))
            tokenAddress := mload(add(data, 0x4B))
        }


        if (_tokenIDToTokenContractAddress[tokenID] != address(0)) {
            // token exists
            IBridge bridge = IBridge(_bridgeAddress);
            uint256 chainID = bridge._chainID();

            if (uint8(tokenID[31]) == chainID) {
                // token is from same chain
                releaseERC20(address(tokenAddress), address(recipientAddress), amount);
            } else {
                // token is not from chain

                mintERC20(address(tokenAddress), address(recipientAddress), amount);
            }
        } else {
            // Token doesn't exist
            ERC20Mintable erc20 = new ERC20Mintable();
            
            // Create a relationship between the originAddress and the synthetic
            _tokenIDToTokenContractAddress[tokenID] = address(erc20);
            _tokenContractAddressToTokenID[address(erc20)] = tokenID;

            mintERC20(address(erc20), address(recipientAddress), amount);
        }
    }

    function withdraw(address tokenAddress, address recipient, uint amount) public _onlyBridge {
        releaseERC20(tokenAddress, recipient, amount);
    }
}
