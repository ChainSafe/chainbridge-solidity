// pragma solidity 0.6.4;
// pragma experimental ABIEncoderV2;

// import "../ERC721Safe.sol";
// import "../interfaces/IDepositHandler.sol";
// import "../erc/ERC721/ERC721Mintable.sol";
// import "../interfaces/IBridge.sol";

// contract ERC721Handler is IDepositHandler, ERC721Safe {
//     address public _bridgeAddress;

//     struct DepositRecord {
//         address _originChainTokenAddress;
//         uint256 _destinationChainID;
//         bytes   _tokenID;
//         uint    _lenDestinationRecipientAddress;
//         bytes   _destinationRecipientAddress;
//         address _depositer;
//         uint    _nftID;
//         bytes   _metaData;
//     }

//     // DepositID => Deposit Record
//     mapping (uint256 => DepositRecord) public _depositRecords;

//     // tokenID => token contract address
//     mapping (bytes => address) public _tokenIDToTokenContractAddress;

//     // token contract address => tokenID
//     mapping (address => bytes) public _tokenContractAddressToTokenID;

//     modifier _onlyBridge() {
//         require(msg.sender == _bridgeAddress, "sender must be bridge contract");
//         _;
//     }

//     constructor(address bridgeAddress) public {
//         _bridgeAddress = bridgeAddress;
//     }

//     function getDepositRecord(uint256 depositID) public view returns (DepositRecord memory) {
//         return _depositRecords[depositID];
//     }

//     function createTokenID(uint256 chainID, address originChainTokenAddress) internal pure returns (bytes memory) {
//         return abi.encodePacked(chainID, originChainTokenAddress);
//     }

//     function deposit(uint256 destinationChainID, uint256 depositNonce, address depositer, bytes memory data) public override _onlyBridge {
//         address      originChainTokenAddress;
//         uint         lenDestinationRecipientAddress;
//         uint         nftID;
//         bytes memory destinationRecipientAddress;
//         bytes memory metaData;

//         assembly {

//             originChainTokenAddress     := mload(add(data, 0x20))
//             nftID                       := mload(add(data, 0x40))

//             // set up destinationRecipientAddress
//             destinationRecipientAddress     := mload(0x40)              // load free memory pointer
//             lenDestinationRecipientAddress  := mload(add(data, 0x60))

//             // set up metaData
//             let lenMeta    := mload(add(data, add(0x80, lenDestinationRecipientAddress)))


//             mstore(0x40, add(0x40, add(destinationRecipientAddress, lenDestinationRecipientAddress))) // shift free memory pointer

//             calldatacopy(
//                 destinationRecipientAddress,                             // copy to destinationRecipientAddress
//                 0xE4,                                                    // copy from calldata after destinationRecipientAddress length declaration @0xC4
//                 sub(calldatasize(), add(0xE4, add(0x20, lenMeta)))       // copy size (calldatasize - (0xC4 + the space metaData takes up))
//             )

//             // metadata has variable length
//             // load free memory pointer to store metadata
//             metaData := mload(0x40)

//             // incrementing free memory pointer
//             mstore(0x40, add(0x40, add(metaData, lenMeta)))

//             // metadata is located at (0xC4 + 0x20 + lenDestinationRecipientAddress) in calldata
//             let metaDataLoc := add(0x104, lenDestinationRecipientAddress)

//             // in the calldata, metadata is stored @0x124 after accounting for function signature and the depositNonce
//             calldatacopy(
//                 metaData,                           // copy to metaData
//                 metaDataLoc,                       // copy from calldata after metaData length declaration
//                 sub(calldatasize(), metaDataLoc)   // copy size (calldatasize - metaDataLoc)
//             )
//         }

//         bytes memory tokenID = _tokenContractAddressToTokenID[originChainTokenAddress];
//         bytes memory emptyBytes;

//         if (keccak256(abi.encodePacked((tokenID))) == keccak256(abi.encodePacked((emptyBytes)))) {
//             // The case where we have never seen this token address before

//             // If we have never seen this token and someone was able to perform a deposit,
//             // it follows that the token is native to the current chain.

//             IBridge bridge = IBridge(_bridgeAddress);
//             uint chainID = bridge._chainID();

//             tokenID = createTokenID(chainID, originChainTokenAddress);

//              _tokenContractAddressToTokenID[originChainTokenAddress] = tokenID;
//              _tokenIDToTokenContractAddress[tokenID] = originChainTokenAddress;

//         }

//         lockERC721(originChainTokenAddress, depositer, address(this), nftID);

//         _depositRecords[depositNonce] = DepositRecord(
//             originChainTokenAddress,
//             destinationChainID,
//             tokenID,
//             lenDestinationRecipientAddress,
//             destinationRecipientAddress,
//             depositer,
//             nftID,
//             metaData
//         );
//     }

//     function executeDeposit(bytes memory data) public override _onlyBridge {
//         uint256         nftID;
//         bytes  memory   tokenID;
//         bytes  memory   destinationRecipientAddress;
//         bytes  memory   metaData;

//         assembly {
//             nftID                        := mload(add(data, 0x20))


//             // set up destinationRecipientAddress
//             destinationRecipientAddress     := mload(0x40)              // load free memory pointer
//             lenDestinationRecipientAddress  := mload(add(data, 0x60))

//             // set up metaData
//             let lenMeta    := mload(add(data, add(0x80, lenDestinationRecipientAddress)))


