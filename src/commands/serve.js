import { Command, Flags } from '@oclif/core'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
// command serve
export default class Serve extends Command {
  static description = 'Aquiles-RAG Fastify server starts'

  static flags = {
    host: Flags.string({
      char: 'h',
      description: 'Host where Aquiles-RAG will be executed',
      default: '0.0.0.0',
    }),
    port: Flags.integer({
      char: 'p',
      description: 'Port where Aquiles-RAG will be executed',
      default: 5500,
    }),
  }

  async run() {
    const { flags } = await this.parse(Serve)
    const __filename = fileURLToPath(import.meta.url)
    const __dirname  = path.dirname(__filename)
    const appPath = path.join(__dirname, '..', 'index.js')
    const { default: fastify } = await import(appPath)
    try {
      await fastify.listen({ host: flags.host, port: flags.port })
      this.log(`🚀 Server listening at http://${flags.host}:${flags.port}`)
    } catch (err) {
      this.error(`❌ Failed to start server: ${err.message}`)
    }
  }
}
