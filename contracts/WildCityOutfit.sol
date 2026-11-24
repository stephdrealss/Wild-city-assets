// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {WildCityCatalogNFT} from "./WildCityCatalogNFT.sol";

/// @title Wild City PH outfits, hairstyles and accessories
/// @dev Categories: 0 outfit, 1 hairstyle, 2 accessory. param is unused (zero).
contract WildCityOutfit is WildCityCatalogNFT {
    constructor(address usdc, address initialOwner)
        WildCityCatalogNFT("Wild City PH Outfit", "WCFIT", usdc, initialOwner)
    {
        _addType("Sunset Kaftan", 800000, 0, 5000, 0);
        _addType("Ocean Bubu", 800000, 0, 5000, 0);
        _addType("Neon Bomber", 1_200000, 0, 5000, 0);
        _addType("Kente Crop Set", 1_500000, 0, 5000, 0);
        _addType("Lagoon Linen", 1_000000, 0, 5000, 0);
        _addType("Midnight Racer", 2_000000, 0, 5000, 0);
        _addType("Twin Puffs", 500000, 0, 5000, 1);
        _addType("Box Braids", 700000, 0, 5000, 1);
        _addType("Curl Crown", 700000, 0, 5000, 1);
        _addType("Gold Chain", 600000, 0, 5000, 2);
        _addType("Bucket Hat", 500000, 0, 5000, 2);
        _addType("Sling Backpack", 600000, 0, 5000, 2);
    }
}
