targetScope = 'resourceGroup'

@description('Azure region.')
param location string

@description('Prefix for resource names.')
param namePrefix string

@description('Source CIDR allowed over RDP.')
param allowedRdpSourceAddressPrefix string

@description('Tags applied to all resources.')
param tags object

var vnetName = '${namePrefix}-vnet'
var subnetName = 'sql-subnet'
var nsgName = '${namePrefix}-nsg'

resource nsg 'Microsoft.Network/networkSecurityGroups@2023-11-01' = {
  name: nsgName
  location: location
  tags: tags
  properties: {
    securityRules: [
      {
        name: 'Allow-RDP-From-Admin'
        properties: {
          priority: 1000
          direction: 'Inbound'
          access: 'Allow'
          protocol: 'Tcp'
          sourceAddressPrefix: allowedRdpSourceAddressPrefix
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '3389'
        }
      }
    ]
  }
}

resource vnet 'Microsoft.Network/virtualNetworks@2023-11-01' = {
  name: vnetName
  location: location
  tags: tags
  properties: {
    addressSpace: {
      addressPrefixes: [
        '10.20.0.0/16'
      ]
    }
    subnets: [
      {
        name: subnetName
        properties: {
          addressPrefix: '10.20.1.0/24'
          networkSecurityGroup: {
            id: nsg.id
          }
        }
      }
    ]
  }
}

@description('Resource ID of the subnet hosting the VM.')
output subnetId string = resourceId('Microsoft.Network/virtualNetworks/subnets', vnetName, subnetName)
