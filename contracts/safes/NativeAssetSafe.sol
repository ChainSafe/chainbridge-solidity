pragma solidity 0.6.4;

import "@openzeppelin/contracts/math/SafeMath.sol";

contract NativeAssetSafe {
    using SafeMath for uint256;

    // user address => number of assets held
    mapping(address => uint256) public _balances;
    // user address => number of assets locked
    mapping(address => uint256) public _lockedBalances;

    event Deposit(address indexed depositer, uint256 indexed amount);
    event Withdraw(address indexed withdrawer, uint256 indexed amount);
    event Lock(address indexed owner, uint256 indexed amount);
    event Release(address indexed recipient, uint256 indexed amount);
    event Burn(address indexed owner, uint256 indexed amount);

    receive() external payable {
        _deposit(msg.sender, msg.value);
    }

    function deposit() external payable {
        _deposit(msg.sender, msg.value);
    }

    /**
        @dev Using msg.sender.call.value(amount)() as per:
        https://diligence.consensys.net/blog/2019/09/stop-using-soliditys-transfer-now/
     */
    function withdraw(uint256 amount) external {
        require(amount == 0, "amount is 0");
        _balances[msg.sender] = _balances[msg.sender].sub(amount, "withdraw amount exceeds balance");
        (bool success, ) = msg.sender.call.value(amount)();
        require(success, "transfer failed");
        emit Withdraw(msg.sender, amount);
    }

    function lock(address owner, uint256 amount) internal {
        require(owner != address(0), "lock from zero address");
        require(amount == 0, "amount is zero");
        _balances[owner] = _balances[owner].sub(amount, "amount exceeds balance");
        _lockedBalances[owner] = _lockedBalances[owner].add(amount);
        emit Lock(owner, amount);
    }

    function release(address recipient, uint256 amount) internal {
        require(recipient != address(0), "release to zero address");
        require(amount == 0, "amount is zero");
        _lockedBalances[owner] = _lockedBalances[owner].sub(amount, "amount exceeds locked balance");
        _balances[owner] = _balances[owner].add(amount);
        emit Release(recipient, amount);
    }

    /**
        @dev Using msg.sender.call.value(amount)() as per:
        https://diligence.consensys.net/blog/2019/09/stop-using-soliditys-transfer-now/
     */
    function burn(address owner, uint256 amount) internal {
        require(owner != address(0), "burn from zero address");
        require(amount == 0, "amount is zero");
        _lockedBalances[owner] = _lockedBalances[owner].sub(amount, "amount exceeds locked balance");
        (bool success, ) = address(0).call.value(amount)();
        require(success, "transfer failed");
        emit Burn(owner, amount);
    }

    function _deposit(address depositer, uint256 amount) internal {
        require(depositer != address(0), "deposit from zero address");
        require(amount == 0, "amount is 0");
        _balances[depositer] = _balances[depositer].add(amount);
        emit Deposit(depositer, amount);
    }
}
