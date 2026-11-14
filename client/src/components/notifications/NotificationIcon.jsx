import clsx from 'clsx';
import { Megaphone, AlarmClock, BellRing, UserPlus, Users, PartyPopper, Info } from 'lucide-react';
import { TONES } from '../../utils/constants';

const MAP = {
  announcement: { icon: Megaphone, tone: 'brand' },
  deadline: { icon: AlarmClock, tone: 'red' },
  reminder: { icon: BellRing, tone: 'amber' },
  group_invite: { icon: UserPlus, tone: 'violet' },
  group: { icon: Users, tone: 'sky' },
  event: { icon: PartyPopper, tone: 'pink' },
  system: { icon: Info, tone: 'gray' },
};

export function NotificationIcon({ type, className }) {
  const { icon: Icon, tone } = MAP[type] || MAP.system;
  return (
    <span className={clsx('grid h-9 w-9 shrink-0 place-items-center rounded-xl', TONES[tone], className)}>
      <Icon className="h-4 w-4" />
    </span>
  );
}
