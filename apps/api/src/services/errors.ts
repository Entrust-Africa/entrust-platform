import { TransitionError } from "@entrust/gate-engine";

/**
 * - invalid: the request can't be understood or its values aren't allowed (422)
 * - unauthenticated: not signed in (401)
 * - forbidden: signed in, can see the case, but this role can't make the change (403)
 * - not_found: there is no such thing, or the caller can't see it (404)
 * - invalid_transition: the status can't go there from where it is (409)
 * - precondition_failed: allowed, but not yet (422)
 */
export type ServiceErrorCode =
  | "invalid"
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "invalid_transition"
  | "precondition_failed";

const STATUS = {
  invalid: 422,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  invalid_transition: 409,
  precondition_failed: 422,
} as const satisfies Record<ServiceErrorCode, number>;

export class ServiceError extends Error {
  readonly code: ServiceErrorCode;

  constructor(code: ServiceErrorCode, message: string) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
  }

  get status() {
    return STATUS[this.code];
  }
}

/** Run an engine call, turning its refusals into service errors. */
export function fromEngine<T>(run: () => T): T {
  try {
    return run();
  } catch (error) {
    if (error instanceof TransitionError) throw new ServiceError(error.code, error.message);
    if (error instanceof RangeError) throw new ServiceError("invalid", error.message);
    throw error;
  }
}
