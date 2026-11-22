import { Component, type ReactNode } from "react";

type VenueSceneBoundaryProps = {
  children: ReactNode;
  onError?: () => void;
  fallback?: ReactNode;
};

export class VenueSceneBoundary extends Component<
  VenueSceneBoundaryProps,
  { failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch() {
    this.props.onError?.();
  }

  override render() {
    return this.state.failed
      ? (this.props.fallback ?? null)
      : this.props.children;
  }
}
