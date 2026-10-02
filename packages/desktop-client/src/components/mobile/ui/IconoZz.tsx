import { Text } from '@actual-app/components/text';

/** «zZ» tipográfico del sistema A para lo ignorado este mes. */
export function IconoZz({ color }: { color?: string }) {
  return (
    <Text
      aria-hidden
      style={{
        fontWeight: 800,
        fontSize: 12,
        letterSpacing: '-0.04em',
        color: color ?? 'inherit',
      }}
    >
      zZ
    </Text>
  );
}
