// Acceptance criterion 6: clearing a binding is CONFIRMED first, never an immediate
// mutation. settings-tab.ts opens this and only calls LocalBindingStore.clear() from
// the confirm callback -- this modal itself never touches a store.
import { Modal } from 'obsidian';
import type { App } from 'obsidian';

export class ClearBindingModal extends Modal {
  constructor(app: App, private readonly label: string, private readonly onConfirm: () => void) {
    super(app);
  }

  override onOpen(): void {
    this.setTitle('Clear binding');
    this.contentEl.createEl('p', {
      text: `This disconnects "${this.label}" from its saved folder on this machine. `
        + 'Any stored snapshot is kept and stays inspectable.',
    });
    const buttons = this.contentEl.createDiv({ cls: 'modal-button-container' });
    const cancel = buttons.createEl('button', { text: 'Cancel', attr: { type: 'button', 'data-action': 'cancel' } });
    cancel.addEventListener('click', () => { this.close(); });
    const confirm = buttons.createEl('button', {
      text: 'Clear binding', attr: { type: 'button', 'data-action': 'confirm-clear-binding' },
    });
    confirm.addEventListener('click', () => {
      this.onConfirm();
      this.close();
    });
  }

  override onClose(): void {
    this.contentEl.empty();
  }
}
