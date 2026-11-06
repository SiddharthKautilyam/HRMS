import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, computed, input, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AI_GREETINGS, AI_SUGGESTIONS, aiResponse } from '../../core/data/ai-responses';
import { Role } from '../../core/models';

interface ChatMessage {
  id: number;
  from: 'bot' | 'user';
  html: string;
}

/**
 * Floating AI HR assistant — ported from assets/js/ai-chat.js. Answers are
 * produced locally by the role-aware response engine (no backend needed).
 */
@Component({
  selector: 'app-ai-chat',
  imports: [CommonModule, FormsModule],
  templateUrl: './ai-chat.component.html',
})
export class AiChatComponent implements OnInit {
  readonly role = input<Role>('Employee');

  protected readonly open = signal(false);
  protected readonly unread = signal(false);
  protected readonly typing = signal(false);
  protected readonly messages = signal<ChatMessage[]>([]);

  protected inputText = '';

  private readonly msgsRef = viewChild<ElementRef<HTMLDivElement>>('msgs');
  private seq = 0;

  protected readonly chips = computed(() => AI_SUGGESTIONS[this.role()]);

  ngOnInit(): void {
    this.messages.set([{ id: ++this.seq, from: 'bot', html: AI_GREETINGS[this.role()] }]);
    setTimeout(() => {
      if (!this.open()) this.unread.set(true);
    }, 3000);
  }

  protected toggle(): void {
    const next = !this.open();
    this.open.set(next);
    if (next) {
      this.unread.set(false);
      setTimeout(() => this.scrollToBottom());
    }
  }

  protected send(): void {
    const text = this.inputText.trim();
    if (!text) return;
    this.addUser(text);
    this.inputText = '';
    this.typing.set(true);
    setTimeout(() => {
      this.typing.set(false);
      this.addBot(aiResponse(text, this.role()));
    }, 900);
  }

  protected useChip(text: string): void {
    this.inputText = text;
    this.send();
  }

  protected clear(): void {
    this.messages.set([{ id: ++this.seq, from: 'bot', html: AI_GREETINGS[this.role()] }]);
  }

  protected onEnter(event: KeyboardEvent): void {
    if (event.key === 'Enter') this.send();
  }

  private addBot(html: string): void {
    this.messages.update((list) => [...list, { id: ++this.seq, from: 'bot', html }]);
    this.scrollToBottom();
  }

  private addUser(text: string): void {
    this.messages.update((list) => [...list, { id: ++this.seq, from: 'user', html: text }]);
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const el = this.msgsRef()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }
}
