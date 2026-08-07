interface IconProps {
  name: string;
  className?: string;
  weight?: string;
}

export default function Icon({ name, className = "", weight }: IconProps) {
  return (
    <span
      aria-hidden
      className={`material-symbols-outlined ${className}`}
      style={weight ? { fontVariationSettings: `'FILL' 0, 'wght' ${weight}` } : undefined}
    >
      {name}
    </span>
  );
}
