targetScope = 'resourceGroup'

@description('Azure region.')
param location string

@description('Prefix for resource names.')
param namePrefix string

@description('Resource ID of the subnet to attach the network interface to.')
param subnetId string

@description('Local administrator username.')
param adminUsername string

@description('Local administrator password.')
@secure()
param adminPassword string

@description('Virtual machine size.')
param vmSize string

@description('Marketplace image publisher.')
param sqlImagePublisher string

@description('Marketplace image offer.')
param sqlImageOffer string

@description('Marketplace image SKU.')
param sqlImageSku string

@description('Marketplace image version.')
param sqlImageVersion string

@description('Tags applied to all resources.')
param tags object

var pipName = '${namePrefix}-pip'
var nicName = '${namePrefix}-nic'
var vmName = '${namePrefix}-sql2016-vm'
var computerName = 'sql2016vm'

resource pip 'Microsoft.Network/publicIPAddresses@2023-11-01' = {
  name: pipName
  location: location
  tags: tags
  sku: {
    name: 'Standard'
  }
  properties: {
    publicIPAllocationMethod: 'Static'
  }
}

resource nic 'Microsoft.Network/networkInterfaces@2023-11-01' = {
  name: nicName
  location: location
  tags: tags
  properties: {
    ipConfigurations: [
      {
        name: 'ipconfig1'
        properties: {
          privateIPAllocationMethod: 'Dynamic'
          subnet: {
            id: subnetId
          }
          publicIPAddress: {
            id: pip.id
          }
        }
      }
    ]
  }
}

resource vm 'Microsoft.Compute/virtualMachines@2023-09-01' = {
  name: vmName
  location: location
  tags: tags
  properties: {
    hardwareProfile: {
      vmSize: vmSize
    }
    osProfile: {
      computerName: computerName
      adminUsername: adminUsername
      adminPassword: adminPassword
      windowsConfiguration: {
        provisionVMAgent: true
        enableAutomaticUpdates: true
      }
    }
    storageProfile: {
      imageReference: {
        publisher: sqlImagePublisher
        offer: sqlImageOffer
        sku: sqlImageSku
        version: sqlImageVersion
      }
      osDisk: {
        name: '${vmName}-osdisk'
        createOption: 'FromImage'
        managedDisk: {
          storageAccountType: 'Premium_LRS'
        }
      }
    }
    networkProfile: {
      networkInterfaces: [
        {
          id: nic.id
        }
      ]
    }
  }
}

@description('Name of the virtual machine.')
output vmName string = vm.name

@description('Allocated public IP address.')
output publicIpAddress string = pip.properties.ipAddress
