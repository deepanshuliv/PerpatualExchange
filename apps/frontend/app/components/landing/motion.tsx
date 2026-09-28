'use client';

import { animate, motion, useInView, useMotionValue, useTransform } from 'motion/react';
import { useEffect, useRef, type ReactNode } from 'react';

export const EASE_OUT = [0.16, 1, 0.3, 1] as const;

/** Fades and lifts its children into place the first time they scroll into view. */
export function Reveal({
  children,
  delay = 0,
  y = 24,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.8, ease: EASE_OUT, delay }}
    >
      {children}
    </motion.div>
  );
}

/** Headline that reveals word by word. Words wrapped in *asterisks* get the accent color. */
export function SplitHeadline({
  text,
  className,
  delay = 0,
  as: Tag = 'h2',
}: {
  text: string;
  className?: string;
  delay?: number;
  as?: 'h1' | 'h2';
}) {
  const words = text.split(' ');
  const MotionTag = Tag === 'h1' ? motion.h1 : motion.h2;
  return (
    <MotionTag
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-60px' }}
      transition={{ staggerChildren: 0.06, delayChildren: delay }}
    >
      {words.map((raw, i) => {
        const accent = raw.startsWith('*');
        const word = raw.replace(/\*/g, '');
        const isBreak = word === '/';
        if (isBreak) return <br key={i} />;
        return (
          <span key={i} className="inline-block overflow-hidden pb-[0.08em] align-bottom">
            <motion.span
              className={`inline-block ${accent ? 'text-accent' : ''}`}
              variants={{
                hidden: { y: '105%' },
                show: { y: '0%', transition: { duration: 0.9, ease: EASE_OUT } },
              }}
            >
              {word}
              {i < words.length - 1 && ' '}
            </motion.span>
          </span>
        );
      })}
    </MotionTag>
  );
}

/** Counts up to `to` once visible. */
export function CountUp({
  to,
  decimals = 0,
  prefix = '',
  suffix = '',
  duration = 1.6,
}: {
  to: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const value = useMotionValue(0);
  const text = useTransform(value, (v) => `${prefix}${v.toFixed(decimals)}${suffix}`);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(value, to, { duration, ease: EASE_OUT });
    return () => controls.stop();
  }, [inView, to, duration, value]);

  return <motion.span ref={ref}>{text}</motion.span>;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">{children}</span>
  );
}
