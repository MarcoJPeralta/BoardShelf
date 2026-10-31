import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { SharePanel } from './share-panel';
import { ShareService } from '../../../core/services/share.service';

describe('SharePanel', () => {
  let component: SharePanel;
  let fixture: ComponentFixture<SharePanel>;
  const shareUrl = signal<string | null>(null);
  const createLink = vi.fn();
  const turnOff = vi.fn();

  beforeEach(async () => {
    shareUrl.set(null);
    createLink.mockReset().mockResolvedValue(undefined);
    turnOff.mockReset().mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [SharePanel],
      providers: [
        {
          provide: ShareService,
          useValue: {
            loaded: signal(true),
            error: signal(null),
            displayName: signal('Saved name'),
            shareUrl,
            createLink,
            turnOff,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SharePanel);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should stay closed until asked', () => {
    expect(fixture.nativeElement.querySelector('.share-panel')).toBeNull();
  });

  it('should create a link with the chosen name', async () => {
    component.toggle();
    component.displayName.set('Game shelf');
    await component.createLink();

    expect(createLink).toHaveBeenCalledWith('Game shelf');
  });

  it('should show the link once sharing is on', async () => {
    shareUrl.set('https://boardshelf.online/shared/abc');
    component.toggle();
    await fixture.whenStable();

    const input = fixture.nativeElement.querySelector('input[readonly]') as HTMLInputElement;
    expect(input.value).toBe('https://boardshelf.online/shared/abc');
  });

  it('should keep sharing on when turning it off is not confirmed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    await component.turnOff();

    expect(turnOff).not.toHaveBeenCalled();
  });
});
