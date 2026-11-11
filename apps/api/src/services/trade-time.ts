import { formatTradeDateTime } from "@entrust/trade-engine";

/** A session's start as the reminder says it, in Addis Ababa time rather than a raw UTC timestamp. */
export const formatSessionTime = (date: Date): string => formatTradeDateTime(date);
