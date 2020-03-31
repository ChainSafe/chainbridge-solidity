pragma solidity 0.6.4;
pragma experimental ABIEncoderV2;

import "../ERC20Safe.sol";
import "../erc/ERC20/ERC20Mintable.sol";
import "../interfaces/IDepositHandler.sol";

contract ERC20Handler is IDepositHandler, ERC20Safe {
    address public _bridgeAddress;

    struct DepositRecord {
        address _originChainTokenAddress;
        uint    _destinationChainID;
        address _destinationChainHandlerAddress;
        address _destinationChainTokenAddress;
        address _destinationRecipientAddress;
        address _depositer;
        uint    _amount;
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

    function deposit(
        uint256 destinationChainID,
        uint256 depositNonce,
        address depositer,
        bytes memory data
    ) public override _onlyBridge {
        address originChainTokenAddress;
        address destinationChainHandlerAddress;
        address destinationChainTokenAddress;
        address destinationRecipientAddress;
        uint256 amount;

        assembly {
            originChainTokenAddress        := mload(add(data, 0x20))
            destinationChainHandlerAddress := mload(add(data, 0x40))
            destinationChainTokenAddress   := mload(add(data, 0x60))
            destinationRecipientAddress    := mload(add(data, 0x80))
            amount                         := mload(add(data, 0xA0))
        }

        lockERC20(originChainTokenAddress, depositer, address(this), amount);

        _depositRecords[depositNonce] = DepositRecord(
            originChainTokenAddress,
            destinationChainID,
            destinationChainHandlerAddress,
            destinationChainTokenAddress,
            destinationRecipientAddress,
            depositer,
            amount
        );
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
