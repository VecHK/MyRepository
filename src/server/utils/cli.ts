import readline from 'readline'

export function myConfirm(
  message: string,
  callbacks: {
    yes: () => void,
    no: () => void
  }
) {
  const inter = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  inter.question(`${message} (y/n)`, (ans) => {
    if (ans == 'y' || ans == 'yes') {
      inter.close()
      callbacks.yes()
    } else if (ans === 'n' || ans === 'no') {
      inter.close()
      callbacks.no()
    }
  })
}

export function processingStatus<R>(task: (d: {
  updateStatus(s: string): void
  done(s: string): void
}) => R): R
export async function processingStatus<
  R
>(task: (d: {
  updateStatus(s: string): void
  done(s: string): void
}) => Promise<R>): Promise<R> {
  function fillString(input: string): string {
    const { columns } = process.stdout
    const out: string[] = []
    for (let i = 0; i < columns; ++i) {
      out.push(input[i])
    }
    return out.join('')
  }

  function updateStatus(string: string) {
    process.stdout.clearLine(-1)
    process.stdout.cursorTo(0)
    process.stdout.write(`${fillString(string)}`)
  }

  function done(string: string) {
    console.log(`\n${string}`)
  }

  try {
    const return_val = await task({ updateStatus, done })
    return return_val
  } catch (err) {
    process.stdout.write('\n')
    throw err
  }
}
