pragma solidity 0.6.4;
pragma experimental ABIEncoderV2;

import "../ERC20Safe.sol";
import "../erc/ERC20/ERC20Mintable.sol";
import "../interfaces/IDepositHandler.sol";
import "../interfaces/IBridge.sol";

contract ERC20Handler is IDepositHandler, ERC20Safe {
    address public _bridgeAddress;

    // struct DepositRecord {
    //     address _originChainTokenAddress;
    //     uint    _destinationChainID;
    //     address _destinationChainHandlerAddress;
    //     address _destinationChainTokenAddress;
    //     address _destinationRecipientAddress;
    //     address _depositer;
    //     uint    _amount;
    // }

    struct DepositRecord {
        address _originChainTokenAddress;
        uint    _destinationChainID;
        string  _tokenID;
        address _destinationRecipientAddress;
        address _depositer;
        uint    _amount;
    }

    // tokenID => token contract address
    mapping (string => address) public _tokenIDToTokenContractAddress;

    // token contract address => tokenID
    mapping (address => string) public _tokenContractAddressToTokenID;

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
    // destinationRecipientAddress address   - @0x40
    // amount                      uint256   - @0x60
    function deposit(
        uint256 destinationChainID,
        uint256 depositNonce,
        address depositer,
        bytes memory data
    ) public override _onlyBridge {
        address originChainTokenAddress;
        address destinationRecipientAddress;
        uint256 amount;

        assembly {
            originChainTokenAddress        := mload(add(data, 0x20))
            destinationRecipientAddress    := mload(add(data, 0x40))
            amount                         := mload(add(data, 0x60))
        }

        string memory tokenID = _tokenContractAddressToTokenID[originChainTokenAddress];

        if (keccak256(abi.encodePacked(tokenID)) == keccak256(abi.encodePacked(""))) {
            // The case where we have never seen this token address before

            // If we have never seen this token and someone was able to perform a deposit,
            // it follows that the token is native to the current chain.

            IBridge bridge = IBridge(_bridgeAddress); 
            uint chainID = bridge.get_chainID();
            
            tokenID = createTokenID(chainID, originChainTokenAddress);

             _tokenContractAddressToTokenID[originChainTokenAddress] = tokenID;
             _tokenIDToTokenContractAddress[tokenID] = originChainTokenAddress; 

        }

        lockERC20(originChainTokenAddress, depositer, address(this), amount);

        _depositRecords[depositNonce] = DepositRecord(
            originChainTokenAddress,
            destinationChainID,
            tokenID,
            destinationRecipientAddress,
            depositer,
            amount
        );
    }

    function createTokenID(uint256 chainID, address originChainTokenAddress) internal returns (string memory) {
        return string(abi.encodePacked(chainID, originChainTokenAddress));
    }

    // TODO If any address can call this, anyone can mint tokens
    function executeDeposit(bytes memory data) public override _onlyBridge {
        address destinationChainTokenAddress;
        address destinationRecipientAddress;
        uint256 amount;

        assembly {
            destinationChainTokenAddress := mload(add(data, 0x20))
            destinationRecipientAddress  := mload(add(data, 0x40))
            amount                       := mload(add(data, 0x60))
        }

        ERC20Mintable erc20 = ERC20Mintable(destinationChainTokenAddress);
        erc20.mint(destinationRecipientAddress, amount);
    }

    function withdraw(address tokenAddress, address recipient, uint amount) public _onlyBridge {
        releaseERC20(tokenAddress, address(this), recipient, amount);
    }
}
