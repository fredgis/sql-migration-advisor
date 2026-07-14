#requires -Version 5.1
<#
.SYNOPSIS
    Installs the ContosoSales legacy database and its legacy features on a target SQL Server.

.DESCRIPTION
    Runs the SQL scripts in order against the target instance. Run this on the VM against
    localhost, or from a host inside the virtual network. Uses Windows authentication by default,
    or SQL authentication when -SqlUsername and -SqlPassword are supplied.

.EXAMPLE
    ./Install-LegacyDatabase.ps1 -ServerInstance "localhost"
#>
[CmdletBinding()]
param(
    [string]$ServerInstance = 'localhost',
    [string]$SqlUsername,
    [string]$SqlPassword,
    [string]$SqlScriptFolder = (Join-Path $PSScriptRoot '..\sql'),
    # The SQL Server 2016 marketplace image does NOT add the VM administrator (or NT AUTHORITY\SYSTEM)
    # to the sysadmin role: only the built-in 'sa' login is sysadmin. When installing with Windows
    # authentication against the local default instance, this script therefore grants the current
    # Windows principal sysadmin (via a brief single-user-mode restart) so the install can proceed.
    # Pass -SkipSysadminElevation to opt out.
    [switch]$SkipSysadminElevation
)

$ErrorActionPreference = 'Stop'

$scripts = @(
    '01-create-legacy-db.sql',
    '02-seed-data.sql',
    '03-legacy-features.sql'
)

$useModule = $null -ne (Get-Command Invoke-Sqlcmd -ErrorAction SilentlyContinue)
$useAuth = -not [string]::IsNullOrWhiteSpace($SqlUsername) -and -not [string]::IsNullOrWhiteSpace($SqlPassword)

if (-not $useModule -and -not (Get-Command sqlcmd -ErrorAction SilentlyContinue)) {
    throw 'Neither the Invoke-Sqlcmd cmdlet nor sqlcmd.exe was found. Install the SqlServer module or the SQL command-line tools.'
}

function Get-SysadminFlag {
    param([string]$Instance)
    $q = "SET NOCOUNT ON; SELECT IS_SRVROLEMEMBER('sysadmin');"
    if ($useAuth) {
        $out = sqlcmd -S $Instance -U $SqlUsername -P $SqlPassword -h -1 -W -Q $q 2>&1
    }
    else {
        $out = sqlcmd -S $Instance -E -h -1 -W -Q $q 2>&1
    }
    return (($out | Where-Object { $_ -match '^\d+$' } | Select-Object -First 1) -as [int])
}

# The marketplace image only grants 'sa' the sysadmin role, so a Windows-auth install fails with
# "CREATE DATABASE permission denied". Detect that and self-elevate the current principal.
$isDefaultLocalInstance = $ServerInstance -match '^(localhost|\.|\(local\)|127\.0\.0\.1|' + [Regex]::Escape($env:COMPUTERNAME) + ')$'
if (-not $useAuth -and -not $SkipSysadminElevation -and (Get-Command sqlcmd -ErrorAction SilentlyContinue)) {
    $isSysadmin = Get-SysadminFlag -Instance $ServerInstance
    if ($isSysadmin -ne 1) {
        if (-not $isDefaultLocalInstance) {
            throw "The current login is not a sysadmin on '$ServerInstance', and auto-elevation only supports the local default instance. Re-run on the VM against the default instance, or connect as a sysadmin (for example the 'sa' login with -SqlUsername sa -SqlPassword ...)."
        }
        $me = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
        Write-Host "Current login '$me' is not a SQL sysadmin (the marketplace image only grants 'sa'). Granting it sysadmin via a brief single-user-mode restart of MSSQLSERVER." -ForegroundColor Yellow
        try {
            net stop MSSQLSERVER | Out-Null
            net start MSSQLSERVER /m"SQLCMD" | Out-Null
            Start-Sleep -Seconds 5
            $grant = "IF SUSER_ID('$me') IS NULL CREATE LOGIN [$me] FROM WINDOWS; ALTER SERVER ROLE sysadmin ADD MEMBER [$me];"
            sqlcmd -S $ServerInstance -E -Q $grant
        }
        finally {
            net stop MSSQLSERVER | Out-Null
            net start MSSQLSERVER | Out-Null
            Start-Sleep -Seconds 5
        }
        if ((Get-SysadminFlag -Instance $ServerInstance) -ne 1) {
            throw "Failed to grant '$me' the sysadmin role. Connect as an existing sysadmin (for example the 'sa' login) and re-run."
        }
        Write-Host "Granted '$me' the sysadmin role." -ForegroundColor Green
    }
}

foreach ($name in $scripts) {
    $path = Join-Path $SqlScriptFolder $name
    if (-not (Test-Path $path)) {
        throw "SQL script not found: $path"
    }
    Write-Host "Running $name against $ServerInstance"

    if ($useModule) {
        $params = @{
            ServerInstance = $ServerInstance
            InputFile      = $path
            QueryTimeout   = 0
        }
        # -TrustServerCertificate only exists on newer SqlServer module versions; the SQL Server 2016
        # marketplace image ships an older Invoke-Sqlcmd that rejects it. Add it only when supported.
        if ((Get-Command Invoke-Sqlcmd).Parameters.ContainsKey('TrustServerCertificate')) {
            $params.TrustServerCertificate = $true
        }
        if ($useAuth) {
            $params.Username = $SqlUsername
            $params.Password = $SqlPassword
        }
        Invoke-Sqlcmd @params
    }
    else {
        if ($useAuth) {
            sqlcmd -S $ServerInstance -U $SqlUsername -P $SqlPassword -b -i $path
        }
        else {
            sqlcmd -S $ServerInstance -E -b -i $path
        }
        if ($LASTEXITCODE -ne 0) {
            throw "sqlcmd failed on $name with exit code $LASTEXITCODE"
        }
    }
}

Write-Host 'Legacy database installed. ContosoSales and ContosoArchive are ready to inspect.' -ForegroundColor Green
