// The installed Career client owns connection settings and response validation.
// Only getDocument is called; output is captured by the analyzer, never logged.
import { pathToFileURL } from "node:url"

const keys = ["career-status", "position-preferences", "application-state", "learning-interests"]
const result = []
let client
try {
  const module = await import(pathToFileURL(process.argv[2]).href)
  client = module.createCandidateContextClient({ timeoutMs: 5000, maxRetries: 0 })
} catch {
  client = null
}
for (const key of keys) {
  try {
    if (!client) throw new Error("unavailable")
    const document = await client.getDocument(key)
    result.push({ key, status: "확인함", document })
  } catch {
    result.push({ key, status: "확인 못 함" })
  }
}
process.stdout.write(JSON.stringify(result))
