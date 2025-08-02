import { Command, Flags } from '@oclif/core'

export default class Hello extends Command {
  static description = 'Greets the given name'

  static flags = {
    name: Flags.string({
      char: 'n',
      description: 'Name to greet',
      default: 'world'
    })
  }

  async run() {
    const { flags } = await this.parse(Hello)
    const output = `Hello, ${flags.name}!`
    this.log(output)
  }
}
