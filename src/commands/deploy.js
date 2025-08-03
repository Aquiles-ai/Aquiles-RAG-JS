import { Command, Flags, Args } from '@oclif/core'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

export default class Deploy extends Command {
  static description = 'Deploys Aquiles-RAG with external configuration and starts the server'

  static flags = {
    host: Flags.string({
      char: 'h',
      description: 'Host address for Aquiles-RAG server',
      default: '0.0.0.0',
    }),
    port: Flags.integer({
      char: 'p',
      description: 'Port number for Aquiles-RAG server',
      default: 5500,
    }),
  }

  static args = {
    config: Args.string({
      description: 'Path to the JS config file (must export a run() function)',
      required: true,
    }),
  }

  async run() {
    const { flags, args } = await this.parse(Deploy)

    // Dynamically import the user config module
    const configPath = path.resolve(process.cwd(), args.config)
    let configModule
    try {
      configModule = await import(configPath)
    } catch (err) {
      this.error(`❌ Failed to import config: ${err.message}`)
      return
    }

    // Execute run() if available
    if (typeof configModule.run === 'function') {
      try {
        await configModule.run()
        this.log('✅ run() executed successfully from config')
      } catch (err) {
        this.error(`❌ Error during run(): ${err.message}`)
        return
      }
    } else {
      this.warn('⚠️ Config file does not export a run() function')
    }

    // Start the Fastify server as a child process
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = path.dirname(__filename)
    const serverScript = path.join(__dirname, '..', 'index.js')

    const nodeArgs = [serverScript, '--host', flags.host, '--port', flags.port.toString()]
    this.log(`🚀 Launching server: node ${nodeArgs.join(' ')}`)

    const child = spawn(process.execPath, nodeArgs, { stdio: 'inherit' })
    child.on('exit', code => {
      if (code === 0) this.log('🚀 Deployment completed successfully')
      else this.error(`❌ Server process exited with code ${code}`)
    })
  }
}
