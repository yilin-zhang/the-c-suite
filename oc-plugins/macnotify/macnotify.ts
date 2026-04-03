import { basename, dirname, join } from "node:path"
import { homedir } from "node:os"
import { access, mkdir, readFile, writeFile } from "node:fs/promises"
import { constants } from "node:fs"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { tool } from "@opencode-ai/plugin"

type NotifyOnConfig = {
  sessionIdle: boolean
  sessionError: boolean
  permissionAsked: boolean
  todoUpdated: boolean
}

type SoundsConfig = {
  sessionIdle: string
  sessionError: string
  permissionAsked: string
  todoUpdated: string
}

type MacnotifyConfig = {
  enabled: boolean
  titlePrefix: string
  includeProjectName: boolean
  cooldownMs: number
  notifyOn: NotifyOnConfig
  sounds: SoundsConfig
}

type ConfigOverride = Partial<Omit<MacnotifyConfig, "notifyOn" | "sounds">> & {
  notifyOn?: Partial<NotifyOnConfig>
  sounds?: Partial<SoundsConfig>
}

type EventType = "session.idle" | "session.error" | "permission.asked" | "todo.updated"

type EventConfigEntry = {
  enabledKey: keyof NotifyOnConfig
  soundKey: keyof SoundsConfig
  message: string
}

type PluginProject = {
  name?: string
  path?: string
}

type PluginClient = {
  app: {
    log(input: {
      body: {
        service: string
        level: "info" | "warn"
        message: string
        extra?: Record<string, unknown>
      }
    }): Promise<unknown>
  }
}

type SettingsArgs = {
  action: "get" | "set"
  scope: "global" | "project"
  enabled?: boolean
  titlePrefix?: string
  includeProjectName?: boolean
  cooldownMs?: number
  notifyOnSessionIdle?: boolean
  notifyOnSessionError?: boolean
  notifyOnPermissionAsked?: boolean
  notifyOnTodoUpdated?: boolean
  soundSessionIdle?: string
  soundSessionError?: string
  soundPermissionAsked?: string
  soundTodoUpdated?: string
}

type ToolContext = {
  directory: string
}

type HookEvent = {
  type?: string
  error?: { message?: string }
  message?: string
  permission?: string
  tool?: string
  name?: string
}

const execFileAsync = promisify(execFile)

const DEFAULT_CONFIG: MacnotifyConfig = {
  enabled: true,
  titlePrefix: "OpenCode",
  includeProjectName: true,
  cooldownMs: 5000,
  notifyOn: {
    sessionIdle: true,
    sessionError: true,
    permissionAsked: true,
    todoUpdated: false,
  },
  sounds: {
    sessionIdle: "Glass",
    sessionError: "Basso",
    permissionAsked: "Frog",
    todoUpdated: "Hero",
  },
}

const EVENT_CONFIG: Record<EventType, EventConfigEntry> = {
  "session.idle": {
    enabledKey: "sessionIdle",
    soundKey: "sessionIdle",
    message: "✅ Task complete",
  },
  "session.error": {
    enabledKey: "sessionError",
    soundKey: "sessionError",
    message: "🔴 Session error",
  },
  "permission.asked": {
    enabledKey: "permissionAsked",
    soundKey: "permissionAsked",
    message: "🔔 Permission requested",
  },
  "todo.updated": {
    enabledKey: "todoUpdated",
    soundKey: "todoUpdated",
    message: "📋 Todo list updated",
  },
}

function mergeConfig(base: MacnotifyConfig, override: ConfigOverride | null): MacnotifyConfig {
  return {
    ...base,
    ...(override || {}),
    notifyOn: {
      ...base.notifyOn,
      ...(override?.notifyOn || {}),
    },
    sounds: {
      ...base.sounds,
      ...(override?.sounds || {}),
    },
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK)
    return true
  } catch {
    return false
  }
}

async function readJson(path: string): Promise<ConfigOverride> {
  const text = await readFile(path, "utf8")
  return JSON.parse(text) as ConfigOverride
}

