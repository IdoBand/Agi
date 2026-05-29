import { useEffect, useRef } from 'react';
import { getSharedAnalyser } from '../../utils/sharedAnalyser';
import { lerp } from '../../utils/lipsync';
import styles from './SpeechBubbleVisualizer.module.css';

const POINT_COUNT = 48;
const VIEW_W = 45;
const VIEW_H = 36;
const BASELINE_Y = VIEW_H / 2;
const PAD_X = 0;
const WAVE_SCALE = 5;
const NOISE_SCALE = 2;
const LERP_ALPHA = 0.35;

export function SpeechBubbleVisualizer() {
  const pathRef = useRef<SVGPathElement | null>(null);
  const bufferRef = useRef<Uint8Array<ArrayBuffer>>(new Uint8Array(new ArrayBuffer(256)));
  const yValuesRef = useRef<Float32Array>(new Float32Array(POINT_COUNT));
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const yValues = yValuesRef.current;
    for (let i = 0; i < POINT_COUNT; i++) {
      yValues[i] = BASELINE_Y;
    }

    const startTime = performance.now();

    const tick = () => {
      const path = pathRef.current;
      if (!path) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const t = (performance.now() - startTime) / 1000;
      const analyser: AnalyserNode | null = getSharedAnalyser();

      let rmsScale = 0;
      const buf = bufferRef.current;
      if (analyser) {
        analyser.getByteTimeDomainData(buf);
        let sumSq = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sumSq += v * v;
        }
        const rms = Math.sqrt(sumSq / buf.length);
        rmsScale = Math.min(1, rms * 4);
      }

      const stepX = (VIEW_W - PAD_X * 2) / (POINT_COUNT - 1);
      for (let i = 0; i < POINT_COUNT; i++) {
        let raw = 0;
        let noise = 0;
        if (analyser && rmsScale > 0) {
          const sampleIdx = Math.floor((i / POINT_COUNT) * buf.length);
          raw = (buf[sampleIdx] - 128) / 128;
          noise = Math.sin(t * 3 + i * 0.7) * 0.5 + Math.sin(t * 7.3 + i * 1.9) * 0.25;
        }
        const targetY = BASELINE_Y + (raw * WAVE_SCALE + noise * NOISE_SCALE) * rmsScale;
        yValues[i] = lerp(yValues[i], targetY, LERP_ALPHA);
      }

      // Build a smooth path using midpoint-as-on-curve quadratic segments.
      let d = `M ${PAD_X} ${yValues[0].toFixed(2)}`;
      for (let i = 1; i < POINT_COUNT - 1; i++) {
        const xPrev = PAD_X + (i - 1) * stepX;
        const xCurr = PAD_X + i * stepX;
        const cx = xCurr;
        const cy = yValues[i];
        const mx = (xPrev + xCurr) / 2 + stepX / 2;
        const my = (yValues[i] + yValues[i + 1]) / 2;
        d += ` Q ${cx.toFixed(2)} ${cy.toFixed(2)} ${mx.toFixed(2)} ${my.toFixed(2)}`;
      }
      const lastX = PAD_X + (POINT_COUNT - 1) * stepX;
      d += ` T ${lastX.toFixed(2)} ${yValues[POINT_COUNT - 1].toFixed(2)}`;

      path.setAttribute('d', d);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return (
    <div className={styles.wrap}>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        width={VIEW_W}
        height={VIEW_H}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <clipPath id="bubbleClip">
            <rect x={1} y={1} width={VIEW_W - 2} height={VIEW_H - 2} rx={(VIEW_H - 2) / 2} ry={(VIEW_H - 2) / 2} />
          </clipPath>
        </defs>
        <rect
          x={0.5}
          y={0.5}
          width={VIEW_W - 1}
          height={VIEW_H - 1}
          rx={(VIEW_H - 1) / 2}
          ry={(VIEW_H - 1) / 2}
          fill="#111827"
          stroke="#374151"
          strokeWidth={1}
        />
        <path
          ref={pathRef}
          fill="none"
          stroke="rgba(255,255,255,0.95)"
          strokeWidth={1}
          strokeLinecap="round"
          strokeLinejoin="round"
          clipPath="url(#bubbleClip)"
        />
      </svg>
    </div>
  );
}
