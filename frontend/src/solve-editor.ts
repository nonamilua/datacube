// A solve can have separate timer and history buttons. Use the clicked control
// so its opening click is not interpreted as a click outside the editor.
export function editorAnchor(clicked: HTMLButtonElement, buttons: HTMLButtonElement[], solveId: string): HTMLButtonElement {
  return clicked.isConnected ? clicked : buttons.find(button => button.dataset.solveId === solveId) ?? clicked;
}
