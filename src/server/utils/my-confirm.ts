import readline from 'readline'

export default function myConfirm(
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