function projectNameFrom(directory: string, project?: PluginProject): string {
  if (project && typeof project === "object") {
    if (typeof project.name === "string" && project.name) return project.name
    if (typeof project.path === "string" && project.path) return basename(project.path)
  }
  return basename(directory)
}

function configPaths(directory: string) {
  return {
    globalPath: join(homedir(), ".config", "opencode", "macnotify.json"),
    projectPath: join(directory, ".opencode", "macnotify.json"),
  }
}

async function loadConfig(directory: string, client: PluginClient): Promise<MacnotifyConfig> {
  const { globalPath, projectPath } = configPaths(directory)

  let config = DEFAULT_CONFIG

  for (const path of [globalPath, projectPath]) {
    if (!(await fileExists(path))) continue

    try {
      config = mergeConfig(config, await readJson(path))
    } catch (error) {
      await client.app.log({
        body: {
          service: "macnotify",
          level: "warn",
          message: "Failed to read config file",
          extra: {
            path,
            error: error instanceof Error ? error.message : String(error),
          },
        },
      })
    }
  }

  return config
}

function notificationTitle(config: MacnotifyConfig, directory: string, project?: PluginProject): string {
  const projectName = projectNameFrom(directory, project)
  if (!config.includeProjectName) return config.titlePrefix
  return `${config.titlePrefix} - ${projectName}`
}

function eventMessage(type: EventType, event: HookEvent): string {
  if (type === "session.error") {
    const message = event?.error?.message || event?.message
    if (typeof message === "string" && message.trim()) {
      return `🔴 Session error: ${message.trim()}`
    }
  }

  if (type === "permission.asked") {
    const permission = event?.permission || event?.tool || event?.name
    if (typeof permission === "string" && permission.trim()) {
      return `🔔 Permission requested: ${permission.trim()}`
    }
  }

  return EVENT_CONFIG[type].message
}

async function notify(input: { title: string; message: string; sound: string }): Promise<void> {
  const lines = [
    `display notification ${JSON.stringify(input.message)} with title ${JSON.stringify(input.title)}`,
  ]

  if (input.sound) {
    lines[0] += ` sound name ${JSON.stringify(input.sound)}`
  }

  await execFileAsync("osascript", ["-e", lines[0]])
}

