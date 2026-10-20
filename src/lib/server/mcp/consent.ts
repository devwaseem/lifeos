export interface McpConsentDetails {
  clientName: string
  clientDomain?: string
  redirectHost: string
  redirectIsLoopback: boolean
  scope: string[]
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`)
}

export function renderMcpConsentPage(details: McpConsentDetails, handle: string) {
  const clientName = escapeHtml(details.clientName)
  const clientOrigin = details.clientDomain
    ? `Published by <strong>${escapeHtml(details.clientDomain)}</strong>.`
    : 'This app registered itself; its name is not independently verified.'
  const scopes = details.scope
    .map((scope) => `<label><input type="checkbox" name="scope" value="${escapeHtml(scope)}" checked> ${escapeHtml(scope)}</label>`)
    .join('<br>')
  const loopbackWarning = details.redirectIsLoopback
    ? '<p><strong>This sends access to an app running on this computer.</strong> Continue only if you started this connection.</p>'
    : ''

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Authorize ${clientName}</title>
</head>
<body>
  <main>
    <h1>Allow ${clientName} to read LifeOS training data?</h1>
    <p>${clientOrigin} Access will be sent to <strong>${escapeHtml(details.redirectHost)}</strong>.</p>
    ${loopbackWarning}
    <p>This connection can read workouts, check-ins, routines, and derived training analytics. It cannot change LifeOS data.</p>
    <form method="post">
      <input type="hidden" name="handle" value="${escapeHtml(handle)}">
      <fieldset>
        <legend>Permissions</legend>
        ${scopes}
      </fieldset>
      <p><button name="decision" value="approve">Allow</button> <button name="decision" value="deny">Deny</button></p>
    </form>
  </main>
</body>
</html>`
}
