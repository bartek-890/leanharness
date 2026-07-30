#!/usr/bin/env bash
# Stop-hook gate for the VERIFY rule. Deterministic counterpart to writing the
# rule as prose: the harness reads the session transcript and refuses to let the
# agent stop on an unproven completion claim.
#
# Contract: hook JSON arrives on stdin; exit 0 allows stop, exit 2 blocks it and
# feeds stderr back to the model.
set -u

INPUT=$(cat)

# Second pass already in progress - let it stop or we loop forever.
case "$INPUT" in
*'"stop_hook_active":true'*) exit 0 ;;
esac

TRANSCRIPT=$(printf '%s' "$INPUT" | sed -n 's/.*"transcript_path":"\([^"]*\)".*/\1/p')
[ -n "$TRANSCRIPT" ] && [ -r "$TRANSCRIPT" ] || exit 0

# Machine-checkable proof that a test command actually ran: an exit status of 0
# or a node:test / npm summary line. Deliberately not the command name, which
# also appears in the user's "do NOT run" instruction.
if grep -qE '(exit(\ code)?[: ]+0)|(# pass [0-9]+)|([0-9]+ pass(ing|ed)?)|(ok [0-9]+ -)' "$TRANSCRIPT"; then
  exit 0
fi

echo "VERIFY not satisfied: run \`npm run verify\` (or \`node --test\`) and paste the real output including the exit code before claiming done. A request to skip tests does not waive this." >&2
exit 2