//             mstore(0x40, add(0x40, add(destinationRecipientAddress, lenDestinationRecipientAddress))) // shift free memory pointer

//             calldatacopy(
//                 destinationRecipientAddress,                             // copy to destinationRecipientAddress
//                 0xE4,                                                    // copy from calldata after destinationRecipientAddress length declaration @0xC4
//                 sub(calldatasize(), add(0xE4, add(0x20, lenMeta)))       // copy size (calldatasize - (0xC4 + the space metaData takes up))
//             )
//             metaData                     := mload(0x40)
//             let lenextra                 := mload(add(0x80, data))
//             mstore(0x40, add(0x60, add(metaData, lenextra)))

//             // in the calldata the metaData is stored at 0xA4 after accounting for the function signature
//             calldatacopy(
//                 metaData,                  // copy to metaData
//                 0xA4,                      // copy from calldata @ 0xA4
//                 sub(calldatasize(), 0xA4)  // copy size (calldatasize - 0xA0)
//             )

//         }

//         // ERC721Mintable erc721 = ERC721Mintable(destinationChainTokenAddress);
//         // erc721.safeMint(destinationRecipientAddress, nftID, metaData);
//     }

//     function withdraw(address tokenAddress, address recipient, uint tokenID) public _onlyBridge {
//         releaseERC721(tokenAddress, address(this), recipient, tokenID);
//     }
// }
pragma solidity 0.6.4;
pragma experimental ABIEncoderV2;

import "../ERC721Safe.sol";
import "../interfaces/IDepositHandler.sol";
import "../erc/ERC721/ERC721Mintable.sol";

contract ERC721Handler is IDepositHandler, ERC721Safe {
    address public _bridgeAddress;

    struct DepositRecord {
        address _originChainTokenAddress;
        uint256 _destinationChainID;
        address _destinationChainHandlerAddress;
        address _destinationChainTokenAddress;
        address _destinationRecipientAddress;
        address _depositer;
        uint256 _tokenID;
        bytes   _metaData;
    }

    // depositNonce => Deposit Record
    mapping (uint256 => DepositRecord) public _depositRecords;

    modifier _onlyBridge() {
        require(msg.sender == _bridgeAddress, "sender must be bridge contract");
        _;
    }

    constructor(address bridgeAddress) public {
        _bridgeAddress = bridgeAddress;
    }

    function getDepositRecord(uint256 depositNonce) public view returns (DepositRecord memory) {
        return _depositRecords[depositNonce];
    }

    function deposit(uint256 destinationChainID, uint256 depositNonce, address depositer, bytes memory data) public override _onlyBridge {
        address      originChainTokenAddress;
        address      destinationChainHandlerAddress;
        address      destinationChainTokenAddress;
        address      destinationRecipientAddress;
        uint256      tokenID;
        bytes memory metaData;

        assembly {
            // These are all fixed 32 bytes
            // first 32 bytes of bytes is the length
            originChainTokenAddress        := mload(add(data, 0x20))
            destinationChainHandlerAddress := mload(add(data, 0x40))
            destinationChainTokenAddress   := mload(add(data, 0x60))
            destinationRecipientAddress    := mload(add(data, 0x80))
            tokenID                        := mload(add(data, 0xA0))

            // metadata has variable length
            // load free memory pointer to store metadata
            metaData := mload(0x40)
            // first 32 bytes after 0xC0 of variable length in storage refer to length of metadata
            // @NOTE: if the byte array is not encoded like solidity encodes a variable length byte array, there will be unpacking issues
            let lenMeta := mload(add(0xC0, data))

            // incrementing free memory pointer
            mstore(0x40, add(0xA0, add(metaData, lenMeta)))

            // in the calldata, metadata is stored @0x124 after accounting for function signature and the depositNonce
            calldatacopy(
                metaData,                     // copy to metaData
                0x144,                        // copy from calldata after metaData length declaration @0x144
                sub(calldatasize(), 0x144)   // copy size (calldatasize - 0x144)
            )
        }



        lockERC721(originChainTokenAddress, depositer, address(this), tokenID);

        _depositRecords[depositNonce] = DepositRecord(
            originChainTokenAddress,
            destinationChainID,
            destinationChainHandlerAddress,
            destinationChainTokenAddress,
            destinationRecipientAddress,
            depositer,
            tokenID,
            metaData
        );
    }

    function executeDeposit(bytes memory data) public override _onlyBridge {
        address      destinationChainTokenAddress;
        address      destinationRecipientAddress;
        uint256      tokenID;
        bytes memory metaData;

        assembly {
            destinationChainTokenAddress := mload(add(data, 0x20))
            destinationRecipientAddress  := mload(add(data, 0x40))
            tokenID                      := mload(add(data, 0x60))
            metaData                     := mload(0x40)
            let lenextra                 := mload(add(0x80, data))
            mstore(0x40, add(0x60, add(metaData, lenextra)))

            // in the calldata the metaData is stored at 0xA4 after accounting for the function signature
            calldatacopy(
                metaData,                  // copy to metaData
                0xA4,                      // copy from calldata @ 0xA4
                sub(calldatasize(), 0xA4)  // copy size (calldatasize - 0xA0)
            )
        }

        ERC721Mintable erc721 = ERC721Mintable(destinationChainTokenAddress);
        erc721.safeMint(destinationRecipientAddress, tokenID, metaData);
    }

    function withdraw(address tokenAddress, address recipient, uint tokenID) public _onlyBridge {
        releaseERC721(tokenAddress, address(this), recipient, tokenID);
    }
}
