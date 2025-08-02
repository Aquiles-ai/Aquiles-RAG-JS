import { Command, Flags } from '@oclif/core'
import { loadAquilesConfig, saveAquilesConfig } from '../configs/configs.js';

export default class Configs extends Command {
  static description = 'Read or update Redis-related configurations'

  static flags = {
    local: Flags.boolean({
      description: 'Set whether the Redis server runs locally',
      allowNo: true
    }),
    host: Flags.string({ description: 'Redis host' }),
    port: Flags.integer({ description: 'Redis port' }),
    username: Flags.string({ description: 'Redis username' }),
    password: Flags.string({ description: 'Redis password' }),
    'cluster-mode': Flags.boolean({ description: 'Enable Redis Cluster mode', allowNo: true }),
    'tls-mode': Flags.boolean({ description: 'Enable SSL/TLS connection', allowNo: true }),
    'ssl-cert': Flags.string({ description: 'Absolute path to SSL cert' }),
    'ssl-key': Flags.string({ description: 'Absolute path to SSL key' }),
    'ssl-ca': Flags.string({ description: 'Absolute path to SSL CA' })
  }

  async run() {
    const { flags } = await this.parse(Configs)
    let config = await loadAquilesConfig()
    try {
      for (const key of Object.keys(flags)) {
        if (flags[key] !== undefined) {
          config[key] = flags[key]
        }
      }
      saveAquilesConfig(config)
      this.log('✅ Configuration updated successfully.')
    } catch (err) {
      this.error(`❌ Error saving configuration: ${err.message}`)
    }
  }
}