export const OpenCodeMacNotify = async ({
  client,
  directory,
  project,
}: {
  client: PluginClient
  directory: string
  project?: PluginProject
}) => {
  let config = await loadConfig(directory, client)
  const lastSent = new Map<string, number>()

  const macnotifySettingsTool = tool({
    description: "Read or update macnotify notification settings",
    args: {
      action: tool.schema.enum(["get", "set"]).default("get").describe("Read current config or update a target config file"),
      scope: tool.schema.enum(["global", "project"]).default("global").describe("Which config file to update when action is set"),
      enabled: tool.schema.boolean().optional().describe("Enable or disable the plugin"),
      titlePrefix: tool.schema.string().optional().describe("Notification title prefix"),
      includeProjectName: tool.schema.boolean().optional().describe("Append the project name to notification titles"),
      cooldownMs: tool.schema.number().int().nonnegative().optional().describe("Minimum time between notifications for the same event"),
      notifyOnSessionIdle: tool.schema.boolean().optional().describe("Notify when a session becomes idle"),
      notifyOnSessionError: tool.schema.boolean().optional().describe("Notify when a session errors"),
      notifyOnPermissionAsked: tool.schema.boolean().optional().describe("Notify when OpenCode asks for permission"),
      notifyOnTodoUpdated: tool.schema.boolean().optional().describe("Notify when the todo list changes"),
      soundSessionIdle: tool.schema.string().optional().describe("Sound for session.idle, or empty string for silent"),
      soundSessionError: tool.schema.string().optional().describe("Sound for session.error, or empty string for silent"),
      soundPermissionAsked: tool.schema.string().optional().describe("Sound for permission.asked, or empty string for silent"),
      soundTodoUpdated: tool.schema.string().optional().describe("Sound for todo.updated, or empty string for silent"),
    },
    async execute(args: SettingsArgs, context: ToolContext) {
      const { globalPath, projectPath } = configPaths(context.directory)
      const globalRaw = await fileExists(globalPath) ? await readJson(globalPath).catch(() => null) : null
      const projectRaw = await fileExists(projectPath) ? await readJson(projectPath).catch(() => null) : null
      const globalConfig = mergeConfig(DEFAULT_CONFIG, globalRaw)
      const projectConfig = projectRaw ? mergeConfig(DEFAULT_CONFIG, projectRaw) : null
      const effectiveConfig = projectRaw ? mergeConfig(globalConfig, projectRaw) : globalConfig

      if (args.action === "get") {
        return JSON.stringify(
          {
            paths: {
              global: globalPath,
              project: projectPath,
            },
            globalConfig,
            projectConfig,
            effectiveConfig,
          },
          null,
          2,
        )
      }

      const targetPath = args.scope === "project" ? projectPath : globalPath
      const currentRaw = args.scope === "project" ? projectRaw : globalRaw
      const nextConfig = mergeConfig(DEFAULT_CONFIG, currentRaw)

      if (args.enabled !== undefined) nextConfig.enabled = args.enabled
      if (args.titlePrefix !== undefined) nextConfig.titlePrefix = args.titlePrefix
      if (args.includeProjectName !== undefined) nextConfig.includeProjectName = args.includeProjectName
      if (args.cooldownMs !== undefined) nextConfig.cooldownMs = args.cooldownMs
      if (args.notifyOnSessionIdle !== undefined) nextConfig.notifyOn.sessionIdle = args.notifyOnSessionIdle
      if (args.notifyOnSessionError !== undefined) nextConfig.notifyOn.sessionError = args.notifyOnSessionError
      if (args.notifyOnPermissionAsked !== undefined) nextConfig.notifyOn.permissionAsked = args.notifyOnPermissionAsked
      if (args.notifyOnTodoUpdated !== undefined) nextConfig.notifyOn.todoUpdated = args.notifyOnTodoUpdated
      if (args.soundSessionIdle !== undefined) nextConfig.sounds.sessionIdle = args.soundSessionIdle
      if (args.soundSessionError !== undefined) nextConfig.sounds.sessionError = args.soundSessionError
      if (args.soundPermissionAsked !== undefined) nextConfig.sounds.permissionAsked = args.soundPermissionAsked
      if (args.soundTodoUpdated !== undefined) nextConfig.sounds.todoUpdated = args.soundTodoUpdated

      await mkdir(dirname(targetPath), { recursive: true })
      await writeFile(targetPath, `${JSON.stringify(nextConfig, null, 2)}\n`, "utf8")
      config = await loadConfig(directory, client)

      return JSON.stringify(
        {
          updated: true,
          scope: args.scope,
          path: targetPath,
          config: nextConfig,
          effectiveConfig:
            args.scope === "project"
              ? mergeConfig(globalConfig, nextConfig)
              : projectRaw
                ? mergeConfig(nextConfig, projectRaw)
                : nextConfig,
        },
        null,
        2,
      )
    },
  })

  await client.app.log({
    body: {
      service: "macnotify",
      level: "info",
      message: "Plugin initialized",
      extra: { directory },
    },
  })

  return {
    tool: {
      macnotify_settings: macnotifySettingsTool,
    },
    event: async ({ event }: { event: HookEvent }) => {
      const type = event?.type
      if (!config.enabled || !type || !(type in EVENT_CONFIG)) return

      const mapping = EVENT_CONFIG[type as EventType]
      if (!config.notifyOn[mapping.enabledKey]) return

      const now = Date.now()
      const previous = lastSent.get(type) || 0
      if (now - previous < config.cooldownMs) return
      lastSent.set(type, now)

      try {
        await notify({
          title: notificationTitle(config, directory, project),
          message: eventMessage(type as EventType, event),
          sound: config.sounds[mapping.soundKey],
        })
      } catch (error) {
        await client.app.log({
          body: {
            service: "macnotify",
            level: "warn",
            message: "Failed to send notification",
            extra: {
              eventType: type,
              error: error instanceof Error ? error.message : String(error),
            },
          },
        })
      }
    },
  }
}

export default OpenCodeMacNotify
