pragma solidity 0.6.4;

import "@openzeppelin/contracts/math/SafeMath.sol";

/**
    @title Manages deposited native assets.
    @author ChainSafe Systems.
    @notice This contract is intended to be used with NativeAssetHandler contract.
 */
contract NativeAssetSafe {
    using SafeMath for uint256;

    // user address => number of assets held
    mapping(address => uint256) public _availableBalances;
    // user address => number of assets locked
    mapping(address => uint256) public _lockedBalances;

    event Deposit(address indexed depositer, uint256 indexed amount);
    event Withdraw(address indexed withdrawer, uint256 indexed amount);
    event Lock(address indexed owner, uint256 indexed amount);
    event Release(address indexed recipient, uint256 indexed amount);
    event Burn(address indexed owner, uint256 indexed amount);

    /**
        @notice Fallback function for this contract will be treated
        as a deposit.
        @notice Increases {_availableBalances[msg.sender]} by {msg.value}
     */
    receive() external payable {
        _depositNative(msg.sender, msg.value);
    }

    /**
        @notice Increases {_availableBalances[msg.sender]} by {msg.value}
     */
    function depositNative() external payable {
        _depositNative(msg.sender, msg.value);
    }

    /**
        @notice Withdraws {amount} from {_availableBalances[msg.sender]}.
        @dev Using msg.sender.call.value(amount)() as per:
        https://diligence.consensys.net/blog/2019/09/stop-using-soliditys-transfer-now/
        @param amount Amount of assets to withdraw.
     */
    function withdrawNative(uint256 amount) external {
        _withdrawNative(msg.sender, msg.sender, amount);
    }

    /**

     */
    function lockNative(address owner, uint256 amount) internal {
        require(owner != address(0), "lock from zero address");
        require(amount != 0, "amount is zero");
        _availableBalances[owner] = _availableBalances[owner].sub(amount, "amount exceeds balance");
        _lockedBalances[owner] = _lockedBalances[owner].add(amount);
        emit Lock(owner, amount);
    }

    function releaseNative(address owner, address recipient, uint256 amount) internal {
        require(recipient != address(0), "release to zero address");
        require(amount != 0, "amount is zero");
        _lockedBalances[owner] = _lockedBalances[owner].sub(amount, "amount exceeds locked balance");
        _availableBalances[owner] = _availableBalances[owner].add(amount);
        emit Release(recipient, amount);
    }

    /**
        @dev Using msg.sender.call.value(amount)() as per:
        https://diligence.consensys.net/blog/2019/09/stop-using-soliditys-transfer-now/
     */
    function burnNative(address owner, uint256 amount) internal {
        require(owner != address(0), "burn from zero address");
        require(amount != 0, "amount is zero");
        _lockedBalances[owner] = _lockedBalances[owner].sub(amount, "amount exceeds locked balance");
        (bool success, ) = address(0).call.value(amount)("");
        require(success, "transfer failed");
        emit Burn(owner, amount);
    }

    function _depositNative(address depositer, uint256 amount) internal {
        require(depositer != address(0), "deposit from zero address");
        require(amount != 0, "amount is 0");
        _availableBalances[depositer] = _availableBalances[depositer].add(amount);
        emit Deposit(depositer, amount);
    }

    function _withdrawNative(address owner, address recipient, uint256 amount) internal {
        require(amount != 0, "amount is 0");
        _availableBalances[owner] = _availableBalances[owner].sub(amount, "withdraw amount exceeds balance");
        (bool success, ) = recipient.call.value(amount)("");
        require(success, "transfer failed");
        emit Withdraw(owner, amount);
    }
}
