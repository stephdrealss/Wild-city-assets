// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {WildCityCatalogNFT} from "./WildCityCatalogNFT.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title Wild City PH properties and prefunded USDC yield
/// @dev Yield is not guaranteed: claims revert atomically when the pool is insufficient.
/// No owner withdrawal exists. Transfers preserve the previous owner's accrued yield as credit.
contract WildCityProperty is WildCityCatalogNFT {
    using SafeERC20 for IERC20;

    error InsufficientYieldPool();
    error TooManyTokens();
    error NotTokenOwner(uint256 tokenId);
    error NoYield();
    error ZeroFunding();

    event YieldClaimed(address indexed player, uint256 amount);
    event PoolFunded(address indexed funder, uint256 amount);

    uint256 public constant MAX_CLAIM_TOKENS = 50;
    uint256 public constant MAX_ACCRUAL = 7 days;
    mapping(uint256 tokenId => uint256 timestamp) public lastClaim;
    mapping(address player => uint256 amount) public credit;

    constructor(address usdc, address initialOwner)
        WildCityCatalogNFT("Wild City PH Property", "WCPROP", usdc, initialOwner)
    {
        _addType("Rented Room", 1_000000, 0, 500, 0);
        _addType("Apartment", 3_000000, 0, 300, 0);
        _addType("Beach House", 6_000000, 0, 100, 0);
        _addType("Market Stall", 2_000000, 80000, 400, 1);
        _addType("Barber Shop", 4_000000, 200000, 200, 2);
        _addType("Phone Repair Shop", 5_000000, 280000, 150, 2);
        _addType("Neon Lounge", 9_000000, 600000, 60, 2);
    }

    /// @notice Claim up to 50 owned tokens plus all transfer credit. An empty array claims credit alone.
    /// @dev Duplicate IDs cannot double claim; each timestamp is reset before the next iteration.
    function claimYield(uint256[] calldata tokenIds) external nonReentrant {
        if (tokenIds.length > MAX_CLAIM_TOKENS) revert TooManyTokens();
        uint256 total = credit[msg.sender];
        credit[msg.sender] = 0;
        for (uint256 i; i < tokenIds.length; ++i) {
            uint256 tokenId = tokenIds[i];
            if (ownerOf(tokenId) != msg.sender) revert NotTokenOwner(tokenId);
            total += _accrued(tokenId);
            lastClaim[tokenId] = block.timestamp;
        }
        if (total == 0) revert NoYield();
        if (usdc.balanceOf(address(this)) < total) revert InsufficientYieldPool();
        usdc.safeTransfer(msg.sender, total);
        emit YieldClaimed(msg.sender, total);
    }

    /// @notice Total currently claimable yield plus preserved transfer credit.
    function pendingYield(address player) external view returns (uint256 total) {
        total = credit[player];
        uint256 count = balanceOf(player);
        for (uint256 i; i < count; ++i) {
            total += _accrued(tokenOfOwnerByIndex(player, i));
        }
    }

    /// @notice Donate approved USDC to the yield pool; anyone may fund it.
    function fundPool(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroFunding();
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit PoolFunded(msg.sender, amount);
    }

    function _accrued(uint256 tokenId) internal view returns (uint256) {
        uint256 elapsed = block.timestamp - lastClaim[tokenId];
        if (elapsed > MAX_ACCRUAL) elapsed = MAX_ACCRUAL;
        return uint256(_types[typeOf[tokenId]].param) * elapsed / 1 days;
    }

    /// @dev super authorizes and updates enumeration without external calls; safe-transfer callbacks occur afterwards.
    function _update(address to, uint256 tokenId, address auth) internal override returns (address from) {
        from = super._update(to, tokenId, auth);
        if (from != address(0) && to != address(0)) {
            credit[from] += _accrued(tokenId);
        }
        lastClaim[tokenId] = block.timestamp;
    }
}
