targetScope = 'resourceGroup'

@description('Azure region for all resources.')
param location string = 'westeurope'

@description('Short environment name used in tags and resource names.')
param environmentName string = 'demo'

@description('Short prefix used to name resources.')
param resourcePrefix string = 'hvesql'

@description('Local administrator username for the SQL Server virtual machine.')
param adminUsername string

@description('Local administrator password for the virtual machine. Provide at deploy time; never commit it. Minimum 12 characters, enforced by the deploy script and by Azure password complexity.')
@secure()
param adminPassword string

@description('Source CIDR allowed to reach the VM over RDP, for example 203.0.113.10/32. Do not use 0.0.0.0/0.')
param allowedRdpSourceAddressPrefix string

@description('Virtual machine size. The default supports the SQL Server 2016 generation 1 image.')
param vmSize string = 'Standard_D2s_v3'

@description('Marketplace image publisher for SQL Server.')
param sqlImagePublisher string = 'MicrosoftSQLServer'

@description('Marketplace image offer for SQL Server 2016 on Windows Server 2016.')
param sqlImageOffer string = 'SQL2016SP2-WS2016'

@description('Marketplace image SKU. SQLDEV is the free Developer edition, suitable for a demo.')
param sqlImageSku string = 'SQLDEV'

@description('Marketplace image version.')
param sqlImageVersion string = 'latest'

@description('Owner tag value.')
param ownerTag string = 'demo-owner'

@description('Project tag value.')
param projectTag string = 'HVE-SQL'

var namePrefix = '${resourcePrefix}-${environmentName}'
var tags = {
  Environment: environmentName
  Owner: ownerTag
  Project: projectTag
}

module network './modules/network.bicep' = {
  name: 'network'
  params: {
    location: location
    namePrefix: namePrefix
    allowedRdpSourceAddressPrefix: allowedRdpSourceAddressPrefix
    tags: tags
  }
}

module sqlVm './modules/sqlserver-vm.bicep' = {
  name: 'sqlserver-vm'
  params: {
    location: location
    namePrefix: namePrefix
    subnetId: network.outputs.subnetId
    adminUsername: adminUsername
    adminPassword: adminPassword
    vmSize: vmSize
    sqlImagePublisher: sqlImagePublisher
    sqlImageOffer: sqlImageOffer
    sqlImageSku: sqlImageSku
    sqlImageVersion: sqlImageVersion
    tags: tags
  }
}

@description('Name of the SQL Server virtual machine.')
output vmName string = sqlVm.outputs.vmName

@description('Public IP address for RDP access to the virtual machine.')
output vmPublicIpAddress string = sqlVm.outputs.publicIpAddress
