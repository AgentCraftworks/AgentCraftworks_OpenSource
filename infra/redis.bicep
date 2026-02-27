param location string
param tags object
param resourceToken string

// Azure Cache for Redis
resource redis 'Microsoft.Cache/redis@2023-08-01' = {
  name: 'redis-${resourceToken}'
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'Basic'
      family: 'C'
      capacity: 0
    }
    enableNonSslPort: false
    minimumTlsVersion: '1.2'
    redisConfiguration: {
      'maxmemory-policy': 'allkeys-lru'
    }
  }
}

// Outputs
output redisHost string = redis.properties.hostName
output redisPort int = redis.properties.sslPort
// Note: Primary key is output to pass to Key Vault for secure storage
// The warning about secrets in outputs is expected - this value is consumed by keyvault.bicep
output redisPrimaryKey string = redis.listKeys().primaryKey
