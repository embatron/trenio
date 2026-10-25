import type { ReactNode, SVGProps } from "react";
import type { SportIconKey } from "@/lib/catalog/sport-taxonomy";

type SportIconProps = SVGProps<SVGSVGElement> & {
  iconKey: SportIconKey;
};

function LineIcon(props: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="var(--icon-stroke)"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    />
  );
}

function MartialArtsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <LineIcon {...props}>
      <circle cx="15" cy="5.5" r="1.6" />
      <path d="M13.2 8.8 10 13.2" />
      <path d="M13.2 8.8 9.2 7.4" />
      <path d="M13.2 8.8 16.6 7.2" />
      <path d="M10 13.2 7 18.5" />
      <path d="M10 13.2 15.6 15.4 19 12.2" />
    </LineIcon>
  );
}

function GymFitnessIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <LineIcon {...props}>
      <path d="M4 9v6" />
      <path d="M7 6.5v11" />
      <path d="M17 6.5v11" />
      <path d="M20 9v6" />
      <path d="M7 12h10" />
    </LineIcon>
  );
}

function AthleticPrepIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <LineIcon {...props}>
      <path d="M5 18h14" />
      <path d="M7 18V8" />
      <path d="M17 18V8" />
      <path d="M7 10h10" />
      <path d="M9.5 10v2.2" />
      <path d="M12 10v2.2" />
      <path d="M14.5 10v2.2" />
    </LineIcon>
  );
}

function YogaStretchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <LineIcon {...props}>
      <circle cx="12" cy="5" r="1.8" />
      <path d="M12 7.2v4.5" />
      <path d="M8 11.5h8" />
      <path d="m9 19 3-5 3 5" />
    </LineIcon>
  );
}

function WellnessIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <LineIcon {...props}>
      <circle cx="12" cy="5.2" r="1.7" />
      <path d="M12 7.2v4.4" />
      <path d="M8.4 16.8c.8-2.4 2.1-3.6 3.6-3.6s2.8 1.2 3.6 3.6" />
      <path d="M6.2 18.6c1.8-1 3.6-1.4 5.8-1.4s4 .4 5.8 1.4" />
      <path d="M4.8 8.2c.8-1.2 1.6-1.2 2.2 0" />
      <path d="M17 8.2c.6-1.2 1.4-1.2 2.2 0" />
    </LineIcon>
  );
}

function SwimmingIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <LineIcon {...props}>
      <circle cx="7" cy="6.5" r="1.6" />
      <path d="M5.4 10.6c2 .9 3.4.6 4.8-.8l2.6 1.3" />
      <path d="M3 15.5c1.7 1.2 2.7 1.2 4.4 0s2.7-1.2 4.4 0 2.7 1.2 4.4 0 2.7-1.2 4.4 0" />
      <path d="M3 19c1.7 1.2 2.7 1.2 4.4 0s2.7-1.2 4.4 0 2.7 1.2 4.4 0 2.7-1.2 4.4 0" />
    </LineIcon>
  );
}

function TeamSportsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <LineIcon {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4v4.2" />
      <path d="m8.2 8.4 3.8 2.2 3.8-2.2" />
      <path d="M8.2 8.4 5 10" />
      <path d="M15.8 8.4 19 10" />
      <path d="M10.2 14.2 8 18.2" />
      <path d="M13.8 14.2 16 18.2" />
      <path d="M10.2 14.2h3.6" />
    </LineIcon>
  );
}

function RacketSportIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <LineIcon {...props}>
      <circle cx="8.5" cy="8.5" r="4.6" />
      <path d="M8.5 3.9v9.2" />
      <path d="M3.9 8.5h9.2" />
      <path d="m12.2 12.2 7 7" />
    </LineIcon>
  );
}

function RunningIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <LineIcon {...props}>
      <circle cx="13" cy="5" r="2" />
      <path d="M4 17l5 1 .75-1.5" />
      <path d="M15 21v-4l-4-3 1-6" />
      <path d="M7 12v-3l5-1 3 3 3 1" />
    </LineIcon>
  );
}

function DanceIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <LineIcon {...props}>
      <circle cx="14" cy="4.6" r="1.6" />
      <path d="M13.2 7.4 11 12" />
      <path d="M11 12 7.2 10" />
      <path d="M11 12 16 11l2.2-3" />
      <path d="M11 12 8.6 19" />
      <path d="M11 12 15.4 18.5" />
    </LineIcon>
  );
}

function GymnasticsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <LineIcon {...props}>
      <path d="M4 4.5h16" />
      <path d="M8 4.5v3" />
      <path d="M16 4.5v3" />
      <circle cx="8" cy="11.2" r="3.2" />
      <circle cx="16" cy="11.2" r="3.2" />
    </LineIcon>
  );
}

function WinterSportsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <LineIcon {...props}>
      <path d="m10 20-1.25-2.5L6 18" />
      <path d="M10 4 8.75 6.5 6 6" />
      <path d="m14 20 1.25-2.5L18 18" />
      <path d="m14 4 1.25 2.5L18 6" />
      <path d="m17 21-3-6h-4" />
      <path d="m17 3-3 6 1.5 3" />
      <path d="M2 12h6.5L10 9" />
      <path d="m20 10-1.5 2 1.5 2" />
      <path d="M22 12h-6.5L14 15" />
      <path d="m4 10 1.5 2L4 14" />
      <path d="m7 21 3-6-1.5-3" />
      <path d="m7 3 3 6h4" />
    </LineIcon>
  );
}

function CyclingIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <LineIcon {...props}>
      <circle cx="6" cy="16.5" r="3.2" />
      <circle cx="18" cy="16.5" r="3.2" />
      <path d="M6 16.5 10.2 8h3.4" />
      <path d="m10.2 8 2.2 8.5H18" />
      <path d="M13.6 8 16.2 5.5" />
      <path d="M15.2 5.5H18" />
    </LineIcon>
  );
}

function RehabIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <LineIcon {...props}>
      <path d="M22 12h-3.5l-2.8 7.5L12 5.5 8.3 19.5 5.5 12H2" />
    </LineIcon>
  );
}

function OutdoorIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <LineIcon {...props}>
      <path d="m3 18 5.5-8 3.5 4.2 2.2-3.2L21 18H3z" />
      <path d="M16.2 6.2 17.2 4.4" />
    </LineIcon>
  );
}

function ClubSportsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <LineIcon {...props}>
      <path d="M6 21V3" />
      <path d="M6 4h10l-2.2 3.2L16 10.4H6" />
    </LineIcon>
  );
}

function MindSportsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <LineIcon {...props}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M12 4v16" />
      <path d="M4 12h16" />
    </LineIcon>
  );
}

const iconMap: Record<SportIconKey, (props: SVGProps<SVGSVGElement>) => ReactNode> = {
  martialArts: MartialArtsIcon,
  gymFitness: GymFitnessIcon,
  athleticPrep: AthleticPrepIcon,
  yogaStretch: YogaStretchIcon,
  wellness: WellnessIcon,
  swimming: SwimmingIcon,
  teamSports: TeamSportsIcon,
  racketSports: RacketSportIcon,
  running: RunningIcon,
  dance: DanceIcon,
  gymnastics: GymnasticsIcon,
  winterSports: WinterSportsIcon,
  cycling: CyclingIcon,
  rehab: RehabIcon,
  outdoor: OutdoorIcon,
  clubSports: ClubSportsIcon,
  mindSports: MindSportsIcon,
};

export function SportIcon({ iconKey, ...props }: SportIconProps) {
  const Icon = iconMap[iconKey];
  return <Icon aria-hidden="true" {...props} />;
}
