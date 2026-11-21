import { Component, type ReactNode } from "react";

type VenueSceneBoundaryProps = {
  children: ReactNode;
  onError: () => void;
  /** Change when the destination scene changes so a prior failure cannot poison the next scene. */
  resetKey?: string | number;
};

type VenueSceneBoundaryState = {
  failed: boolean;
  resetKey: string | number | undefined;
};

export class VenueSceneBoundary extends Component<
  VenueSceneBoundaryProps,
  VenueSceneBoundaryState
> {
  override state: VenueSceneBoundaryState = {
    failed: false,
    resetKey: this.props.resetKey,
  };

  static getDerivedStateFromProps(
    props: VenueSceneBoundaryProps,
    state: VenueSceneBoundaryState,
  ): Partial<VenueSceneBoundaryState> | null {
    if (props.resetKey !== state.resetKey) {
      return { failed: false, resetKey: props.resetKey };
    }
    return null;
  }

  static getDerivedStateFromError(): Partial<VenueSceneBoundaryState> {
    return { failed: true };
  }

  override componentDidCatch() {
    this.props.onError();
  }

  override render() {
    return this.state.failed ? null : this.props.children;
  }
}
