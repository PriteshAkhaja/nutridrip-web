/** The id of a zone's card, which the pincode check's answer links to. Shared by the server list and the client check. */
export const zoneAnchor = (z: { id?: string; name: string }) =>
  `zone-${z.id ?? z.name.replace(/\W+/g, "-").toLowerCase()}`;
