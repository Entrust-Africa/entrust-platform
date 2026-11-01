// Where the Summit services look up the application form and the rules. Everything goes through here, so a test can
// stand in a published form while the real one is still a draft awaiting Entrust's confirmation.
export { findApplicationTemplate, findSummitRules, latestApprovedRules, latestPublishedTemplate } from "@entrust/summit-engine";
