import styles from './TricolorSpinner.module.css';

export type TricolorVariant = 'vertical' | 'hungary';

type Orientation = 'vertical' | 'horizontal';

interface VariantSpec {
  orientation: Orientation;
  colors: [string, string, string];
}

const NEUTRAL = 'var(--color-text-primary)';

const VARIANTS: Record<TricolorVariant, VariantSpec> = {
  vertical: {
    orientation: 'vertical',
    colors: [NEUTRAL, NEUTRAL, NEUTRAL],
  },
  hungary: {
    orientation: 'horizontal',
    colors: ['var(--flag-hu-red)', 'var(--flag-hu-white)', 'var(--flag-hu-green)'],
  },
};

interface Props {
  variant?: TricolorVariant;
}

export function TricolorSpinner({ variant = 'vertical' }: Props) {
  const { orientation, colors } = VARIANTS[variant];
  const containerCls = orientation === 'horizontal' ? styles['bars-horizontal'] : styles['bars-vertical'];
  const animateCls = orientation === 'horizontal' ? 'animate-bounceX' : 'animate-bounce';

  return (
    <div className={containerCls}>
      {colors.map((color, i) => (
        <div key={i} className={`${styles.bar} ${animateCls}`} style={{ background: color }} />
      ))}
    </div>
  );
}
