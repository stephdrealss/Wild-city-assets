// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title Wild City PH non-escrow, zero-fee USDC marketplace
/// @dev Collections are fixed at construction. Listings may become stale after transfers or approval revocation.
/// USDC moves directly from buyer to seller; the marketplace never takes a fee or custody of listed NFTs.
contract WildCityMarketplace is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Listing {
        address seller;
        address nft;
        uint256 tokenId;
        uint256 price;
    }

    error InvalidUSDC();
    error InvalidCollection(address nft);
    error CollectionNotAllowed(address nft);
    error NotTokenOwner();
    error InvalidPrice();
    error MarketplaceNotApproved();
    error ListingNotFound();
    error NotSeller();
    error StaleListing();
    error PriceAboveMaximum(uint256 price, uint256 maxPrice);
    error SelfPurchase();

    event Listed(address indexed seller, address indexed nft, uint256 indexed tokenId, uint256 price);
    event Cancelled(address indexed seller, address indexed nft, uint256 indexed tokenId);
    event Sold(address indexed seller, address indexed buyer, address indexed nft, uint256 tokenId, uint256 price);

    IERC20 public immutable usdc;
    uint256 public constant MAX_PAGE_SIZE = 100;
    mapping(address nft => bool allowed) private _allowedCollections;
    mapping(bytes32 key => Listing listing) public listings;
    bytes32[] private _activeKeys;
    mapping(bytes32 key => uint256 indexPlusOne) private _keyIndex;

    constructor(address usdc_, address[] memory allowedCollections) {
        if (usdc_ == address(0) || usdc_.code.length == 0) revert InvalidUSDC();
        usdc = IERC20(usdc_);
        for (uint256 i; i < allowedCollections.length; ++i) {
            address nft = allowedCollections[i];
            if (nft == address(0) || nft.code.length == 0) revert InvalidCollection(nft);
            _allowedCollections[nft] = true;
        }
    }

    /// @notice Whether a collection was allowed at construction; there is no setter.
    function isCollectionAllowed(address nft) external view returns (bool) {
        return _allowedCollections[nft];
    }

    /// @notice Stable storage key for a collection/token pair.
    function listingKey(address nft, uint256 tokenId) public pure returns (bytes32) {
        return keccak256(abi.encode(nft, tokenId));
    }

    /// @notice List or replace a listing as the current owner, retaining NFT custody.
    function list(address nft, uint256 tokenId, uint256 price) external nonReentrant {
        if (!_allowedCollections[nft]) revert CollectionNotAllowed(nft);
        if (price == 0) revert InvalidPrice();
        IERC721 collection = IERC721(nft);
        if (collection.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        if (collection.getApproved(tokenId) != address(this)
            && !collection.isApprovedForAll(msg.sender, address(this))) revert MarketplaceNotApproved();
        bytes32 key = listingKey(nft, tokenId);
        if (_keyIndex[key] == 0) {
            _activeKeys.push(key);
            _keyIndex[key] = _activeKeys.length;
        }
        listings[key] = Listing(msg.sender, nft, tokenId, price);
        emit Listed(msg.sender, nft, tokenId, price);
    }

    /// @notice Seller may cancel at any time; anyone may remove a listing whose seller is no longer owner.
    /// @dev A reverting ownerOf (for example a burned NFT) also permits stale cleanup.
    function cancel(address nft, uint256 tokenId) external nonReentrant {
        bytes32 key = listingKey(nft, tokenId);
        Listing memory item = listings[key];
        if (item.seller == address(0)) revert ListingNotFound();
        if (msg.sender != item.seller) {
            bool stillOwned;
            try IERC721(nft).ownerOf(tokenId) returns (address currentOwner) {
                stillOwned = currentOwner == item.seller;
            } catch {}
            if (stillOwned) revert NotSeller();
        }
        _remove(key);
        emit Cancelled(item.seller, nft, tokenId);
    }

    /// @notice Buy for at most maxPrice. Approve this marketplace for the required USDC first.
    /// @dev Removes the listing before transfers. Any payment or NFT transfer failure rolls everything back.
    function buy(address nft, uint256 tokenId, uint256 maxPrice) external nonReentrant {
        bytes32 key = listingKey(nft, tokenId);
        Listing memory item = listings[key];
        if (item.seller == address(0)) revert ListingNotFound();
        if (IERC721(nft).ownerOf(tokenId) != item.seller) revert StaleListing();
        if (item.price > maxPrice) revert PriceAboveMaximum(item.price, maxPrice);
        if (msg.sender == item.seller) revert SelfPurchase();
        _remove(key);
        usdc.safeTransferFrom(msg.sender, item.seller, item.price);
        IERC721(nft).safeTransferFrom(item.seller, msg.sender, tokenId);
        emit Sold(item.seller, msg.sender, nft, tokenId, item.price);
    }

    /// @notice Number of stored listings, including listings that have become stale.
    function listingCount() external view returns (uint256) {
        return _activeKeys.length;
    }

    /// @notice Page stored listings; limit is clamped to 100. Swap-and-pop means order can change between calls.
    function getListings(uint256 offset, uint256 limit) external view returns (Listing[] memory page) {
        uint256 count = _activeKeys.length;
        if (offset >= count) return new Listing[](0);
        if (limit > MAX_PAGE_SIZE) limit = MAX_PAGE_SIZE;
        uint256 remaining = count - offset;
        if (limit > remaining) limit = remaining;
        page = new Listing[](limit);
        for (uint256 i; i < limit; ++i) {
            page[i] = listings[_activeKeys[offset + i]];
        }
    }

    function _remove(bytes32 key) private {
        uint256 index = _keyIndex[key] - 1;
        uint256 lastIndex = _activeKeys.length - 1;
        if (index != lastIndex) {
            bytes32 moved = _activeKeys[lastIndex];
            _activeKeys[index] = moved;
            _keyIndex[moved] = index + 1;
        }
        _activeKeys.pop();
        delete _keyIndex[key];
        delete listings[key];
    }
}
