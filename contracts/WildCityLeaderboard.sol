// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title Wild City PH weekly, self-reported top-ten scoreboards
/// @notice Scores are self-reported: game state lives in the browser. Owner-set caps bound abuse,
/// but do not authenticate scores or prevent a player using multiple wallets. No rewards are distributed.
contract WildCityLeaderboard is Ownable {
    struct Entry {
        address player;
        uint128 value;
    }

    struct Board {
        Entry[10] entries;
        uint8 count;
    }

    struct Best {
        uint128 netWorth;
        uint32 reputation;
    }

    error TooSoon(uint256 nextAllowedAt);
    error ScoreAboveCap();
    error InvalidNetWorthCap();

    event ScoreSubmitted(uint256 indexed season, address indexed player, uint256 netWorth, uint32 reputation);
    event CapsUpdated(uint256 maxNetWorth, uint32 maxReputation);

    uint256 public constant SEASON_LENGTH = 7 days;
    uint256 public constant SUBMISSION_INTERVAL = 1 hours;
    uint256 public maxNetWorth = 100_000_000;
    uint32 public maxReputation = 100_000;
    mapping(address player => uint256 timestamp) public lastSubmit;
    mapping(address player => bool submitted) private _hasSubmitted;
    mapping(uint256 season => Board board) private _richest;
    mapping(uint256 season => Board board) private _reputation;
    mapping(uint256 season => mapping(address player => Best best)) private _best;

    constructor(address initialOwner) Ownable(initialOwner) {}

    /// @notice Update both score caps. Existing seasonal bests are not reduced by lower caps.
    function setCaps(uint256 maxNetWorth_, uint32 maxReputation_) external onlyOwner {
        if (maxNetWorth_ > type(uint128).max) revert InvalidNetWorthCap();
        maxNetWorth = maxNetWorth_;
        maxReputation = maxReputation_;
        emit CapsUpdated(maxNetWorth_, maxReputation_);
    }

    /// @notice Submit once per hour per wallet across all seasons. Lower scores do not reduce personal bests.
    /// @dev Even a non-improving valid submission consumes the rate limit and emits its submitted values.
    function submitScore(uint256 netWorth, uint32 reputation) external {
        uint256 nextAllowedAt = lastSubmit[msg.sender] + SUBMISSION_INTERVAL;
        if (_hasSubmitted[msg.sender] && block.timestamp < nextAllowedAt) revert TooSoon(nextAllowedAt);
        if (netWorth > maxNetWorth || reputation > maxReputation) revert ScoreAboveCap();
        lastSubmit[msg.sender] = block.timestamp;
        _hasSubmitted[msg.sender] = true;
        uint256 season = currentSeason();
        Best storage best = _best[season][msg.sender];
        if (netWorth > best.netWorth) best.netWorth = uint128(netWorth);
        if (reputation > best.reputation) best.reputation = reputation;
        _upsert(_richest[season], msg.sender, best.netWorth);
        _upsert(_reputation[season], msg.sender, uint128(best.reputation));
        emit ScoreSubmitted(season, msg.sender, netWorth, reputation);
    }

    /// @notice Season IDs are Unix-time weeks, not weeks since deployment.
    function currentSeason() public view returns (uint256) {
        return block.timestamp / SEASON_LENGTH;
    }

    /// @notice At a season boundary the next season has begun, so this returns a full week.
    function secondsToSeasonEnd() external view returns (uint256) {
        return SEASON_LENGTH - block.timestamp % SEASON_LENGTH;
    }

    /// @notice Return populated entries, descending by value, for any historical or current season.
    /// @dev Ties keep the incumbent's position; a tied outsider cannot replace a full board's last entry.
    function getBoards(uint256 season)
        external view returns (Entry[] memory richest, Entry[] memory reputationBoard)
    {
        richest = _copy(_richest[season]);
        reputationBoard = _copy(_reputation[season]);
    }

    /// @notice Personal seasonal bests, including players outside the top ten.
    function bestOf(uint256 season, address player) external view returns (uint128 netWorth, uint32 reputation) {
        Best storage best = _best[season][player];
        return (best.netWorth, best.reputation);
    }

    function _copy(Board storage board) private view returns (Entry[] memory result) {
        result = new Entry[](board.count);
        for (uint256 i; i < board.count; ++i) result[i] = board.entries[i];
    }

    function _upsert(Board storage board, address player, uint128 value) private {
        uint256 count = board.count;
        uint256 index = count;
        for (uint256 i; i < count; ++i) {
            if (board.entries[i].player == player) {
                index = i;
                break;
            }
        }
        if (index < count) {
            if (value <= board.entries[index].value) return;
        } else if (count < 10) {
            board.count = uint8(count + 1);
        } else {
            if (value <= board.entries[9].value) return;
            index = 9;
        }
        // Shift predecessors down; only upward movement is needed because best values never decrease.
        while (index > 0 && value > board.entries[index - 1].value) {
            board.entries[index] = board.entries[index - 1];
            --index;
        }
        board.entries[index] = Entry(player, value);
    }
}
