using './main.bicep'

param adminUsername = 'contosoadmin'

// Provide the password through an environment variable so it is never committed.
// PowerShell example: $env:SQLVM_ADMIN_PASSWORD = '<a-strong-password>'
param adminPassword = readEnvironmentVariable('SQLVM_ADMIN_PASSWORD', '')

// Replace with your own public IP in CIDR form. Never use 0.0.0.0/0.
param allowedRdpSourceAddressPrefix = '203.0.113.10/32'
