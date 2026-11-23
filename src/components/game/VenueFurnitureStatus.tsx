type VenueFurnitureStatusProps = {
  pending: number;
  failed: number;
};

export function VenueFurnitureStatus({ pending, failed }: VenueFurnitureStatusProps) {
  if (pending === 0 && failed === 0) {
    return null;
  }

  return (
    <p role="status" className="text-xs text-muted-foreground">
      {pending > 0 && "Some furnishings are still loading."}
      {pending > 0 && failed > 0 && " "}
      {failed > 0 && "Some furnishings are unavailable."}
    </p>
  );
}
