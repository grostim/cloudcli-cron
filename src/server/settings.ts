import type { ExecutionCapability, ExecutionProfile } from "../shared/model.js";

export function createExecutionProfile(input: {
  workspaceKey: string;
  command: string;
  args: string[];
  timeoutMs?: number;
}): ExecutionProfile {
  const command = input.command.trim();
  const args = input.args.map((entry) => entry.trim()).filter(Boolean);
  return {
    workspaceKey: input.workspaceKey,
    command,
    args,
    timeoutMs: input.timeoutMs ?? 300000,
    mode: "local_command",
    lastValidatedAt: new Date().toISOString(),
    validationStatus: command ? "ready" : "invalid"
  };
}

export function resolveExecutionCapability(profile: ExecutionProfile | null): ExecutionCapability {
  if (!profile) {
    return {
      status: "needs_config",
      message: "Configure a local execution command to enable automatic prompt runs."
    };
  }

  if (profile.mode !== "local_command") {
    return {
      status: "unsupported",
      message: "Automatic execution is unavailable for this deployment mode."
    };
  }

  if (!profile.command) {
    return {
      status: "invalid",
      message: "Local execution settings are incomplete."
    };
  }

  return {
    status: "ready",
    message: `Local execution is ready via "${profile.command}".`
  };
}
