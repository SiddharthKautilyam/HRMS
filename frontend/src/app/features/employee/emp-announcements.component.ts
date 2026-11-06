import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ApiService } from '../../core/api/api.service';

interface Announcement {
  title: string;
  msg: string;
  type: 'info' | 'warning' | 'danger';
  time: string;
  tag: string;
}

/** Announcements — ported from pages/emp-announcements.html. */
@Component({
  selector: 'app-emp-announcements',
  imports: [CommonModule],
  template: `
    <div class="flex justify-between items-center" style="margin-bottom: 24px">
      <div>
        <div class="page-title">Announcements</div>
        <div class="page-subtitle">Company news and HR updates</div>
      </div>
      <span class="badge badge-danger" style="font-size: 0.82rem; padding: 6px 14px">{{ announcements().length }} New</span>
    </div>

    <div style="display: flex; flex-direction: column; gap: 14px">
      @for (a of announcements(); track a.title) {
        <div style="background: var(--surface); border-radius: 14px; border: 1px solid var(--border); box-shadow: var(--shadow); overflow: hidden">
          <div [style.background]="barColor(a.type)" style="height: 3px"></div>
          <div style="padding: 14px">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px">
              <span class="badge" [class]="badgeClass(a.type)">{{ a.tag }}</span>
              <span class="ann-time" style="font-size: 11px; color: var(--muted); white-space: nowrap">{{ a.time }}</span>
            </div>
            <div class="ann-title" style="font-size: 14px; font-weight: 700; color: var(--text); margin-bottom: 7px; line-height: 1.4">
              {{ a.title }}
            </div>
            <div class="ann-msg" style="font-size: 14px; color: var(--muted); line-height: 1.6">{{ a.msg }}</div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      @media (max-width: 768px) {
        .ann-title {
          font-size: 13px !important;
        }
        .ann-msg {
          font-size: 12px !important;
        }
      }
    `,
  ],
})
export class EmpAnnouncementsComponent implements OnInit {
  private readonly api = inject(ApiService);

  protected readonly announcements = signal<Announcement[]>([
    {
      title: 'Q1 Performance Reviews Starting',
      msg: 'Performance review cycle starts February 1st. Please complete your self-assessment form by January 31st. Login to the performance portal to get started.',
      type: 'info',
      time: '2 hours ago',
      tag: 'HR Update',
    },
    {
      title: 'Office Closure — February 14',
      msg: 'The office will be closed on February 14, 2025 for scheduled maintenance. All employees are requested to work from home.',
      type: 'warning',
      time: '1 day ago',
      tag: 'Notice',
    },
    {
      title: 'New Leave Policy Effective March 1',
      msg: 'Updated leave policy will be effective from March 1, 2025. Key changes include additional 2 days of annual leave and revised sick leave rules.',
      type: 'info',
      time: '2 days ago',
      tag: 'Policy',
    },
    {
      title: 'Health Insurance Renewal',
      msg: 'Please submit your health insurance renewal documents to HR by January 31, 2025. Failure to submit may result in coverage lapse.',
      type: 'danger',
      time: '3 days ago',
      tag: 'Urgent',
    },
    {
      title: 'Team Building Event — Feb 20',
      msg: 'Join us for a team building event on February 20th at Dubai Marina. Registration is mandatory. Please confirm your attendance by Feb 10.',
      type: 'info',
      time: '4 days ago',
      tag: 'Event',
    },
    {
      title: 'Salary Revision Effective April 2025',
      msg: 'Annual salary revision will be effective from April 1, 2025. Performance-based increments will be communicated by March 15.',
      type: 'info',
      time: '1 week ago',
      tag: 'HR Update',
    },
  ]);

  ngOnInit(): void {
    this.api.announcements().subscribe({
      next: (items) =>
        this.announcements.set(
          items.map((a) => ({
            title: a.title,
            msg: a.message,
            type: (a.severity === 'Danger' ? 'danger' : a.severity === 'Warning' ? 'warning' : 'info') as Announcement['type'],
            time: a.publishedLabel,
            tag: a.tag,
          })),
        ),
      error: () => {
        /* API offline — keep the demo announcements. */
      },
    });
  }

  protected barColor(type: Announcement['type']): string {
    return type === 'danger' ? 'var(--danger)' : type === 'warning' ? 'var(--warning)' : 'var(--p)';
  }

  protected badgeClass(type: Announcement['type']): string {
    return `badge-${type === 'danger' ? 'danger' : type === 'warning' ? 'warning' : 'primary'}`;
  }
}
