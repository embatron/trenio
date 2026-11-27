import { useEffect, useRef, useState } from "react";
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";

import { pulseChartDayLabel, type PulseChartPoint } from "@/lib/catalog/pulse-chart";

const SERIES = [
  { key: "shows", name: "Показы", color: "#e7a0a3" },
  { key: "opens", name: "Открытия", color: "#f04b50" },
  { key: "contacts", name: "Контакты", color: "#176f74" },
  { key: "messages", name: "Сообщения", color: "#34734a" },
] as const;

type SeriesKey = (typeof SERIES)[number]["key"];

export default function TrainerPulseChart({ points }: { points: PulseChartPoint[] }) {
  const [visible, setVisible] = useState<Record<SeriesKey, boolean>>({
    shows: true,
    opens: true,
    contacts: true,
    messages: true,
  });
  const rows = (points ?? []).map((point) => ({ ...point, label: pulseChartDayLabel(point.day) }));
  const shown = SERIES.filter((item) => visible[item.key]);
  const frame = useRef<HTMLDivElement>(null);
  const [frameWidth, setFrameWidth] = useState(0);
  useEffect(() => {
    const node = frame.current;
    if (!node) return;
    const apply = () => setFrameWidth(node.clientWidth);
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(node);
    return () => observer.disconnect();
  }, [shown.length]);
  const width = Math.max(rows.length * 64, frameWidth || 320);

  return (
    <div className="cabinet-chart">
      <div className="cabinet-chart__key" role="group" aria-label="Линии графика">
        {SERIES.map((item) => (
          <button
            key={item.key}
            type="button"
            aria-pressed={visible[item.key]}
            className={visible[item.key] ? "is-current" : undefined}
            onClick={() => setVisible((current) => ({ ...current, [item.key]: !current[item.key] }))}
          >
            <i style={{ background: item.color }} />
            {item.name}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="cabinet-story__note">Отметьте, что показать на графике.</p>
      ) : (
        <div ref={frame} className="cabinet-chart__scroll" tabIndex={0} aria-label="График по дням, можно прокрутить в сторону">
          <LineChart width={width} height={240} data={rows} margin={{ top: 8, right: 28, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="rgba(20, 20, 20, 0.08)" />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#6b6b6b" }} interval={0} padding={{ left: 8, right: 8 }} />
            <YAxis allowDecimals={false} width={36} tick={{ fontSize: 12, fill: "#6b6b6b" }} />
            <Tooltip />
            {shown.map((item) => (
              <Line
                key={item.key}
                type="monotone"
                dataKey={item.key}
                name={item.name}
                stroke={item.color}
                strokeWidth={2}
                dot={{ r: 3, strokeWidth: 0, fill: item.color }}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </div>
      )}
    </div>
  );
}
