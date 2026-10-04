# Build libraries and achievement depth

The next specification review identified missing achievement examples in section 81 and incomplete management of saved formations. Version 0.9.0 implements:

- Named formation libraries with save, load, rename, replace and delete actions; ten slots, unique names, complete tactical snapshots and keyboard focus restoration.
- Ownership and unlock validation for saved vessels, elements, relics, passives, equipment, abilities and recipe priorities. Malformed indices and inherited vessel references cannot change a valid formation.
- Six additional achievements: a first secret, one hundred discoveries, victory without Fire, a guardian defeated with Poison, five Legendary-or-Mythic discoveries and one hundred different battle-tested builds.
- Visible progress and separately persisted, once-only achievement reward claims.
- Persistent build identities based on vessel order and tactical choices. Names, seeds and account power do not create another build; competitive identities include only the two active ability slots. The first one hundred identities are retained, independently of saved-library slots and bounded analytics history.
- Allied status damage attributed to individual enemies, measured as actual health loss after shields and armor and independent of event-log clipping. Poison guardian progress requires a defeated boss to have taken allied Poison tick damage. Reports explain lingering status damage.
- Shared trial settlement for online and local accounts. Defeats and completed-period retries can record a tested formation without minting period rewards; battle identity protects facts from repeated settlement. Replays add no progress.
- Old journals receive empty new battle facts. Historical victories are not inferred from loadouts or analytics. Existing progress and healthy named formations remain available.

Verification: strict TypeScript, content validation and production build; 284 engine/server tests and 60 desktop/mobile browser checks. Campaign reachability remains covered across all 63 locations, and browser tests complete an eight-floor roguelite. The 5,600-battle campaign batch and 280-run / 2,384-battle batch retain their previous outcomes. Formation libraries, achievement progress and Poison damage reports were visually inspected at desktop and mobile sizes.

The five-discovery rarity achievement explicitly accepts Mythic discoveries as well as Legendary ones; the authored catalog has three of each. The specification's illustrative 500-discovery and ten-link-chain targets remain beyond the current authored catalog and ordinary depth limits. They are not presented as earnable achievements. Human campaign pacing, long-term enjoyment, accessibility with assistive technologies and physical-device frame rate remain separate validation work.
