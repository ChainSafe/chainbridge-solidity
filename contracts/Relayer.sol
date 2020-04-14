pragma solidity 0.6.4;

import "./interfaces/IRelayer.sol";
import "./helpers/SafeMath.sol";

contract Relayer is IRelayer {
    using SafeMath for uint;

    uint public _relayerThreshold;
    uint public _totalRelayers;
    RelayerThresholdProposal private _currentRelayerThresholdProposal;

    struct RelayerProposal {
        RelayerActionType        _action;
        mapping(address => bool) _hasVoted;
        address[]                _yesVotes;
        address[]                _noVotes;
        VoteStatus               _status;
    }

    struct RelayerThresholdProposal {
        uint                     _proposedValue;
        mapping(address => bool) _hasVoted;
        address[]                _yesVotes;
        address[]                _noVotes;
        VoteStatus               _status;
    }

    // Relayer Address => whether they are a Relayer
    mapping(address => bool) public _relayers;
    // Relayer Address => RelayerProposal
    mapping(address => RelayerProposal) public _relayerProposals;

    event RelayerProposalCreated(address indexed proposedAddress, RelayerActionType indexed relayerActionType);
    event RelayerProposalVote(address indexed proposedAddress, VoteStatus indexed vote);
    event RelayerAdded(address indexed relayerAddress);
    event RelayerRemoved(address indexed relayerAddress);
    event RelayerThresholdProposalCreated(uint indexed proposedValue);
    event RelayerThresholdProposalVote(Vote indexed vote);
    event RelayerThresholdChanged(uint indexed newThreshold);

    modifier _onlyRelayers() {
        require(_relayers[msg.sender], "sender is not a relayer");
        _;
    }

    constructor (address[] memory initialRelayers, uint initialRelayerThreshold) public {
        for (uint i; i < initialRelayers.length; i++) {
            _addRelayer(initialRelayers[i]);
        }

        _relayerThreshold = initialRelayerThreshold;
    }

    function isRelayer(address relayerAddress) public override returns (bool) {
        return _relayers[relayerAddress];
    }

    function getTotalRelayers() public override returns (uint) {
        return _totalRelayers;
    }

    function getCurrentRelayerThresholdProposal() public view returns (
        uint, address[] memory, address[] memory, VoteStatus) {
        return (
        _currentRelayerThresholdProposal._proposedValue,
        _currentRelayerThresholdProposal._yesVotes,
        _currentRelayerThresholdProposal._noVotes,
        _currentRelayerThresholdProposal._status);
    }

    function getRelayerProposal(address proposedAddress) public view returns (
        RelayerActionType, address[] memory, address[] memory, VoteStatus) {
        RelayerProposal memory relayerProposal = _relayerProposals[proposedAddress];
        return (
            relayerProposal._action,
            relayerProposal._yesVotes,
            relayerProposal._noVotes,
            relayerProposal._status);
    }

    function voteRelayerProposal(address proposedAddress, RelayerActionType action) public override _onlyRelayers {
        RelayerProposal storage relayerProposal = _relayerProposals[proposedAddress];

        require(uint8(action) <= 1, "action out of the action enum range");
        require(relayerProposal._hasVoted[msg.sender] == false, "relayer has already voted on proposal");

        if (action == RelayerActionType.Remove) {
            require(_relayers[proposedAddress], "proposed address is not a relayer");
        } else {
            require(!_relayers[proposedAddress], "proposed address is already a relayer");
        }

        // There is no active proposal for proposedAddress
        if (relayerProposal._status == VoteStatus.Inactive) {
            // Initialize new proposal
            _relayerProposals[proposedAddress] = RelayerProposal({
                _action: action,
                _yesVotes: new address[](1),
                _noVotes: new address[](0),
                _status: VoteStatus.Active
            });

            relayerProposal._yesVotes[0] = msg.sender;
            emit RelayerProposalCreated(proposedAddress, action);
        } else {
            // There is an active proposal for proposedAddress
            relayerProposal._yesVotes.push(msg.sender);
        }

        relayerProposal._hasVoted[msg.sender] = true;
        emit RelayerProposalVote(proposedAddress, relayerProposal._status);

        // If _depositThreshold is set to 1, then auto finalize
        // or if _relayerThreshold has been exceeded
        if (_relayerThreshold <= 1 || relayerProposal._yesVotes.length >= _relayerThreshold) {
            relayerProposal._status = VoteStatus.Inactive;

            if (relayerProposal._action == RelayerActionType.Remove) {
                _removeRelayer(proposedAddress);
                emit RelayerRemoved(proposedAddress);
            } else {
                _addRelayer(proposedAddress);
                emit RelayerAdded(proposedAddress);
            }
        }
    }

    function createRelayerThresholdProposal(uint proposedValue) public override _onlyRelayers {
        require(_currentRelayerThresholdProposal._status == VoteStatus.Inactive, "a proposal is currently active");
        require(proposedValue <= _totalRelayers, "proposed value cannot be greater than the total number of relayers");

        _currentRelayerThresholdProposal = RelayerThresholdProposal({
            _proposedValue: proposedValue,
            _yesVotes: new address[](1),
            _noVotes: new address[](0),
            _status: VoteStatus.Active
            });

        if (_relayerThreshold <= 1) {
            _relayerThreshold = _currentRelayerThresholdProposal._proposedValue;
            _currentRelayerThresholdProposal._status = VoteStatus.Inactive;
            emit RelayerThresholdChanged(proposedValue);
        }
        // Record vote
        _currentRelayerThresholdProposal._yesVotes[0] = msg.sender;
        _currentRelayerThresholdProposal._hasVoted[msg.sender] = true;
        emit RelayerThresholdProposalCreated(proposedValue);
    }

    function voteRelayerThresholdProposal(Vote vote) public override _onlyRelayers {
        require(uint8(vote) <= 1, "vote out of the vote enum range");
        require(_currentRelayerThresholdProposal._status == VoteStatus.Active, "no proposal is currently active");
        require(!_currentRelayerThresholdProposal._hasVoted[msg.sender], "relayer has already voted");

        // Cast vote
        if (vote == Vote.Yes) {
            _currentRelayerThresholdProposal._yesVotes.push(msg.sender);
        } else {
            _currentRelayerThresholdProposal._noVotes.push(msg.sender);
        }

        _currentRelayerThresholdProposal._hasVoted[msg.sender] = true;
        emit RelayerThresholdProposalVote(vote);

        // Todo: Edge case if relayer threshold changes?
        // Todo: For a proposal to pass does the number of yes votes just need to be higher than the threshold, or does it also have to be greater than the number of no votes?
        if (_currentRelayerThresholdProposal._yesVotes.length >= _relayerThreshold) {
            _relayerThreshold = _currentRelayerThresholdProposal._proposedValue;
            _currentRelayerThresholdProposal._status = VoteStatus.Inactive;
            emit RelayerThresholdChanged(_currentRelayerThresholdProposal._proposedValue);
        } else if (_totalRelayers.sub(_currentRelayerThresholdProposal._noVotes.length) < _relayerThreshold) {
            _currentRelayerThresholdProposal._status = VoteStatus.Inactive;
        }
    }

    function _addRelayer(address addr) internal {
        _relayers[addr] = true;
        _totalRelayers++;
        emit RelayerAdded(addr);
    }

    function _removeRelayer(address addr) internal {
        _relayers[addr] = false;
        _totalRelayers--;
        emit RelayerRemoved(addr);
    }
}
