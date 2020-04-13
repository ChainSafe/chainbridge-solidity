pragma solidity 0.6.4;
pragma experimental ABIEncoderV2;

import "../ERC721Safe.sol";
import "../interfaces/IDepositHandler.sol";
import "../erc/ERC721/ERC721Mintable.sol";
import "../interfaces/IBridge.sol";

contract ERC721Handler is IDepositHandler, ERC721Safe {
    address public _bridgeAddress;

    struct DepositRecord {
        address _originChainTokenAddress;
        uint8   _destinationChainID;
        bytes32 _resourceID;
        uint    _lenDestinationRecipientAddress;
        bytes   _destinationRecipientAddress;
        address _depositer;
        uint    _tokenID;
        bytes   _metaData;
    }

    // DepositID => Deposit Record
    mapping (uint256 => DepositRecord) public _depositRecords;

    // resourceID => token contract address
    mapping (bytes32 => address) public _resourceIDToTokenContractAddress;

    // token contract address => resourceID
    mapping (address => bytes32) public _tokenContractAddressToResourceID;

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

    function createResourceID (address originChainTokenAddress, uint8 chainID) internal pure returns (bytes32) {
        bytes memory encodedResourceID = abi.encode(abi.encodePacked(originChainTokenAddress, chainID));
        bytes32 resourceID;

        assembly {
            resourceID := mload(add(encodedResourceID, 0x20))
        }

        return resourceID;
    }


    function deposit(uint8 destinationChainID, uint256 depositNonce, address depositer, bytes memory data) public override _onlyBridge {
        address      originChainTokenAddress;
        uint         lenDestinationRecipientAddress;
        uint         tokenID;
        bytes memory destinationRecipientAddress;
        bytes memory metaData;

        assembly {

            originChainTokenAddress     := mload(add(data, 0x20))
            tokenID                       := mload(add(data, 0x40))

            // set up destinationRecipientAddress
            destinationRecipientAddress     := mload(0x40)              // load free memory pointer
            lenDestinationRecipientAddress  := mload(add(data, 0x60))

            // set up metaData
            let lenMeta    := mload(add(data, add(0x80, lenDestinationRecipientAddress)))


            mstore(0x40, add(0x40, add(destinationRecipientAddress, lenDestinationRecipientAddress))) // shift free memory pointer

            calldatacopy(
                destinationRecipientAddress,                             // copy to destinationRecipientAddress
                0xE4,                                                    // copy from calldata after destinationRecipientAddress length declaration @0xC4
                sub(calldatasize(), add(0xE4, add(0x20, lenMeta)))       // copy size (calldatasize - (0xC4 + the space metaData takes up))
            )

            // metadata has variable length
            // load free memory pointer to store metadata
            metaData := mload(0x40)

            // incrementing free memory pointer
            mstore(0x40, add(0x40, add(metaData, lenMeta)))

            // metadata is located at (0xC4 + 0x20 + lenDestinationRecipientAddress) in calldata
            let metaDataLoc := add(0x104, lenDestinationRecipientAddress)

            // in the calldata, metadata is stored @0x124 after accounting for function signature and the depositNonce
            calldatacopy(
                metaData,                           // copy to metaData
                metaDataLoc,                       // copy from calldata after metaData length declaration
                sub(calldatasize(), metaDataLoc)   // copy size (calldatasize - metaDataLoc)
            )
        }

        bytes32 resourceID = _tokenContractAddressToResourceID[originChainTokenAddress];
        bytes memory emptyBytes;

        if (keccak256(abi.encodePacked((resourceID))) == keccak256(abi.encodePacked((emptyBytes)))) {
            // The case where we have never seen this token address before

            // If we have never seen this token and someone was able to perform a deposit,
            // it follows that the token is native to the current chain.

            IBridge bridge = IBridge(_bridgeAddress);
            uint8 chainID = bridge._chainID();

            resourceID = createResourceID(originChainTokenAddress, chainID);

             _tokenContractAddressToResourceID[originChainTokenAddress] = resourceID;
             _resourceIDToTokenContractAddress[resourceID] = originChainTokenAddress;

        }

        lockERC721(originChainTokenAddress, depositer, address(this), tokenID);

        _depositRecords[depositNonce] = DepositRecord(
            originChainTokenAddress,
            uint8(destinationChainID),
            resourceID,
            lenDestinationRecipientAddress,
            destinationRecipientAddress,
            depositer,
            tokenID,
            metaData
        );
    }

    function executeDeposit(bytes memory data) public override _onlyBridge {
        uint256         tokenID;
        bytes32         resourceID;
        bytes  memory   destinationRecipientAddress;
        bytes  memory   metaData;

        assembly {
            tokenID                        := mload(add(data, 0x20))
            resourceID                     := mload(add(data, 0x40))


            // set up destinationRecipientAddress
            destinationRecipientAddress     := mload(0x40)              // load free memory pointer
            let lenDestinationRecipientAddress  := mload(add(data, 0x60))

            // set up metaData
            let lenMeta    := mload(add(data, add(0x80, lenDestinationRecipientAddress)))


            mstore(0x40, add(0x40, add(destinationRecipientAddress, lenDestinationRecipientAddress))) // shift free memory pointer

            calldatacopy(
                destinationRecipientAddress,                             // copy to destinationRecipientAddress
                0x84,                                                    // copy from calldata after destinationRecipientAddress length declaration @0x84
                sub(calldatasize(), add(0x84, add(0x20, lenMeta)))       // copy size (calldatasize - (0xC4 + the space metaData takes up))
            )

            // metadata has variable length
            // load free memory pointer to store metadata
            metaData := mload(0x40)

            // incrementing free memory pointer
            mstore(0x40, add(0x40, add(metaData, lenMeta)))

            // metadata is located at (0x84 + 0x20 + lenDestinationRecipientAddress) in calldata
            let metaDataLoc := add(0xA4, lenDestinationRecipientAddress)

            // in the calldata, metadata is stored @0x124 after accounting for function signature and the depositNonce
            calldatacopy(
                metaData,                           // copy to metaData
                metaDataLoc,                       // copy from calldata after metaData length declaration
                sub(calldatasize(), metaDataLoc)   // copy size (calldatasize - metaDataLoc)
            )

        }

        bytes20 recipientAddress;
        bytes20 tokenAddress;

        assembly {
            recipientAddress := mload(add(destinationRecipientAddress, 0x20))
            tokenAddress := mload(add(data, 0x4B))
        }


        if (_resourceIDToTokenContractAddress[resourceID] != address(0)) {
            // token exists
            IBridge bridge = IBridge(_bridgeAddress);
            uint8 chainID = bridge._chainID();

            if (uint8(resourceID[31]) == chainID) {
                // token is from same chain
                releaseERC721(address(tokenAddress), address(this), address(recipientAddress), tokenID);
            } else {
                // token is not from chain

                ERC721Mintable erc721 = ERC721Mintable(address(tokenAddress));
                erc721.safeMint(address(recipientAddress), tokenID, metaData);
            }
        } else {
            // Token doesn't exist
            ERC721Mintable erc721 = new ERC721Mintable();
            
            // Create a relationship between the originAddress and the synthetic
            _resourceIDToTokenContractAddress[resourceID] = address(erc721);
            _tokenContractAddressToResourceID[address(erc721)] = resourceID;

            erc721.safeMint(address(recipientAddress), tokenID, metaData);
        }
    }

    function withdraw(address tokenAddress, address recipient, uint tokenID) public _onlyBridge {
        releaseERC721(tokenAddress, address(this), recipient, tokenID);
    }
}

