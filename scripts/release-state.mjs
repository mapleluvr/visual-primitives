function assertLocalMetadata(local) {
  for (const key of ["name", "version", "integrity", "shasum"]) {
    if (typeof local?.[key] !== "string" || local[key].length === 0) {
      throw new Error(`local package metadata is missing ${key}`);
    }
  }
}

export function decideNpmPublish(local, published) {
  assertLocalMetadata(local);
  if (published === null) {
    return { action: "publish", reason: "version-unpublished" };
  }
  if (published?.name !== local.name || published?.version !== local.version) {
    throw new Error(`published package identity mismatch for ${local.name}@${local.version}`);
  }
  const integrityMatches = published?.dist?.integrity === local.integrity;
  const shasumMatches = published?.dist?.shasum === local.shasum;
  if (!integrityMatches || !shasumMatches) {
    throw new Error(`${local.name}@${local.version} already exists with different integrity`);
  }
  return {
    action: "skip-identical",
    reason: "version-already-published-with-matching-integrity",
  };
}
