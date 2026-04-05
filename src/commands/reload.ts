import type { Command } from '../../commands.js'
import type { LocalCommandCall, LocalCommandResult } from '../../types/command.js'
import {
  applyProfileEnvToProcessEnv,
  buildLaunchEnv,
  loadProfileFile,
  maskSecretForDisplay,
  sanitizeProviderConfigValue,
  type ProfileFile,
} from '../utils/providerProfile.js'

const call: LocalCommandCall = async (): Promise<LocalCommandResult> => {
  try {
    const persisted = loadProfileFile()
    if (!persisted) {
      return {
        type: 'text',
        value: 'No saved provider profile found. Use /provider to set up a provider.',
      }
    }

    const nextEnv = await buildLaunchEnv({
      profile: persisted.profile,
      persisted,
      goal: 'balanced',
      processEnv: process.env,
      resolveOllamaDefaultModel: async () => 'llama3.1:8b',
    })
    if (nextEnv !== process.env) {
      applyProfileEnvToProcessEnv(process.env, nextEnv)
    }

    const summary = buildSummaryText(persisted)
    return { type: 'text', value: summary }
  } catch (e) {
    return {
      type: 'text',
      value: `Reload failed: ${e instanceof Error ? e.message : String(e)}`,
    }
  }
}

const reload: Command = {
  type: 'local',
  name: 'reload',
  description: 'Reload provider profile and re-apply env vars in the current session',
  load: () => Promise.resolve({ call }),
} satisfies Command

export default reload

function providerLabel(profile: string): string {
  switch (profile) {
    case 'ollama': return 'Ollama'
    case 'openai': return 'OpenAI-compatible'
    case 'gemini': return 'Google Gemini'
    case 'codex': return 'Codex'
    case 'openrouter': return 'OpenRouter'
    case 'atomic-chat': return 'Atomic Chat'
    default: return profile
  }
}

function buildSummaryText(pf: ProfileFile): string {
  const lines = [`Reloaded provider profile: ${providerLabel(pf.profile)}`]

  switch (pf.profile) {
    case 'openrouter':
      lines.push(`Model: ${pf.env.OPENROUTER_MODEL ?? '(default)'}`)
      lines.push(`Endpoint: ${pf.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1'}`)
      lines.push(`Key: ${maskSecretForDisplay(pf.env.OPENROUTER_API_KEY) ?? '(not set)'}`)
      break
    case 'gemini':
      lines.push(`Model: ${pf.env.GEMINI_MODEL ?? 'gemini-2.0-flash'}`)
      lines.push(`Endpoint: ${pf.env.GEMINI_BASE_URL ?? 'https://generativelanguage.googleapis.com/v1beta/openai'}`)
      lines.push(`Key: ${maskSecretForDisplay(pf.env.GEMINI_API_KEY) ?? '(not set)'}`)
      break
    case 'ollama':
      lines.push(`Model: ${pf.env.OPENAI_MODEL ?? '(default)'}`)
      lines.push(`Endpoint: ${pf.env.OPENAI_BASE_URL ?? 'http://localhost:11434/v1'}`)
      break
    case 'openai':
      lines.push(`Model: ${sanitizeProviderConfigValue(pf.env.OPENAI_MODEL) ?? 'gpt-4o'}`)
      lines.push(`Endpoint: ${sanitizeProviderConfigValue(pf.env.OPENAI_BASE_URL) ?? 'https://api.openai.com/v1'}`)
      lines.push(`Key: ${maskSecretForDisplay(pf.env.OPENAI_API_KEY) ?? '(not set)'}`)
      break
    case 'codex':
      lines.push(`Model: ${pf.env.OPENAI_MODEL ?? 'codexplan'}`)
      lines.push(`Endpoint: ${pf.env.OPENAI_BASE_URL ?? 'https://chatgpt.com/backend-api/codex'}`)
      break
    default:
      break
  }

  lines.push('')
  lines.push('Provider is now active for this session.')
  return lines.join('\n')
}
