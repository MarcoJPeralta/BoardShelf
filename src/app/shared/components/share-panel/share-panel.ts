import { Component, inject, signal } from '@angular/core';
import { ShareService } from '../../../core/services/share.service';

@Component({
  selector: 'app-share-panel',
  templateUrl: './share-panel.html',
  styleUrl: './share-panel.scss',
})
export class SharePanel {
  private shareService = inject(ShareService);

  loaded = this.shareService.loaded;
  shareUrl = this.shareService.shareUrl;
  error = this.shareService.error;

  isOpen = signal(false);
  isSaving = signal(false);
  copied = signal(false);
  displayName = signal('');

  toggle(): void {
    this.isOpen.update((open) => !open);
    this.displayName.set(this.shareService.displayName());
    this.copied.set(false);
  }

  async createLink(): Promise<void> {
    await this.saving(() => this.shareService.createLink(this.displayName()));
  }

  async saveName(): Promise<void> {
    await this.saving(() => this.shareService.updateDisplayName(this.displayName()));
  }

  async replaceLink(): Promise<void> {
    if (!confirm('Replace this link? The current link will stop working.')) return;
    await this.saving(() => this.shareService.createLink(this.displayName()));
  }

  async turnOff(): Promise<void> {
    if (!confirm('Turn off sharing? The current link will stop working.')) return;
    await this.saving(() => this.shareService.turnOff());
  }

  async copyLink(): Promise<void> {
    const url = this.shareUrl();
    if (!url) return;

    try {
      await navigator.clipboard.writeText(url);
      this.copied.set(true);
    } catch {
      // Clipboard access can be blocked; the link stays visible to copy by hand
      this.copied.set(false);
    }
  }

  private async saving(action: () => Promise<void>): Promise<void> {
    this.isSaving.set(true);
    this.copied.set(false);
    await action();
    this.isSaving.set(false);
  }
}
