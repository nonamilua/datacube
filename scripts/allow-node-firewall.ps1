#Requires -RunAsAdministrator
param([string]$ResultPath)

$ErrorActionPreference = 'Stop'
try {
    $nodePath = (Get-Command node.exe).Source
    $ruleName = 'namicubes-node-private'
    $existing = Get-NetFirewallRule -Name $ruleName -ErrorAction SilentlyContinue
    if ($existing) {
        Set-NetFirewallRule -Name $ruleName -Enabled True -Direction Inbound -Action Allow -Profile Private -Program $nodePath -Protocol TCP -RemoteAddress LocalSubnet
    } else {
        New-NetFirewallRule -Name $ruleName -DisplayName 'namicubes Node.js private network' -Direction Inbound -Action Allow -Enabled True -Profile Private -Program $nodePath -Protocol TCP -RemoteAddress LocalSubnet | Out-Null
    }
    $rule = Get-NetFirewallRule -Name $ruleName
    $message = "firewall rule enabled=$($rule.Enabled) action=$($rule.Action) profile=$($rule.Profile) program=$nodePath"
    if ($ResultPath) { Set-Content -LiteralPath $ResultPath -Value $message }
    Write-Output $message
} catch {
    if ($ResultPath) { Set-Content -LiteralPath $ResultPath -Value "failed: $_" }
    throw
}
