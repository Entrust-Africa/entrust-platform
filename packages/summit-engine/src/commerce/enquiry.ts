// Sponsorship and opportunity enquiries (section 7): an organisation says which sponsorship level or opportunity it is
// interested in, and the organisers take it through a pipeline to a confirmed sponsor or a decline.

export const ENQUIRY_STATUSES = ["new", "contacted", "negotiation", "proposal_sent", "confirmed", "declined"] as const;
export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];

export const ENQUIRY_STATUS_LABELS: Readonly<Record<EnquiryStatus, string>> = {
  new: "New enquiry",
  contacted: "Contacted",
  negotiation: "Negotiation",
  proposal_sent: "Proposal sent",
  confirmed: "Confirmed",
  declined: "Declined",
};

/** Statuses that are still being worked. The pipeline is these. */
export const ENQUIRY_OPEN = ["new", "contacted", "negotiation", "proposal_sent"] as const satisfies readonly EnquiryStatus[];

/**
 * Where an enquiry can go. A conversation doesn't always follow the order (a proposal can be sent before a call), so an
 * open enquiry can move to any other status. A confirmed sponsor can only be declined (they withdrew); a declined enquiry
 * can be reopened.
 */
export const ENQUIRY_TRANSITIONS: Readonly<Record<EnquiryStatus, readonly EnquiryStatus[]>> = {
  new: ["contacted", "negotiation", "proposal_sent", "confirmed", "declined"],
  contacted: ["new", "negotiation", "proposal_sent", "confirmed", "declined"],
  negotiation: ["new", "contacted", "proposal_sent", "confirmed", "declined"],
  proposal_sent: ["new", "contacted", "negotiation", "confirmed", "declined"],
  confirmed: ["declined"],
  declined: ["new", "contacted", "negotiation", "proposal_sent"],
};
