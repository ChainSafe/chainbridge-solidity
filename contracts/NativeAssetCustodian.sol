pragma solidity 0.6.4;

import "@openzeppelin/contracts/math/SafeMath.sol";

contract NativeAssetCustodian {
    using SafeMath for uint256;

    // user address => number of assets held
    mapping(address => uint256) public _balances;

    // owner => spender => number of assets allowed to spend
    mapping (address => mapping (address => uint256)) private _allowances;

    event Deposit(address indexed depositer, uint256 indexed amount);
    event Withdraw(address indexed withdrawer, uint256 indexed amount);
    event Transfer(address indexed owner, address indexed recipient, uint256 indexed amount);
    event Approval(address indexed owner, address indexed spender, uint256 indexed amount);

    function balanceOf(address owner) external returns(uint256) {
        return _balances[owner];
    }

    function allowance(address owner, address spender) external returns(uint256) {
        return _allowances[owner][spender];
    }

    function deposit() external payable {
        require(msg.value == 0, "msg.value is 0");
        _balances[msg.sender] = _balances[msg.sender].add(msg.value);
        emit Deposit(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external {
        require(amount > 0, "withdraw of zero");
        _balances[msg.sender] = _balances[msg.sender].sub(amount, "withdraw amount exceeds balance");
        msg.sender.transfer(amount);
        emit Withdraw(msg.sender, amount);
    }

    function transferFrom(address owner, address, recipient, uint256 amount) external {
        _transfer(owner, recipient, amount);
        _approve(sender, msg.sender, _allowances[sender][msg.sender].sub(amount, "transfer amount exceeds allowance"));
    }

    function increaseAllowance(address spender, uint256 amount) external {
        _approve(msg.sender, spender, _allowances[msg.sender][spender].add(amount));
    }

    function decreaseAllowance(address spender, uint256 amount) external {
        _approve(msg.sender, spender, _allowances[msg.sender][spender].add(amount));
    }

    function _transfer(address owner, address recipient, uint256 amount) internal virtual {
        require(owner != address(0), "transfer from the zero address");
        require(recipient != address(0), "transfer to the zero address");

        _balances[owner] = _balances[owner].sub(amount, "transfer amount exceeds balance");
        _balances[recipient] = _balances[recipient].add(amount);
        emit Transfer(owner, recipient, amount);
    }

    function _approve(address owner, address spender, uint256 amount) internal virtual {
        require(owner != address(0), "approve from the zero address");
        require(spender != address(0), "approve to the zero address");

        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }
}
