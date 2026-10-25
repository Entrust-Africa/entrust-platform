"use client";

import { startTransition, useActionState, type FormEvent, type ReactNode } from "react";
import { Button, cn, type ButtonProps } from "@entrust/ui";
import type { ActionState } from "./actions";

export interface Submit {
  label: string;
  /** Sent with the form when this button submits it, so one form can offer several outcomes. */
  name?: string;
  value?: string;
  variant?: ButtonProps["variant"];
}

type Action = (state: ActionState, form: FormData) => Promise<ActionState>;

/**
 * Runs a Server Action from a form's submit event. Dispatching it ourselves, rather than through
 * the form's action prop, keeps what was typed when the API refuses: React resets a form after its
 * action runs, which would wipe a rejected entry.
 */
export function useActionForm(action: Action) {
  const [state, dispatch, pending] = useActionState(action, { error: null });
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // The clicked button's name and value come along, so one form can offer several outcomes.
    const form = new FormData(event.currentTarget, (event.nativeEvent as SubmitEvent).submitter);
    startTransition(() => dispatch(form));
  };
  return { state, pending, onSubmit };
}

/** A form that runs a Server Action and shows what the API said if it refused. */
export function ActionForm({
  action,
  hidden,
  submits,
  children,
  className,
}: {
  action: Action;
  hidden: Record<string, string>;
  submits: Submit[];
  children?: ReactNode;
  className?: string;
}) {
  const { state, pending, onSubmit } = useActionForm(action);
  return (
    <form onSubmit={onSubmit} className={cn("flex flex-col gap-3", className)} aria-busy={pending || undefined}>
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {children}
      <div className="flex flex-wrap gap-2">
        {submits.map((s) => (
          <Button
            key={s.label}
            type="submit"
            size="sm"
            variant={s.variant ?? "primary"}
            name={s.name}
            value={s.value}
            loading={pending && submits.length === 1}
            disabled={pending && submits.length > 1}
          >
            {s.label}
          </Button>
        ))}
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
