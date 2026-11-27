const LEGACY_DRIZZLE_CHECKSUMS = Object.freeze({
  "0017_milestone8_career_recurring_economy": {
    canonicalHash: "6559a00369a91aab28726ded8ec0580d012324c0d46d74d671d550a40a34d1f8",
    legacyHashes: ["7304141d0897cb4ac6f932e79cbf5e5329017ce80d524400d48bff3d5d9a366"],
  },
  "0060_phone_community_apps": {
    canonicalHash: "6f8cf746efe70b338aabd24fc96652096e43c34aa7702f9c9e872099c9be26f1",
    legacyHashes: ["c51169fce5259a0e3f3eaaf633f19633405211dd764b6fbd2b2814a2b4456d35"],
  },
  "0061_external_news_feed": {
    canonicalHash: "a98dbd7bfb056fcbf4732a31d60fafd5dcbd945e2997144224f9e3e684b2cf64",
    legacyHashes: ["78ab8b75af6f4f39383ac0389dd1482d3910baa8d4db7e3e2f7207726c494eaf"],
  },
  "0068_authoritative_home_presence": {
    canonicalHash: "e4ce78178cfb23e343a89cc58daddb740daebb233af8a516aae0c761068ecaf1",
    legacyHashes: ["e1b932d665f8e9dfea678754a6414153381a895eac76f501b04bef5b339f1bc0"],
  },
  "0070_timed_home_sleep": {
    canonicalHash: "f2f9b51fe50e8a825d57ec6924c558c598e03fe833880662b5d0aed4ec5eadcb",
    legacyHashes: ["e903eaebc9dbead758b445edf35f6090cdc8a24df9f17bdaa5dcb7fe8a175abf"],
  },
});

/**
 * Return historical production checksums only while the current normalized
 * migration content still matches its reviewed Git-canonical checksum.
 */
export function getVerifiedLegacyChecksumHashes(tag, canonicalHash) {
  const reviewed = LEGACY_DRIZZLE_CHECKSUMS[tag];
  if (!reviewed || canonicalHash !== reviewed.canonicalHash) return [];
  return [...reviewed.legacyHashes];
}
