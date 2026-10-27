interface Props {
  status?: "live" | "stalled";
}

export function LiveIndicator({ status = "live" }: Props) {
  return (
    <span className={`live-indicator live-indicator--${status}`}>
      <span className="live-indicator__dot" />
      {status === "live" ? "En vivo" : "Sin señal"}
    </span>
  );
}
