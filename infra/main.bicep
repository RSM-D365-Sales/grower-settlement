// Grower Contract & Settlement Platform — Azure resources (Docs/PLAN.md §3).
// SPA is hosted on GitHub Pages (not Azure) — CORS below must list its origin(s).
// Deploy: az deployment group create -g <rg> -f main.bicep -p main.parameters.json

@description('Prefix for resource names, lowercase letters/numbers (e.g. growerset)')
@minLength(3)
@maxLength(16)
param namePrefix string

param location string = resourceGroup().location

@description('Allowed CORS origins: GitHub Pages URL(s) and localhost for dev')
param corsOrigins array = [
  'http://localhost:5174'
]

@description('Entra tenant id for API token validation')
param entraTenantId string = ''

@description('API app registration client id (token audience)')
param apiClientId string = ''

param sqlAdminLogin string

@secure()
param sqlAdminPassword string

var suffix = uniqueString(resourceGroup().id)
var functionAppName = '${namePrefix}-api-${suffix}'
var storageName = toLower(replace('${namePrefix}st${suffix}', '-', ''))

// ── Observability ───────────────────────────────────────────────────────────

resource logWorkspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${namePrefix}-logs'
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${namePrefix}-ai'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logWorkspace.id
  }
}

// ── Function App (API) ──────────────────────────────────────────────────────

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: take(storageName, 24)
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
  }
}

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${namePrefix}-plan'
  location: location
  sku: { name: 'Y1', tier: 'Dynamic' }
  kind: 'functionapp'
  properties: {
    reserved: true // Linux
  }
}

resource functionApp 'Microsoft.Web/sites@2023-12-01' = {
  name: functionAppName
  location: location
  kind: 'functionapp,linux'
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'NODE|20'
      ftpsState: 'Disabled'
      cors: {
        allowedOrigins: corsOrigins
      }
      appSettings: [
        { name: 'AzureWebJobsStorage', value: 'DefaultEndpointsProtocol=https;AccountName=${storage.name};AccountKey=${storage.listKeys().keys[0].value};EndpointSuffix=${environment().suffixes.storage}' }
        { name: 'FUNCTIONS_EXTENSION_VERSION', value: '~4' }
        { name: 'FUNCTIONS_WORKER_RUNTIME', value: 'node' }
        { name: 'WEBSITE_RUN_FROM_PACKAGE', value: '1' }
        { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsights.properties.ConnectionString }
        { name: 'AUTH_MODE', value: 'entra' }
        { name: 'D365_MODE', value: 'mock' }
        { name: 'ENTRA_TENANT_ID', value: entraTenantId }
        { name: 'API_CLIENT_ID', value: apiClientId }
        // D365_CLIENT_SECRET / DATABASE_URL: set as Key Vault references once
        // the vault exists — never inline secrets here (Docs/PLAN.md §9).
      ]
    }
  }
}

// ── Azure SQL ───────────────────────────────────────────────────────────────

resource sqlServer 'Microsoft.Sql/servers@2023-08-01-preview' = {
  name: '${namePrefix}-sql-${suffix}'
  location: location
  properties: {
    administratorLogin: sqlAdminLogin
    administratorLoginPassword: sqlAdminPassword
    minimalTlsVersion: '1.2'
    publicNetworkAccess: 'Enabled'
  }
}

resource sqlDb 'Microsoft.Sql/servers/databases@2023-08-01-preview' = {
  parent: sqlServer
  name: '${namePrefix}-db'
  location: location
  sku: { name: 'S0', tier: 'Standard' }
}

resource sqlAllowAzure 'Microsoft.Sql/servers/firewallRules@2023-08-01-preview' = {
  parent: sqlServer
  name: 'AllowAllWindowsAzureIps'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// ── Service Bus (D365 business events + outbox processing) ─────────────────

resource serviceBus 'Microsoft.ServiceBus/namespaces@2022-10-01-preview' = {
  name: '${namePrefix}-sb-${suffix}'
  location: location
  sku: { name: 'Standard', tier: 'Standard' }
}

resource businessEventsQueue 'Microsoft.ServiceBus/namespaces/queues@2022-10-01-preview' = {
  parent: serviceBus
  name: 'd365-business-events'
  properties: {
    maxDeliveryCount: 10
    deadLetteringOnMessageExpiration: true
  }
}

output functionAppName string = functionApp.name
output functionAppHostname string = functionApp.properties.defaultHostName
output sqlServerFqdn string = sqlServer.properties.fullyQualifiedDomainName
output serviceBusNamespace string = serviceBus.name
output appInsightsName string = appInsights.name
